"""Seed a test user with NS-like data into the database."""
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
            # Update with NS data in case it was JIT-provisioned bare
            existing.privy_did = "did:privy:cmlcrlg2502hlju0c3jfxalyu"
            existing.display_name = "Alice Nakamoto"
            existing.avatar_url = "https://api.dicebear.com/9.x/notionists/svg?seed=alice"
            existing.cohort = "NS-7"
            existing.bio = "Building the future of decentralized identity. NS resident since 2024."
            existing.socials = {
                "twitter": "https://x.com/alicenakamoto",
                "github": "https://github.com/alicenakamoto",
                "linkedin": "https://linkedin.com/in/alicenakamoto",
                "website": "https://alice.ns.com",
            }
            existing.wallet_address = "0xa4E14768CE37942eB860b22C17FBee3988d5b728"
            await db.commit()
            print("Updated existing user with NS data.")
            return

        # Create new test user matching real Privy user
        user = User(
            id=uuid.uuid4(),
            privy_did="did:privy:cmlcrlg2502hlju0c3jfxalyu",
            email="alice@networkschool.com",
            display_name="Alice Nakamoto",
            avatar_url="https://api.dicebear.com/9.x/notionists/svg?seed=alice",
            cohort="NS-7",
            bio="Building the future of decentralized identity. NS resident since 2024.",
            socials={
                "twitter": "https://x.com/alicenakamoto",
                "github": "https://github.com/alicenakamoto",
                "linkedin": "https://linkedin.com/in/alicenakamoto",
                "website": "https://alice.ns.com",
            },
            wallet_address="0xa4E14768CE37942eB860b22C17FBee3988d5b728",
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
        print(f"Created test user: {user.email} (id={user.id})")
        print(f"  Name:    {user.display_name}")
        print(f"  Cohort:  {user.cohort}")
        print(f"  Wallet:  {user.wallet_address}")
        print(f"  Socials: {user.socials}")


if __name__ == "__main__":
    asyncio.run(seed())
