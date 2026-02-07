from __future__ import annotations

from typing import List, Optional, Tuple
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.oauth_app import OAuthApp
from app.scopes import VALID_SCOPE_NAMES
from app.security.hashing import generate_client_id, generate_client_secret, hash_client_secret


def _validate_scopes(scopes: List[str]) -> None:
    invalid = set(scopes) - VALID_SCOPE_NAMES
    if invalid:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid scopes: {', '.join(sorted(invalid))}",
        )


async def create_app(
    db: AsyncSession,
    name: str,
    description: Optional[str],
    scopes: List[str],
    redirect_uris: List[str],
    icon_url: Optional[str] = None,
    privacy_policy_url: Optional[str] = None,
) -> Tuple[OAuthApp, str]:
    _validate_scopes(scopes)
    client_id = generate_client_id()
    client_secret = generate_client_secret()
    secret_hash = hash_client_secret(client_secret)

    app = OAuthApp(
        name=name,
        description=description,
        client_id=client_id,
        client_secret_hash=secret_hash,
        scopes=scopes,
        redirect_uris=redirect_uris,
        icon_url=icon_url,
        privacy_policy_url=privacy_policy_url,
    )
    db.add(app)
    await db.commit()
    await db.refresh(app)
    return app, client_secret


async def list_apps(db: AsyncSession) -> List[OAuthApp]:
    result = await db.execute(select(OAuthApp).order_by(OAuthApp.created_at.desc()))
    return list(result.scalars().all())


async def get_app(db: AsyncSession, app_id: UUID) -> Optional[OAuthApp]:
    return await db.get(OAuthApp, app_id)


async def get_app_by_client_id(db: AsyncSession, client_id: str) -> Optional[OAuthApp]:
    result = await db.execute(select(OAuthApp).where(OAuthApp.client_id == client_id))
    return result.scalar_one_or_none()


async def update_app(
    db: AsyncSession,
    app_id: UUID,
    name: Optional[str] = None,
    description: Optional[str] = None,
    scopes: Optional[List[str]] = None,
    redirect_uris: Optional[List[str]] = None,
    icon_url: Optional[str] = None,
    privacy_policy_url: Optional[str] = None,
) -> Optional[OAuthApp]:
    app = await db.get(OAuthApp, app_id)
    if not app:
        return None
    if scopes is not None:
        _validate_scopes(scopes)
    if name is not None:
        app.name = name
    if description is not None:
        app.description = description
    if scopes is not None:
        app.scopes = scopes
    if redirect_uris is not None:
        app.redirect_uris = redirect_uris
    if icon_url is not None:
        app.icon_url = icon_url
    if privacy_policy_url is not None:
        app.privacy_policy_url = privacy_policy_url
    await db.commit()
    await db.refresh(app)
    return app


async def delete_app(db: AsyncSession, app_id: UUID) -> bool:
    app = await db.get(OAuthApp, app_id)
    if not app:
        return False
    await db.delete(app)
    await db.commit()
    return True
