from __future__ import annotations

import time
from typing import Optional
from uuid import UUID

from fastapi import Request, Response
from jose import JWTError, jwt

from app.config import settings

COOKIE_NAME = "ns_session"
ALGORITHM = "HS256"


def create_session_token(user_id: UUID) -> str:
    claims = {
        "sub": str(user_id),
        "iat": int(time.time()),
        "exp": int(time.time()) + settings.session_expiry_seconds,
        "type": "session",
    }
    return jwt.encode(claims, settings.session_secret, algorithm=ALGORITHM)


def verify_session_token(token: str) -> Optional[UUID]:
    try:
        payload = jwt.decode(token, settings.session_secret, algorithms=[ALGORITHM])
        if payload.get("type") != "session":
            return None
        return UUID(payload["sub"])
    except (JWTError, ValueError, KeyError):
        return None


def set_session_cookie(response: Response, token: str) -> None:
    response.set_cookie(
        key=COOKIE_NAME,
        value=token,
        httponly=True,
        secure=False,  # False for localhost dev
        samesite="lax",
        max_age=settings.session_expiry_seconds,
        path="/",
    )


def clear_session_cookie(response: Response) -> None:
    response.delete_cookie(key=COOKIE_NAME, path="/")


def get_session_user_id(request: Request) -> Optional[UUID]:
    token = request.cookies.get(COOKIE_NAME)
    if not token:
        return None
    return verify_session_token(token)
