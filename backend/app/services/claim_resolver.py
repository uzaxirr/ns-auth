from __future__ import annotations

from typing import Dict, List, Optional, Set

from sqlalchemy.ext.asyncio import AsyncSession

# Maps claim names to keys in the Discord live-fetch data dict.
# Used to overlay fresh Discord data over stale DB values.
DISCORD_CLAIM_KEYS = {
    "roles": "roles",
    "name": "display_name",
    "picture": "avatar_url",
    "discord_username": "discord_username",
    "discord_joined_at": "discord_joined_at",
    "boosting_since": "boosting_since",
    "banner_url": "banner_url",
    "accent_color": "accent_color",
    "public_badges": "public_badges",
}

# Maps claim names to lambdas that extract values from a User object.
# Only claims backed by actual User model columns (id, email, created_at).
# All other claims come from live Discord data — no DB fallback.
CLAIM_RESOLVERS = {
    "sub": lambda u: str(u.id),
    "email": lambda u: u.email,
    "email_verified": lambda u: True if u.email else False,
    "date_joined": lambda u: u.created_at.isoformat() if u.created_at else None,
}


def resolve_claims(
    user,  # type: object
    claim_names,  # type: List[str]
    discord_data=None,  # type: Optional[Dict]
    discord_claim_names=None,  # type: Optional[Set[str]]
):
    # type: (...) -> Dict
    """Build a claims dict by resolving each claim name against the user.

    1. If the claim is Discord-sourced and live data is available, use it.
    2. If the claim has a built-in resolver in CLAIM_RESOLVERS, use it (DB columns).
    3. Otherwise, skip — no user data is stored in the DB beyond identity.
    """
    result = {}
    _discord_claims = discord_claim_names or set()

    for name in claim_names:
        # Try live Discord data first for Discord-sourced claims
        if name in _discord_claims and discord_data is not None:
            discord_key = DISCORD_CLAIM_KEYS.get(name)
            if discord_key and discord_key in discord_data:
                result[name] = discord_data[discord_key]
                continue

        # Fall back to model resolver (only sub, email, email_verified, date_joined)
        resolver = CLAIM_RESOLVERS.get(name)
        if resolver is not None:
            result[name] = resolver(user)

    return result


async def get_available_claim_names(db: AsyncSession) -> List[str]:
    """Return all claim names that are registered and active in claim_definitions.

    The claim_definitions table is the source of truth for what claims
    exist and are available to assign to scopes. CLAIM_RESOLVERS stays
    as the extraction logic (how to get a value from a User).
    """
    from app.services.claim_service import get_active_claim_names
    names = await get_active_claim_names(db)
    return sorted(names)
