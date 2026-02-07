from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

from jose import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.access_token import AccessToken
from app.models.oauth_app import OAuthApp
from app.security.hashing import hash_token, verify_client_secret
from app.security.keys import get_kid, get_private_key


async def authenticate_client(db: AsyncSession, client_id: str, client_secret: str) -> Optional[OAuthApp]:
    from app.services.app_service import get_app_by_client_id

    app = await get_app_by_client_id(db, client_id)
    if not app:
        return None
    if not verify_client_secret(client_secret, app.client_secret_hash):
        return None
    return app


async def issue_token(db: AsyncSession, app: OAuthApp, requested_scopes: List[str]) -> Tuple[str, int]:
    if app.scopes:
        granted = [s for s in requested_scopes if s in app.scopes] if requested_scopes else app.scopes
    else:
        granted = requested_scopes or []

    now = datetime.now(timezone.utc)
    exp = int(now.timestamp()) + settings.token_expiry_seconds
    jti = str(uuid.uuid4())

    claims = {
        "iss": settings.issuer,
        "sub": app.client_id,
        "aud": app.client_id,
        "exp": exp,
        "iat": int(now.timestamp()),
        "jti": jti,
        "scope": " ".join(granted),
        "client_id": app.client_id,
    }

    private_key = get_private_key()
    token = jwt.encode(claims, private_key, algorithm="RS256", headers={"kid": get_kid()})

    token_record = AccessToken(
        token_hash=hash_token(token),
        jti=jti,
        client_id=app.client_id,
        scopes=granted,
        expires_at=datetime.fromtimestamp(exp, tz=timezone.utc),
    )
    db.add(token_record)
    await db.commit()

    return token, settings.token_expiry_seconds


async def introspect_token(db: AsyncSession, token: str) -> Dict:
    token_h = hash_token(token)
    result = await db.execute(select(AccessToken).where(AccessToken.token_hash == token_h))
    record = result.scalar_one_or_none()

    if not record:
        return {"active": False}

    now = datetime.now(timezone.utc)
    if record.revoked or record.expires_at < now:
        return {"active": False}

    return {
        "active": True,
        "scope": " ".join(record.scopes),
        "client_id": record.client_id,
        "user_id": str(record.user_id) if record.user_id else None,
        "token_type": "Bearer",
        "exp": int(record.expires_at.timestamp()),
        "iat": int(record.created_at.timestamp()),
        "jti": record.jti,
        "iss": settings.issuer,
    }


async def issue_user_token(
    db: AsyncSession, app: OAuthApp, user_id: uuid.UUID, granted_scopes: List[str]
) -> Tuple[str, int]:
    now = datetime.now(timezone.utc)
    exp = int(now.timestamp()) + settings.token_expiry_seconds
    jti = str(uuid.uuid4())

    claims = {
        "iss": settings.issuer,
        "sub": str(user_id),
        "aud": app.client_id,
        "exp": exp,
        "iat": int(now.timestamp()),
        "jti": jti,
        "scope": " ".join(granted_scopes),
        "client_id": app.client_id,
        "user_id": str(user_id),
    }

    private_key = get_private_key()
    token = jwt.encode(claims, private_key, algorithm="RS256", headers={"kid": get_kid()})

    token_record = AccessToken(
        token_hash=hash_token(token),
        jti=jti,
        client_id=app.client_id,
        user_id=user_id,
        scopes=granted_scopes,
        expires_at=datetime.fromtimestamp(exp, tz=timezone.utc),
    )
    db.add(token_record)
    await db.commit()

    return token, settings.token_expiry_seconds


async def issue_id_token(
    db: AsyncSession, app: OAuthApp, user: "User", granted_scopes: List[str]
) -> str:
    now = datetime.now(timezone.utc)
    exp = int(now.timestamp()) + settings.token_expiry_seconds

    claims = {
        "iss": settings.issuer,
        "sub": str(user.id),
        "aud": app.client_id,
        "exp": exp,
        "iat": int(now.timestamp()),
    }

    if "email" in granted_scopes:
        claims["email"] = user.email
        claims["email_verified"] = True

    if "profile" in granted_scopes:
        claims["name"] = user.display_name
        claims["picture"] = user.avatar_url

    if "cohort" in granted_scopes:
        claims["cohort"] = user.cohort

    if "wallet" in granted_scopes:
        claims["wallet_address"] = user.wallet_address

    private_key = get_private_key()
    return jwt.encode(claims, private_key, algorithm="RS256", headers={"kid": get_kid()})


async def revoke_token(db: AsyncSession, token: str) -> bool:
    token_h = hash_token(token)
    result = await db.execute(select(AccessToken).where(AccessToken.token_hash == token_h))
    record = result.scalar_one_or_none()

    if not record:
        return True

    record.revoked = True
    await db.commit()
    return True
