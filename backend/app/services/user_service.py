from __future__ import annotations

from typing import Optional
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.user import User


async def get_user_by_id(db: AsyncSession, user_id: UUID) -> Optional[User]:
    return await db.get(User, user_id)


async def get_user_by_privy_did(db: AsyncSession, privy_did: str) -> Optional[User]:
    result = await db.execute(select(User).where(User.privy_did == privy_did))
    return result.scalar_one_or_none()


async def get_or_create_user_from_privy(
    db: AsyncSession,
    privy_did: str,
    email: Optional[str] = None,
    display_name: Optional[str] = None,
) -> User:
    user = await get_user_by_privy_did(db, privy_did)
    if user:
        if email and user.email != email:
            user.email = email
        if display_name and user.display_name != display_name:
            user.display_name = display_name
        await db.commit()
        await db.refresh(user)
        return user

    user = User(
        privy_did=privy_did,
        email=email,
        display_name=display_name or email,
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)
    return user
