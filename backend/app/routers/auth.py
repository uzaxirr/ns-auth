from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, Request
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services import privy_service, user_service
from app.services.session_service import (
    create_session_token,
    clear_session_cookie,
    get_session_user_id,
    set_session_cookie,
)

router = APIRouter(prefix="/auth", tags=["auth"])


class PrivyLoginRequest(BaseModel):
    privy_token: str


class UserResponse(BaseModel):
    id: str
    email: Optional[str] = None
    display_name: Optional[str] = None
    avatar_url: Optional[str] = None
    cohort: Optional[str] = None
    bio: Optional[str] = None
    wallet_address: Optional[str] = None

    class Config:
        from_attributes = True

    @classmethod
    def from_user(cls, user) -> "UserResponse":
        return cls(
            id=str(user.id),
            email=user.email,
            display_name=user.display_name,
            avatar_url=user.avatar_url,
            cohort=user.cohort,
            bio=user.bio,
            wallet_address=user.wallet_address,
        )


@router.post("/login/privy")
async def login_with_privy(
    body: PrivyLoginRequest,
    db: AsyncSession = Depends(get_db),
):
    claims = await privy_service.verify_privy_token(body.privy_token)
    if not claims:
        return JSONResponse(
            status_code=401,
            content={"error": "invalid_token", "error_description": "Privy token verification failed"},
        )

    privy_did = claims.get("sub", "")

    # JWT only has sub/aud/iss — fetch email from Privy Server API
    email = None
    privy_user = await privy_service.get_privy_user(privy_did)
    if privy_user:
        for acct in privy_user.get("linked_accounts", []):
            if acct.get("type") == "email":
                email = acct.get("address")
                break

    user = await user_service.get_or_create_user_from_privy(
        db, privy_did=privy_did, email=email
    )

    session_token = create_session_token(user.id)

    response = JSONResponse(content={
        "user": UserResponse.from_user(user).model_dump()
    })
    set_session_cookie(response, session_token)
    return response


@router.get("/me")
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


@router.post("/logout")
async def logout():
    response = JSONResponse(content={"ok": True})
    clear_session_cookie(response)
    return response


# DEV ONLY — remove before production
@router.post("/dev/login-as")
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
