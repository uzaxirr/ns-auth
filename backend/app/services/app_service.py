from __future__ import annotations

from typing import List, Optional, Tuple
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.oauth_app import OAuthApp
from app.security.hashing import generate_client_id, generate_client_secret, hash_client_secret


async def create_app(
    db: AsyncSession,
    name: str,
    description: Optional[str],
    scopes: List[str],
    redirect_uris: List[str],
) -> Tuple[OAuthApp, str]:
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


async def delete_app(db: AsyncSession, app_id: UUID) -> bool:
    app = await db.get(OAuthApp, app_id)
    if not app:
        return False
    await db.delete(app)
    await db.commit()
    return True
