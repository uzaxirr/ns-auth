from __future__ import annotations

import secrets
from typing import Dict, Optional
from urllib.parse import urlencode

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse, RedirectResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.services import discord_service, user_service
from app.services.session_service import (
    create_session_token,
    clear_session_cookie,
    get_session_user_id,
    set_session_cookie,
)

router = APIRouter(prefix="/auth", tags=["auth"])

# In-memory state store for Discord OAuth2 CSRF protection.
# Maps state token → next URL. Entries are consumed (popped) on callback.
_oauth_state_store: Dict[str, str] = {}


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
async def discord_login(request: Request):
    next_url = request.query_params.get("next", settings.frontend_url)
    state = secrets.token_urlsafe(32)
    _oauth_state_store[state] = next_url
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

    # Validate state
    if not state or state not in _oauth_state_store:
        return RedirectResponse(
            url=f"{login_error_url}?{urlencode({'error': 'invalid_state'})}",
            status_code=302,
        )

    next_url = _oauth_state_store.pop(state)

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

    # Create session and redirect
    session_token = create_session_token(user.id)
    response = RedirectResponse(url=next_url, status_code=302)
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


# DEV ONLY — remove before production
@router.post(
    "/dev/login-as",
    summary="[DEV] Login as any user by email",
    description="**Development/testing only.** Creates a session for a user by email without authentication. Remove before production.",
    responses={
        200: {"description": "User object. Sets `ns_session` cookie."},
        400: {"description": "`email required`."},
        404: {"description": "`user not found`."},
    },
)
async def dev_login_as(
    body: dict,
    db: AsyncSession = Depends(get_db),
):
    """Create a session for a user by email. Dev/testing only."""
    from app.models.user import User
    from sqlalchemy import select
    email = body.get("email")
    if not email:
        return JSONResponse(status_code=400, content={"error": "email required"})
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalar_one_or_none()
    if not user:
        return JSONResponse(status_code=404, content={"error": "user not found"})
    session_token = create_session_token(user.id)
    response = JSONResponse(content={
        "user": UserResponse.from_user(user).model_dump()
    })
    set_session_cookie(response, session_token)
    return response
