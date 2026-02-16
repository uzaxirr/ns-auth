from __future__ import annotations

from typing import Optional
from urllib.parse import urlencode
from uuid import UUID

from fastapi import APIRouter, Depends, Form, Query, Request
from fastapi.responses import JSONResponse, RedirectResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.services import app_service, authz_service, token_service, user_service
from app.services.session_service import get_session_user_id

router = APIRouter(prefix="/oauth", tags=["oauth"])


def oauth_error(error: str, description: str, status_code: int = 400) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": error, "error_description": description},
    )


@router.get(
    "/authorize",
    summary="Start authorization code flow",
    description="Validates the client request and redirects the user to the login page (if unauthenticated) or consent page (if authenticated). The frontend renders login/consent UI, then posts back to `/oauth/authorize/consent`.",
    responses={
        302: {"description": "Redirect to frontend `/login` or `/consent` with all authorize params."},
        400: {"description": "Invalid `response_type`, unknown `client_id`, or unregistered `redirect_uri`."},
    },
)
async def authorize(
    request: Request,
    response_type: str = Query(...),
    client_id: str = Query(...),
    redirect_uri: str = Query(...),
    scope: str = Query("openid"),
    state: Optional[str] = Query(None),
    code_challenge: Optional[str] = Query(None),
    code_challenge_method: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    if response_type != "code":
        return oauth_error("unsupported_response_type", "Only 'code' is supported")

    app = await app_service.get_app_by_client_id(db, client_id)
    if not app:
        return oauth_error("invalid_client", "Unknown client_id")

    if redirect_uri not in app.redirect_uris:
        return oauth_error("invalid_request", "redirect_uri not registered")

    authorize_params = urlencode({
        "response_type": response_type,
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "scope": scope,
        "state": state or "",
        "code_challenge": code_challenge or "",
        "code_challenge_method": code_challenge_method or "",
    })

    user_id = get_session_user_id(request)
    if user_id:
        return RedirectResponse(
            url=f"{settings.frontend_url}/consent?{authorize_params}",
            status_code=302,
        )
    else:
        return RedirectResponse(
            url=f"{settings.frontend_url}/login?{authorize_params}",
            status_code=302,
        )


@router.get(
    "/authorize/info",
    summary="Get app info for consent screen",
    description="Returns the app name, icon, description, privacy policy URL, and requested scope details. Used by the consent page to render what permissions the user is granting.",
    responses={
        200: {"description": "App info with scope details."},
        400: {"description": "Unknown `client_id`."},
    },
)
async def authorize_info(
    client_id: str = Query(...),
    scope: str = Query("openid"),
    db: AsyncSession = Depends(get_db),
):
    app = await app_service.get_app_by_client_id(db, client_id)
    if not app:
        return oauth_error("invalid_client", "Unknown client_id")

    requested_scopes = scope.split() if scope else []
    from app.scopes import AVAILABLE_SCOPES
    scope_details = [s for s in AVAILABLE_SCOPES if s["name"] in requested_scopes]

    return {
        "app_name": app.name,
        "app_icon_url": app.icon_url,
        "app_description": app.description,
        "privacy_policy_url": app.privacy_policy_url,
        "scopes": scope_details,
    }


@router.post(
    "/authorize/consent",
    summary="Submit consent decision",
    description="Called by the consent page after the user clicks Allow or Deny. Returns JSON `{\"redirect_to\": url}` (not a 302) because cross-origin fetch makes the Location header inaccessible. If approved, generates an authorization code and appends it to the redirect URI. If denied, appends `error=access_denied`.",
    responses={
        200: {"description": "JSON with `redirect_to` URL containing either `code` + `state` (approved) or `error=access_denied` (denied)."},
        400: {"description": "Unknown `client_id` or unregistered `redirect_uri`."},
        401: {"description": "User not authenticated (no valid session cookie)."},
    },
)
async def authorize_consent(
    request: Request,
    client_id: str = Form(...),
    redirect_uri: str = Form(...),
    scope: str = Form("openid"),
    state: str = Form(""),
    code_challenge: str = Form(""),
    code_challenge_method: str = Form(""),
    approved: bool = Form(...),
    db: AsyncSession = Depends(get_db),
):
    user_id = get_session_user_id(request)
    if not user_id:
        return oauth_error("access_denied", "User not authenticated", 401)

    if not approved:
        params = urlencode({"error": "access_denied", "state": state})
        return JSONResponse(content={"redirect_to": f"{redirect_uri}?{params}"})

    app = await app_service.get_app_by_client_id(db, client_id)
    if not app:
        return oauth_error("invalid_client", "Unknown client_id")

    if redirect_uri not in app.redirect_uris:
        return oauth_error("invalid_request", "redirect_uri not registered")

    code = await authz_service.create_authorization_code(
        db=db,
        client_id=client_id,
        user_id=user_id,
        redirect_uri=redirect_uri,
        scope=scope,
        state=state or None,
        code_challenge=code_challenge or None,
        code_challenge_method=code_challenge_method or None,
    )

    params = {"code": code}
    if state:
        params["state"] = state
    return JSONResponse(content={"redirect_to": f"{redirect_uri}?{urlencode(params)}"})


@router.post(
    "/token",
    summary="Exchange credentials for tokens",
    description="""Token endpoint supporting two grant types:

- **`client_credentials`** — Machine-to-machine. Requires `client_id` + `client_secret`. Returns an access token with no user context.
- **`authorization_code`** — User-facing. Exchanges an authorization code (from `/oauth/authorize/consent`) for an access token. Supports PKCE (`code_verifier`). If `openid` scope was granted, also returns an `id_token`.

Client authentication: provide `client_secret` for confidential clients, or omit for public clients (PKCE-only).
""",
    responses={
        200: {"description": "Token response with `access_token`, `token_type`, `expires_in`, `scope`, and optionally `id_token`."},
        400: {"description": "Missing required fields, invalid/expired authorization code, PKCE mismatch, or unsupported grant type."},
        401: {"description": "Invalid client credentials."},
    },
)
async def token(
    grant_type: str = Form(...),
    client_id: str = Form(None),
    client_secret: str = Form(None),
    scope: str = Form(None),
    code: str = Form(None),
    redirect_uri: str = Form(None),
    code_verifier: str = Form(None),
    db: AsyncSession = Depends(get_db),
):
    if grant_type == "client_credentials":
        if not client_id or not client_secret:
            return oauth_error("invalid_request", "client_id and client_secret are required")

        app = await token_service.authenticate_client(db, client_id, client_secret)
        if not app:
            return oauth_error("invalid_client", "Invalid client credentials", 401)

        requested_scopes = scope.split() if scope else []
        access_token, expires_in = await token_service.issue_token(db, app, requested_scopes)

        return {
            "access_token": access_token,
            "token_type": "Bearer",
            "expires_in": expires_in,
            "scope": scope or "",
        }

    elif grant_type == "authorization_code":
        if not code or not client_id or not redirect_uri:
            return oauth_error("invalid_request", "code, client_id, and redirect_uri are required")

        if client_secret:
            app = await token_service.authenticate_client(db, client_id, client_secret)
            if not app:
                return oauth_error("invalid_client", "Invalid client credentials", 401)
        else:
            app = await app_service.get_app_by_client_id(db, client_id)
            if not app:
                return oauth_error("invalid_client", "Unknown client_id", 401)

        auth_code = await authz_service.exchange_authorization_code(
            db=db,
            code=code,
            client_id=client_id,
            redirect_uri=redirect_uri,
            code_verifier=code_verifier,
        )
        if not auth_code:
            return oauth_error("invalid_grant", "Invalid or expired authorization code")

        granted_scopes = auth_code.scope.split() if auth_code.scope else []
        access_token, expires_in = await token_service.issue_user_token(
            db, app, auth_code.user_id, granted_scopes
        )

        response_body = {
            "access_token": access_token,
            "token_type": "Bearer",
            "expires_in": expires_in,
            "scope": auth_code.scope,
        }

        if "openid" in granted_scopes:
            user = await user_service.get_user_by_id(db, auth_code.user_id)
            if user:
                id_token = await token_service.issue_id_token(db, app, user, granted_scopes)
                response_body["id_token"] = id_token

        return response_body

    else:
        return oauth_error(
            "unsupported_grant_type",
            "Supported: client_credentials, authorization_code",
        )


@router.get(
    "/userinfo",
    summary="Get user claims (OIDC UserInfo)",
    description="""Returns user claims based on the scopes granted to the access token.

Requires a valid Bearer token in the `Authorization` header. The token must have been issued via the `authorization_code` grant (tokens from `client_credentials` have no user context and will be rejected).

**Claims by scope:** `openid` → sub | `email` → email, email_verified | `profile` → name, picture, bio | `cohort` → cohort | `socials` → socials | `wallet` → wallet_address | `activity` → posts_count, streak_days, last_active.
""",
    responses={
        200: {"description": "User claims object (scope-gated)."},
        401: {"description": "Missing Bearer token, invalid/expired token, token has no user context, or user not found."},
    },
)
async def userinfo(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    auth_header = request.headers.get("Authorization", "")
    if not auth_header.startswith("Bearer "):
        return oauth_error("invalid_request", "Bearer token required", 401)

    token_str = auth_header[7:]
    introspection = await token_service.introspect_token(db, token_str)
    if not introspection.get("active"):
        return oauth_error("invalid_token", "Token is invalid or expired", 401)

    user_id_str = introspection.get("user_id")
    if not user_id_str:
        return oauth_error("invalid_token", "Token has no user context", 401)

    user = await user_service.get_user_by_id(db, UUID(user_id_str))
    if not user:
        return oauth_error("invalid_token", "User not found", 401)

    scopes = introspection.get("scope", "").split()
    claims = {"sub": str(user.id)}

    if "email" in scopes:
        claims["email"] = user.email
        claims["email_verified"] = True

    if "profile" in scopes:
        claims["name"] = user.display_name
        claims["picture"] = user.avatar_url
        claims["bio"] = user.bio

    if "cohort" in scopes:
        claims["cohort"] = user.cohort

    if "socials" in scopes:
        claims["socials"] = user.socials or {}

    if "wallet" in scopes:
        claims["wallet_address"] = user.wallet_address

    if "activity" in scopes:
        claims["posts_count"] = 42
        claims["streak_days"] = 7
        claims["last_active"] = user.updated_at.isoformat() if user.updated_at else None

    return claims


@router.post(
    "/token/introspect",
    summary="Introspect a token",
    description="Check whether an access token is active. Returns token metadata including `scope`, `client_id`, `user_id`, `exp`, `iat`, `jti`, and `iss`. Returns `{\"active\": false}` for invalid, expired, or revoked tokens.",
    responses={
        200: {"description": "Introspection result with `active` boolean and token metadata."},
    },
)
async def introspect(
    token: str = Form(...),
    client_id: str = Form(None),
    client_secret: str = Form(None),
    db: AsyncSession = Depends(get_db),
):
    result = await token_service.introspect_token(db, token)
    return result


@router.post(
    "/token/revoke",
    summary="Revoke a token",
    description="Revokes an access token so it can no longer be used. Always returns 200 regardless of whether the token existed.",
    responses={
        200: {"description": "Empty JSON `{}`. Token is revoked (or was already invalid)."},
    },
)
async def revoke(
    token: str = Form(...),
    client_id: str = Form(None),
    client_secret: str = Form(None),
    db: AsyncSession = Depends(get_db),
):
    await token_service.revoke_token(db, token)
    return {}
