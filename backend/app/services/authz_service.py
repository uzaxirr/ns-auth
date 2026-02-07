from __future__ import annotations

import base64
import hashlib
import secrets
from datetime import datetime, timedelta, timezone
from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.authorization_code import AuthorizationCode


def _generate_code() -> str:
    return secrets.token_urlsafe(64)


async def create_authorization_code(
    db: AsyncSession,
    client_id: str,
    user_id: UUID,
    redirect_uri: str,
    scope: str,
    state: Optional[str] = None,
    code_challenge: Optional[str] = None,
    code_challenge_method: Optional[str] = None,
) -> str:
    code = _generate_code()
    expires_at = datetime.now(timezone.utc) + timedelta(
        seconds=settings.authorization_code_expiry_seconds
    )

    record = AuthorizationCode(
        code=code,
        client_id=client_id,
        user_id=user_id,
        redirect_uri=redirect_uri,
        scope=scope,
        state=state,
        code_challenge=code_challenge,
        code_challenge_method=code_challenge_method,
        expires_at=expires_at,
    )
    db.add(record)
    await db.commit()
    return code


async def exchange_authorization_code(
    db: AsyncSession,
    code: str,
    client_id: str,
    redirect_uri: str,
    code_verifier: Optional[str] = None,
) -> Optional[AuthorizationCode]:
    result = await db.execute(
        select(AuthorizationCode).where(AuthorizationCode.code == code)
    )
    record = result.scalar_one_or_none()

    if not record:
        return None
    if record.used:
        return None
    if record.client_id != client_id:
        return None
    if record.redirect_uri != redirect_uri:
        return None
    if record.expires_at < datetime.now(timezone.utc):
        return None

    # PKCE verification
    if record.code_challenge:
        if not code_verifier:
            return None
        if record.code_challenge_method == "S256":
            digest = hashlib.sha256(code_verifier.encode()).digest()
            expected = base64.urlsafe_b64encode(digest).rstrip(b"=").decode()
            if expected != record.code_challenge:
                return None
        elif record.code_challenge_method == "plain":
            if code_verifier != record.code_challenge:
                return None
        else:
            return None

    record.used = True
    await db.commit()
    return record
