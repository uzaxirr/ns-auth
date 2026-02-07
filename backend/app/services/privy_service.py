from __future__ import annotations

import time
from typing import Any, Dict, Optional

import httpx
from jose import JWTError, jwt

from app.config import settings

_jwks_cache: Optional[Dict[str, Any]] = None
_jwks_cache_time: float = 0
JWKS_CACHE_TTL = 3600  # 1 hour


async def _fetch_privy_jwks() -> Dict[str, Any]:
    global _jwks_cache, _jwks_cache_time

    now = time.time()
    if _jwks_cache and (now - _jwks_cache_time) < JWKS_CACHE_TTL:
        return _jwks_cache

    url = f"https://auth.privy.io/api/v1/apps/{settings.privy_app_id}/jwks.json"
    async with httpx.AsyncClient() as client:
        resp = await client.get(url)
        resp.raise_for_status()
        _jwks_cache = resp.json()
        _jwks_cache_time = now
        return _jwks_cache


async def verify_privy_token(token: str) -> Optional[Dict[str, Any]]:
    try:
        jwks = await _fetch_privy_jwks()

        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")

        matching_key = None
        for key in jwks.get("keys", []):
            if key.get("kid") == kid:
                matching_key = key
                break

        if not matching_key:
            return None

        payload = jwt.decode(
            token,
            matching_key,
            algorithms=["ES256"],
            audience=settings.privy_app_id,
            issuer="privy.io",
        )
        return payload

    except (JWTError, httpx.HTTPError, Exception):
        return None


async def get_privy_user(privy_did: str) -> Optional[Dict[str, Any]]:
    """Fetch user details from Privy Server API by DID."""
    try:
        import base64
        credentials = base64.b64encode(
            f"{settings.privy_app_id}:{settings.privy_app_secret}".encode()
        ).decode()

        async with httpx.AsyncClient() as client:
            resp = await client.get(
                f"https://auth.privy.io/api/v1/users/{privy_did}",
                headers={
                    "Authorization": f"Basic {credentials}",
                    "privy-app-id": settings.privy_app_id,
                },
            )
            if resp.status_code == 200:
                return resp.json()
            return None
    except Exception:
        return None
