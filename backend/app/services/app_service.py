from __future__ import annotations

from typing import List, Optional, Tuple
from uuid import UUID

from fastapi import HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.oauth_app import OAuthApp
from app.services import scope_service
from app.security.hashing import generate_client_id, generate_client_secret, hash_client_secret


async def _validate_scopes(db: AsyncSession, scopes: List[str]) -> None:
    valid = await scope_service.get_valid_scope_names(db)
    invalid = set(scopes) - valid
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
    owner_id: Optional[UUID] = None,
) -> Tuple[OAuthApp, str]:
    await _validate_scopes(db, scopes)
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
        owner_id=owner_id,
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
        await _validate_scopes(db, scopes)
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


async def update_app_status(
    db: AsyncSession, app_id: UUID, status: str
) -> Optional[OAuthApp]:
    from app.models.oauth_app import APP_STATUSES
    if status not in APP_STATUSES:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid status: {status}. Must be one of: {', '.join(APP_STATUSES)}",
        )
    app = await db.get(OAuthApp, app_id)
    if not app:
        return None
    app.status = status
    await db.commit()
    await db.refresh(app)
    return app


async def list_apps_by_status(db: AsyncSession, status: str) -> List[OAuthApp]:
    result = await db.execute(
        select(OAuthApp).where(OAuthApp.status == status).order_by(OAuthApp.created_at.desc())
    )
    return list(result.scalars().all())


async def delete_app(db: AsyncSession, app_id: UUID) -> bool:
    app = await db.get(OAuthApp, app_id)
    if not app:
        return False
    await db.delete(app)
    await db.commit()
    return True
