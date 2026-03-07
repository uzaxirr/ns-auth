from __future__ import annotations

import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from urllib.parse import urlencode, urlparse

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.models.oauth_state import OAuthState
from app.models.session_code import SessionCode
from app.services import discord_service, user_service
from app.services.session_service import (
    create_session_token,
    clear_session_cookie,
    get_session_user_id,
    set_session_cookie,
)

router = APIRouter(prefix="/auth", tags=["auth"])

STATE_TTL = timedelta(minutes=10)
SESSION_CODE_TTL = timedelta(seconds=60)  # codes expire fast — single-use relay


class UserResponse(BaseModel):
    id: str
    email: Optional[str] = None
    is_admin: bool = False

    class Config:
        from_attributes = True

    @classmethod
    def from_user(cls, user) -> "UserResponse":
        return cls(
            id=str(user.id),
            email=user.email,
            is_admin=user.is_admin,
        )


@router.get(
    "/discord",
    summary="Redirect to Discord OAuth2 login",
    description="Generates a CSRF state token, stores the `next` URL, and redirects the user to Discord's OAuth2 authorization page. After Discord login, the user is sent to `/auth/discord/callback`.",
    responses={302: {"description": "Redirect to Discord OAuth2 authorization page."}},
)
async def discord_login(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    next_url = request.query_params.get("next", settings.frontend_url)

    # C3: Validate next_url to prevent open redirect (RFC 6819 S4.2.4)
    allowed_origin = urlparse(settings.frontend_url)
    parsed_next = urlparse(next_url)
    if parsed_next.scheme and parsed_next.netloc:
        if (parsed_next.scheme != allowed_origin.scheme or
                parsed_next.netloc != allowed_origin.netloc):
            next_url = settings.frontend_url
    elif not next_url.startswith("/"):
        next_url = settings.frontend_url

    state = secrets.token_urlsafe(32)

    # Clean up expired states opportunistically
    await db.execute(
        delete(OAuthState).where(OAuthState.expires_at < datetime.now(timezone.utc))
    )

    db.add(OAuthState(
        state=state,
        next_url=next_url,
        expires_at=datetime.now(timezone.utc) + STATE_TTL,
    ))
    await db.commit()

    authorize_url = discord_service.get_authorize_url(state)
    return RedirectResponse(url=authorize_url, status_code=302)


@router.get(
    "/discord/callback",
    summary="Discord OAuth2 callback",
    description="Handles the Discord OAuth2 callback. Validates state, exchanges the authorization code for tokens, fetches the Discord user profile, verifies NS guild membership (rejects non-members), fetches guild roles, creates/updates the user, sets the `ns_session` cookie, and redirects to the stored `next` URL.",
    responses={
        302: {"description": "Redirect to `next` URL with session cookie set."},
    },
)
async def discord_callback(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    code = request.query_params.get("code")
    state = request.query_params.get("state")
    error = request.query_params.get("error")

    login_error_url = f"{settings.frontend_url}/login"

    # Discord denied or user cancelled
    if error:
        return RedirectResponse(
            url=f"{login_error_url}?{urlencode({'error': error})}",
            status_code=302,
        )

    # Validate state from database
    if not state:
        return RedirectResponse(
            url=f"{login_error_url}?{urlencode({'error': 'invalid_state'})}",
            status_code=302,
        )

    result = await db.execute(
        select(OAuthState).where(
            OAuthState.state == state,
            OAuthState.expires_at >= datetime.now(timezone.utc),
        )
    )
    oauth_state = result.scalar_one_or_none()
    if not oauth_state:
        return RedirectResponse(
            url=f"{login_error_url}?{urlencode({'error': 'invalid_state'})}",
            status_code=302,
        )

    next_url = oauth_state.next_url
    # Consume the state (one-time use)
    await db.delete(oauth_state)
    await db.commit()

    if not code:
        return RedirectResponse(
            url=f"{login_error_url}?{urlencode({'error': 'missing_code'})}",
            status_code=302,
        )

    # Exchange code for Discord tokens
    token_data = await discord_service.exchange_code(code)
    if not token_data:
        return RedirectResponse(
            url=f"{login_error_url}?{urlencode({'error': 'token_exchange_failed'})}",
            status_code=302,
        )

    discord_access_token = token_data.get("access_token", "")

    # Fetch Discord user profile
    discord_user = await discord_service.get_user(discord_access_token)
    if not discord_user:
        return RedirectResponse(
            url=f"{login_error_url}?{urlencode({'error': 'discord_user_fetch_failed'})}",
            status_code=302,
        )

    discord_id = discord_user["id"]

    # Verify NS guild membership
    is_member = await discord_service.check_guild_membership(discord_id)
    if not is_member:
        return RedirectResponse(
            url=f"{login_error_url}?{urlencode({'error': 'not_ns_member'})}",
            status_code=302,
        )

    # Create or update user (only store discord_id and email)
    email = discord_user.get("email")

    user = await user_service.get_or_create_user_from_discord(
        db,
        discord_id=discord_id,
        email=email,
    )

    # Invalidate cached Discord data so fresh login data takes effect
    discord_service.invalidate_member_cache(discord_id)

    # C2: Use a single-use code instead of putting the session token in the URL.
    # The frontend exchanges this code via POST /auth/session/exchange.
    session_code = secrets.token_urlsafe(32)
    db.add(SessionCode(
        code=session_code,
        user_id=user.id,
        expires_at=datetime.now(timezone.utc) + SESSION_CODE_TTL,
    ))
    await db.commit()

    from urllib.parse import quote
    relay_url = (
        f"{settings.frontend_url}/auth/session"
        f"?code={session_code}"
        f"&next={quote(next_url, safe='')}"
    )
    return RedirectResponse(url=relay_url, status_code=302)


class SessionCodeExchange(BaseModel):
    code: str


@router.post(
    "/session/exchange",
    summary="Exchange a session relay code for a session token",
    description="Accepts a single-use code (from the Discord login redirect) and returns a session JWT. The code expires after 60 seconds and can only be used once.",
    responses={
        200: {"description": "Session token returned."},
        400: {"description": "`invalid_code` — code missing, expired, or already used."},
    },
)
async def exchange_session_code(
    body: SessionCodeExchange,
    db: AsyncSession = Depends(get_db),
):
    # Look up and validate the code
    result = await db.execute(
        select(SessionCode).where(
            SessionCode.code == body.code,
            SessionCode.expires_at >= datetime.now(timezone.utc),
        )
    )
    session_code = result.scalar_one_or_none()
    if not session_code:
        return JSONResponse(
            status_code=400,
            content={"error": "invalid_code"},
        )

    user_id = session_code.user_id

    # Consume — single-use
    await db.delete(session_code)
    await db.commit()

    # Create session token and set cookie
    session_token = create_session_token(user_id)
    response = JSONResponse(content={"token": session_token})
    set_session_cookie(response, session_token)
    return response


@router.get(
    "/me",
    summary="Get current user",
    description="Returns the authenticated user's profile from the `ns_session` cookie. Used by the consent page to display who is granting access.",
    responses={
        200: {"description": "User profile."},
        401: {"description": "`not_authenticated` (no/invalid session) or `user_not_found`."},
    },
)
async def get_current_user(
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    user_id = get_session_user_id(request)
    if not user_id:
        return JSONResponse(status_code=401, content={"error": "not_authenticated"})

    user = await user_service.get_user_by_id(db, user_id)
    if not user:
        return JSONResponse(status_code=401, content={"error": "user_not_found"})

    return UserResponse.from_user(user)


@router.post(
    "/logout",
    summary="Logout",
    description="Clears the `ns_session` cookie, ending the user's session.",
    responses={200: {"description": "`{\"ok\": true}`. Session cookie cleared."}},
)
async def logout():
    response = JSONResponse(content={"ok": True})
    clear_session_cookie(response)
    return response

