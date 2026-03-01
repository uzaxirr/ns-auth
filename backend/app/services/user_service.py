from __future__ import annotations

from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


async def get_user_by_id(db: AsyncSession, user_id: UUID) -> Optional[User]:
    return await db.get(User, user_id)


async def get_user_by_discord_id(db: AsyncSession, discord_id: str) -> Optional[User]:
    result = await db.execute(select(User).where(User.discord_id == discord_id))
    return result.scalar_one_or_none()


async def get_or_create_user_from_discord(
    db: AsyncSession,
    discord_id: str,
    email: Optional[str] = None,
) -> User:
    user = await get_user_by_discord_id(db, discord_id)
    if user:
        if email and user.email != email:
            user.email = email
            await db.commit()
            await db.refresh(user)
        return user

    user = User(
        discord_id=discord_id,
        email=email,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user
