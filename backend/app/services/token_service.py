from __future__ import annotations

import secrets
import uuid
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Tuple

from jose import jwt
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.models.access_token import AccessToken
from app.models.oauth_app import OAuthApp
from app.models.refresh_token import RefreshToken
from app.security.hashing import hash_token, verify_client_secret
from app.security.keys import get_kid, get_private_key
from app.services import claim_service, discord_service, scope_service
from app.services.claim_resolver import resolve_claims


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

    # Check which claims need live Discord data
    discord_claim_names = await claim_service.get_discord_claim_names(db)
    discord_data = None

    if discord_claim_names and getattr(user, "discord_id", None):
        discord_data = await discord_service.get_live_member_data(user.discord_id)

    # Use live Discord roles for role-gated scope resolution
    user_roles = discord_data.get("roles") if discord_data else None

    # Resolve claims dynamically from DB-defined scopes
    claim_names = await scope_service.get_claims_for_scopes(
        db, granted_scopes, user_roles=user_roles
    )
    # Don't overwrite the JWT standard claims (sub is already set)
    resolved = resolve_claims(
        user,
        [c for c in claim_names if c != "sub"],
        discord_data=discord_data,
        discord_claim_names=discord_claim_names,
    )
    claims.update(resolved)

    private_key = get_private_key()
    return jwt.encode(claims, private_key, algorithm="RS256", headers={"kid": get_kid()})


async def issue_refresh_token(
    db: AsyncSession, app: OAuthApp, user_id: uuid.UUID, granted_scopes: List[str]
) -> Tuple[str, int]:
    token_value = secrets.token_urlsafe(48)
    jti = str(uuid.uuid4())
    expires_at = datetime.now(timezone.utc) + timedelta(seconds=settings.refresh_token_expiry_seconds)

    record = RefreshToken(
        token_hash=hash_token(token_value),
        jti=jti,
        client_id=app.client_id,
        user_id=user_id,
        scopes=granted_scopes,
        expires_at=expires_at,
        revoked=False,
    )
    db.add(record)
    await db.commit()

    return token_value, settings.refresh_token_expiry_seconds


async def exchange_refresh_token(
    db: AsyncSession, refresh_token_str: str, client_id: str
) -> Optional[Dict]:
    token_h = hash_token(refresh_token_str)
    result = await db.execute(
        select(RefreshToken).where(RefreshToken.token_hash == token_h)
    )
    record = result.scalar_one_or_none()

    if not record:
        return None
    if record.revoked:
        return None
    if record.expires_at < datetime.now(timezone.utc):
        return None
    if record.client_id != client_id:
        return None

    # Revoke old refresh token (rotation)
    record.revoked = True
    await db.flush()

    # Get the app for issuing new tokens
    from app.services.app_service import get_app_by_client_id
    app = await get_app_by_client_id(db, client_id)
    if not app:
        return None

    granted_scopes = list(record.scopes) if record.scopes else []

    # Issue new access token
    access_token, expires_in = await issue_user_token(db, app, record.user_id, granted_scopes)

    # Issue new refresh token (rotation)
    new_refresh_token, refresh_expires_in = await issue_refresh_token(db, app, record.user_id, granted_scopes)

    return {
        "access_token": access_token,
        "refresh_token": new_refresh_token,
        "token_type": "Bearer",
        "expires_in": expires_in,
        "scope": " ".join(granted_scopes),
        "user_id": record.user_id,
    }


async def revoke_token(db: AsyncSession, token: str) -> bool:
    token_h = hash_token(token)

    # Check access tokens
    result = await db.execute(select(AccessToken).where(AccessToken.token_hash == token_h))
    record = result.scalar_one_or_none()
    if record:
        record.revoked = True
        await db.commit()
        return True

    # Check refresh tokens
    result = await db.execute(select(RefreshToken).where(RefreshToken.token_hash == token_h))
    record = result.scalar_one_or_none()
    if record:
        record.revoked = True
        await db.commit()
        return True

    return True
