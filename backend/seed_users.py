"""Seed a test user into the database."""
from __future__ import annotations

import asyncio
import uuid

from sqlalchemy import select

from app.database import async_session
from app.models.user import User


async def seed():
    async with async_session() as db:
        # Check if test user already exists
        result = await db.execute(
            select(User).where(User.email == "alice@networkschool.com")
        )
        existing = result.scalar_one_or_none()
        if existing:
            print(f"User already exists: {existing.email} (id={existing.id})")
            existing.discord_id = "123456789012345678"
            await db.commit()
            print("Updated existing user.")
            return

        # Create new test user (only identity fields — all profile data comes from Discord live)
        user = User(
            id=uuid.uuid4(),
            discord_id="123456789012345678",
            email="alice@networkschool.com",
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        print(f"Created test user: {user.email} (id={user.id})")
        print(f"  Discord ID: {user.discord_id}")
        print(f"  All profile data (name, avatar, roles) fetched live from Discord API")


if __name__ == "__main__":
    asyncio.run(seed())
