from __future__ import annotations

from typing import Optional
from urllib.parse import urlencode
from uuid import UUID

from fastapi import APIRouter, Depends, Form, Query, Request
from fastapi.responses import JSONResponse, RedirectResponse
from slowapi import Limiter
from slowapi.util import get_remote_address
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.services import app_service, authz_service, claim_service, discord_service, scope_service, token_service, user_service
from app.services.claim_resolver import resolve_claims
from app.services.session_service import get_session_user_id

router = APIRouter(prefix="/oauth", tags=["oauth"])
limiter = Limiter(key_func=get_remote_address)


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
    nonce: Optional[str] = Query(None),
    prompt: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
):
    if response_type != "code":
        return oauth_error("unsupported_response_type", "Only 'code' is supported")

    # M1: PKCE required for all authorization code grants (RFC 9700)
    if not code_challenge:
        return oauth_error("invalid_request", "code_challenge is required (PKCE)")
    if code_challenge_method and code_challenge_method != "S256":
        return oauth_error("invalid_request", "Only S256 code_challenge_method is supported")

    app = await app_service.get_app_by_client_id(db, client_id)
    if not app:
        return oauth_error("invalid_client", "Unknown client_id")

    # M4: Only approved apps can authorize (RFC 6749)
    if app.status != "approved":
        return oauth_error("invalid_client", "Application is not approved")

    if redirect_uri not in app.redirect_uris:
        return oauth_error("invalid_request", "redirect_uri not registered")

    # M2: Validate requested scopes against app's registered scopes (RFC 6749 S3.3)
    requested_scopes = scope.split() if scope else []
    if app.scopes:
        invalid_scopes = [s for s in requested_scopes if s not in app.scopes]
        if invalid_scopes:
            return oauth_error(
                "invalid_scope",
                f"Scopes not registered for this app: {', '.join(invalid_scopes)}",
            )

    authorize_params = urlencode({
        "response_type": response_type,
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "scope": scope,
        "state": state or "",
        "code_challenge": code_challenge or "",
        "code_challenge_method": code_challenge_method or "",
        "nonce": nonce or "",
        "prompt": prompt or "",
    })

    # Always redirect to frontend consent page.
    # The frontend checks localStorage for the session token and either
    # auto-approves, shows consent, or redirects to login.
    # This avoids cross-origin cookie issues on different domains.
    return RedirectResponse(
        url=f"{settings.frontend_url}/consent?{authorize_params}",
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
    all_scopes = await scope_service.get_all_scopes(db)
    scope_details = [s for s in all_scopes if s["name"] in requested_scopes]

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
    nonce: str = Form(""),
    approved: bool = Form(...),
    db: AsyncSession = Depends(get_db),
):
    user_id = get_session_user_id(request)
    if not user_id:
        return oauth_error("access_denied", "User not authenticated", 401)

    # H3: Validate redirect_uri BEFORE checking approval (RFC 6749 S4.1.2.1)
    app = await app_service.get_app_by_client_id(db, client_id)
    if not app:
        return oauth_error("invalid_client", "Unknown client_id")

    if redirect_uri not in app.redirect_uris:
        return oauth_error("invalid_request", "redirect_uri not registered")

    # M2: Validate requested scopes against app's registered scopes (consent endpoint)
    requested_scopes = scope.split() if scope else []
    if app.scopes:
        invalid_scopes = [s for s in requested_scopes if s not in app.scopes]
        if invalid_scopes:
            return oauth_error(
                "invalid_scope",
                f"Scopes not registered for this app: {', '.join(invalid_scopes)}",
            )

    if not approved:
        params = urlencode({"error": "access_denied", "state": state})
        return JSONResponse(content={"redirect_to": f"{redirect_uri}?{params}"})

    code = await authz_service.create_authorization_code(
        db=db,
        client_id=client_id,
        user_id=user_id,
        redirect_uri=redirect_uri,
        scope=scope,
        state=state or None,
        code_challenge=code_challenge or None,
        code_challenge_method=code_challenge_method or None,
        nonce=nonce or None,
    )

    params = {"code": code}
    if state:
        params["state"] = state
    return JSONResponse(content={"redirect_to": f"{redirect_uri}?{urlencode(params)}"})


@router.post(
    "/token",
    summary="Exchange credentials for tokens",
    description="""Token endpoint supporting three grant types:

- **`client_credentials`** — Machine-to-machine. Requires `client_id` + `client_secret`. Returns an access token with no user context.
- **`authorization_code`** — User-facing. Exchanges an authorization code (from `/oauth/authorize/consent`) for an access token. Supports PKCE (`code_verifier`). If `openid` scope was granted, also returns an `id_token`. If `offline_access` scope was granted, also returns a `refresh_token`.
- **`refresh_token`** — Exchange a refresh token for a new access token + refresh token (rotation). Requires `client_id` + `client_secret`.

Client authentication: provide `client_secret` for confidential clients, or omit for public clients (PKCE-only).
""",
    responses={
        200: {"description": "Token response with `access_token`, `token_type`, `expires_in`, `scope`, and optionally `id_token`."},
        400: {"description": "Missing required fields, invalid/expired authorization code, PKCE mismatch, or unsupported grant type."},
        401: {"description": "Invalid client credentials."},
    },
)
@limiter.limit("30/minute")
async def token(
    request: Request,
    grant_type: str = Form(...),
    client_id: str = Form(None),
    client_secret: str = Form(None),
    scope: str = Form(None),
    code: str = Form(None),
    redirect_uri: str = Form(None),
    code_verifier: str = Form(None),
    refresh_token: str = Form(None),
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

        if "offline_access" in granted_scopes:
            rt, _ = await token_service.issue_refresh_token(
                db, app, auth_code.user_id, granted_scopes
            )
            response_body["refresh_token"] = rt

        if "openid" in granted_scopes:
            user = await user_service.get_user_by_id(db, auth_code.user_id)
            if user:
                id_token = await token_service.issue_id_token(
                    db, app, user, granted_scopes, nonce=auth_code.nonce
                )
                response_body["id_token"] = id_token

        return response_body

    elif grant_type == "refresh_token":
        if not refresh_token or not client_id or not client_secret:
            return oauth_error(
                "invalid_request",
                "refresh_token, client_id, and client_secret are required",
            )

        app = await token_service.authenticate_client(db, client_id, client_secret)
        if not app:
            return oauth_error("invalid_client", "Invalid client credentials", 401)

        result = await token_service.exchange_refresh_token(db, refresh_token, client_id)
        if not result:
            return oauth_error("invalid_grant", "Invalid or expired refresh token")

        response_body = {
            "access_token": result["access_token"],
            "refresh_token": result["refresh_token"],
            "token_type": "Bearer",
            "expires_in": result["expires_in"],
            "scope": result["scope"],
        }

        granted_scopes = result["scope"].split() if result["scope"] else []
        if "openid" in granted_scopes:
            user = await user_service.get_user_by_id(db, result["user_id"])
            if user:
                id_token = await token_service.issue_id_token(db, app, user, granted_scopes)
                response_body["id_token"] = id_token

        return response_body

    else:
        return oauth_error(
            "unsupported_grant_type",
            "Supported: client_credentials, authorization_code, refresh_token",
        )


@router.get(
    "/userinfo",
    summary="Get user claims (OIDC UserInfo)",
    description="""Returns user claims based on the scopes granted to the access token.

Requires a valid Bearer token in the `Authorization` header. The token must have been issued via the `authorization_code` grant (tokens from `client_credentials` have no user context and will be rejected).

**Claims by scope:** `openid` → sub | `email` → email, email_verified | `profile` → name, picture | `roles` → roles | `date_joined` → date_joined.
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

    # Check which claims need live Discord data
    discord_claim_names = await claim_service.get_discord_claim_names(db)
    discord_data = None

    # Fetch live Discord data if any requested claims are Discord-sourced
    if discord_claim_names and getattr(user, "discord_id", None):
        discord_data = await discord_service.get_live_member_data(user.discord_id)

    # Use live Discord roles for role-gated scope resolution
    user_roles = discord_data.get("roles") if discord_data else None

    # Resolve claims dynamically from DB-defined scopes
    claim_names = await scope_service.get_claims_for_scopes(
        db, scopes, user_roles=user_roles
    )
    resolved = resolve_claims(
        user,
        [c for c in claim_names if c != "sub"],
        discord_data=discord_data,
        discord_claim_names=discord_claim_names,
    )
    claims.update(resolved)

    return claims


@router.post(
    "/token/introspect",
    summary="Introspect a token",
    description="Check whether an access token is active. Returns token metadata including `scope`, `client_id`, `user_id`, `exp`, `iat`, `jti`, and `iss`. Returns `{\"active\": false}` for invalid, expired, or revoked tokens.",
    responses={
        200: {"description": "Introspection result with `active` boolean and token metadata."},
    },
)
@limiter.limit("30/minute")
async def introspect(
    request: Request,
    token: str = Form(...),
    client_id: str = Form(None),
    client_secret: str = Form(None),
    db: AsyncSession = Depends(get_db),
):
    # H1: Client auth required (RFC 7662 S2.1)
    if not client_id or not client_secret:
        return oauth_error("invalid_client", "client_id and client_secret required", 401)
    app = await token_service.authenticate_client(db, client_id, client_secret)
    if not app:
        return oauth_error("invalid_client", "Invalid client credentials", 401)

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
@limiter.limit("30/minute")
async def revoke(
    request: Request,
    token: str = Form(...),
    client_id: str = Form(None),
    client_secret: str = Form(None),
    db: AsyncSession = Depends(get_db),
):
    # H2: Client auth required (RFC 7009 S2.1)
    if not client_id or not client_secret:
        return oauth_error("invalid_client", "client_id and client_secret required", 401)
    app = await token_service.authenticate_client(db, client_id, client_secret)
    if not app:
        return oauth_error("invalid_client", "Invalid client credentials", 401)

    await token_service.revoke_token(db, token)
    return {}
