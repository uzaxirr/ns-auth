from __future__ import annotations

import logging
import time
from typing import Any, Dict, List, Optional, Tuple
from urllib.parse import urlencode

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

DISCORD_API = "https://discord.com/api/v10"
DISCORD_OAUTH_SCOPES = "identify email guilds.members.read"

# In-memory TTL caches
_member_cache = {}  # type: Dict[str, Tuple[float, Dict[str, Any]]]
_guild_roles_cache = None  # type: Optional[Tuple[float, Dict[str, str]]]


def get_authorize_url(state: str) -> str:
    """Build the Discord OAuth2 authorization URL."""
    params = {
        "client_id": settings.discord_client_id,
        "redirect_uri": settings.discord_redirect_uri,
        "response_type": "code",
        "scope": DISCORD_OAUTH_SCOPES,
        "state": state,
        "prompt": "consent",
    }
    return f"https://discord.com/oauth2/authorize?{urlencode(params)}"


async def exchange_code(code: str) -> Optional[Dict[str, Any]]:
    """Exchange an authorization code for Discord tokens."""
    async with httpx.AsyncClient() as client:
        resp = await client.post(
            f"{DISCORD_API}/oauth2/token",
            data={
                "client_id": settings.discord_client_id,
                "client_secret": settings.discord_client_secret,
                "grant_type": "authorization_code",
                "code": code,
                "redirect_uri": settings.discord_redirect_uri,
            },
            headers={"Content-Type": "application/x-www-form-urlencoded"},
        )
        if resp.status_code != 200:
            return None
        return resp.json()


async def get_user(access_token: str) -> Optional[Dict[str, Any]]:
    """Fetch the authenticated Discord user's profile."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{DISCORD_API}/users/@me",
            headers={"Authorization": f"Bearer {access_token}"},
        )
        if resp.status_code != 200:
            return None
        return resp.json()


async def check_guild_membership(user_id: str) -> bool:
    """Check if a user is a member of the NS Discord guild (uses bot token)."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{DISCORD_API}/guilds/{settings.discord_guild_id}/members/{user_id}",
            headers={"Authorization": f"Bot {settings.discord_bot_token}"},
        )
        return resp.status_code == 200


async def get_guild_roles() -> Dict[str, str]:
    """Fetch guild role ID→name mapping via bot token (cached with TTL)."""
    global _guild_roles_cache

    now = time.time()
    if _guild_roles_cache is not None:
        cached_at, cached_data = _guild_roles_cache
        if (now - cached_at) < settings.discord_cache_ttl_seconds:
            return cached_data

    async with httpx.AsyncClient(timeout=5.0) as client:
        resp = await client.get(
            f"{DISCORD_API}/guilds/{settings.discord_guild_id}/roles",
            headers={"Authorization": f"Bot {settings.discord_bot_token}"},
        )
        if resp.status_code != 200:
            # Return stale cache if available, else empty
            if _guild_roles_cache is not None:
                return _guild_roles_cache[1]
            return {}
        roles = resp.json()
        result = {r["id"]: r["name"] for r in roles}
        _guild_roles_cache = (now, result)
        return result


async def get_member_roles(user_id: str) -> List[Dict[str, str]]:
    """Get a guild member's roles as objects with id and name."""
    async with httpx.AsyncClient() as client:
        resp = await client.get(
            f"{DISCORD_API}/guilds/{settings.discord_guild_id}/members/{user_id}",
            headers={"Authorization": f"Bot {settings.discord_bot_token}"},
        )
        if resp.status_code != 200:
            return []
        member = resp.json()
        role_ids = member.get("roles", [])

    # Resolve role names from guild roles
    guild_roles = await get_guild_roles()
    return [
        {"id": rid, "name": guild_roles.get(rid, rid)}
        for rid in role_ids
    ]


def build_avatar_url(user_id: str, avatar_hash: Optional[str]) -> Optional[str]:
    """Construct the Discord CDN avatar URL."""
    if not avatar_hash:
        # Default avatar based on user discriminator/id
        index = (int(user_id) >> 22) % 6
        return f"https://cdn.discordapp.com/embed/avatars/{index}.png"
    ext = "gif" if avatar_hash.startswith("a_") else "png"
    return f"https://cdn.discordapp.com/avatars/{user_id}/{avatar_hash}.{ext}"


def _build_banner_url(user_id: str, banner_hash: Optional[str]) -> Optional[str]:
    """Construct the Discord CDN banner URL."""
    if not banner_hash:
        return None
    ext = "gif" if banner_hash.startswith("a_") else "png"
    return f"https://cdn.discordapp.com/banners/{user_id}/{banner_hash}.{ext}?size=600"


# Discord public_flags → human-readable badge names
_PUBLIC_FLAG_NAMES = {
    0: "Discord Staff",
    1: "Partnered Server Owner",
    2: "HypeSquad Events",
    3: "Bug Hunter Level 1",
    6: "HypeSquad Bravery",
    7: "HypeSquad Brilliance",
    8: "HypeSquad Balance",
    9: "Early Nitro Supporter",
    14: "Bug Hunter Level 2",
    17: "Early Verified Bot Developer",
    18: "Certified Moderator",
    22: "Active Developer",
}


def _parse_public_flags(flags: Optional[int]) -> List[str]:
    """Convert public_flags bitfield to list of badge names."""
    if not flags:
        return []
    return [name for bit, name in _PUBLIC_FLAG_NAMES.items() if flags & (1 << bit)]


async def get_live_member_data(discord_id: str) -> Optional[Dict[str, Any]]:
    """Fetch live member data from Discord API with per-user TTL cache.

    Returns a dict with all Discord-sourced claims or None on failure.
    One API call serves all Discord-sourced claims (roles, name, picture,
    username, joined_at, boosting, banner, accent_color, badges).
    """
    now = time.time()
    cached = _member_cache.get(discord_id)
    if cached is not None:
        cached_at, cached_data = cached
        if (now - cached_at) < settings.discord_cache_ttl_seconds:
            return cached_data

    if not settings.discord_bot_token or not settings.discord_guild_id:
        return None

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(
                f"{DISCORD_API}/guilds/{settings.discord_guild_id}/members/{discord_id}",
                headers={"Authorization": f"Bot {settings.discord_bot_token}"},
            )
            if resp.status_code != 200:
                logger.warning("Discord member fetch failed for %s: %s", discord_id, resp.status_code)
                return None

            member = resp.json()
    except Exception:
        logger.exception("Discord API error fetching member %s", discord_id)
        return None

    user_obj = member.get("user") or {}

    # Resolve role names
    guild_roles = await get_guild_roles()
    role_ids = member.get("roles", [])
    roles = [{"id": rid, "name": guild_roles.get(rid, rid)} for rid in role_ids]

    # Display name: nick > user.global_name > user.username
    display_name = member.get("nick") or ""
    if not display_name:
        display_name = user_obj.get("global_name") or user_obj.get("username") or ""

    # Avatar: guild-specific avatar > user avatar
    guild_avatar = member.get("avatar")
    if guild_avatar:
        ext = "gif" if guild_avatar.startswith("a_") else "png"
        avatar_url = f"https://cdn.discordapp.com/guilds/{settings.discord_guild_id}/users/{discord_id}/avatars/{guild_avatar}.{ext}"
    else:
        avatar_url = build_avatar_url(discord_id, user_obj.get("avatar"))

    result = {
        # Existing claims
        "roles": roles,
        "display_name": display_name,
        "avatar_url": avatar_url,
        # New claims from Guild Member object
        "discord_username": user_obj.get("username"),
        "discord_joined_at": member.get("joined_at"),
        "boosting_since": member.get("premium_since"),
        # New claims from nested User object
        "banner_url": _build_banner_url(discord_id, user_obj.get("banner")),
        "accent_color": "#{:06x}".format(user_obj["accent_color"]) if user_obj.get("accent_color") else None,
        "public_badges": _parse_public_flags(user_obj.get("public_flags")),
    }
    _member_cache[discord_id] = (now, result)
    return result


def invalidate_member_cache(discord_id: str) -> None:
    """Remove a user's cached member data (call on login to force fresh data)."""
    _member_cache.pop(discord_id, None)
