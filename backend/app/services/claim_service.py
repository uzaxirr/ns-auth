from __future__ import annotations

import time
import uuid
from typing import Dict, List, Optional, Set

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.claim_definition import ClaimDefinition

# In-memory cache
_cache_data = None  # type: Optional[List[Dict]]
_cache_time = 0.0
_CACHE_TTL = 60.0  # seconds


def _invalidate_cache():
    # type: () -> None
    global _cache_data, _cache_time
    _cache_data = None
    _cache_time = 0.0


def _claim_to_dict(claim):
    # type: (ClaimDefinition) -> Dict
    return {
        "id": str(claim.id),
        "name": claim.name,
        "label": claim.label,
        "description": claim.description,
        "source": claim.source,
        "is_active": claim.is_active,
        "created_at": claim.created_at.isoformat() if claim.created_at else None,
    }


async def get_all_claims(db, include_inactive=False):
    # type: (AsyncSession, bool) -> List[Dict]
    global _cache_data, _cache_time

    if not include_inactive and _cache_data is not None and (time.time() - _cache_time) < _CACHE_TTL:
        return _cache_data

    query = select(ClaimDefinition).order_by(ClaimDefinition.name)
    if not include_inactive:
        query = query.where(ClaimDefinition.is_active == True)  # noqa: E712

    result = await db.execute(query)
    claims = [_claim_to_dict(c) for c in result.scalars().all()]

    if not include_inactive:
        _cache_data = claims
        _cache_time = time.time()

    return claims


async def get_active_claim_names(db):
    # type: (AsyncSession) -> Set[str]
    claims = await get_all_claims(db)
    return {c["name"] for c in claims}


async def get_discord_claim_names(db):
    # type: (AsyncSession) -> Set[str]
    """Return claim names where source='discord'. Uses existing 60s cache."""
    claims = await get_all_claims(db)
    return {c["name"] for c in claims if c.get("source") == "discord"}


async def create_claim(db, name, label, description="", source="model"):
    # type: (AsyncSession, str, str, str, str) -> Dict
    claim = ClaimDefinition(
        name=name,
        label=label,
        description=description,
        source=source,
    )
    db.add(claim)
    await db.commit()
    await db.refresh(claim)
    _invalidate_cache()
    return _claim_to_dict(claim)


async def update_claim(db, claim_id, **kwargs):
    # type: (AsyncSession, uuid.UUID, ...) -> Optional[Dict]
    claim = await db.get(ClaimDefinition, claim_id)
    if not claim:
        return None

    for key in ("label", "description", "source", "is_active"):
        if key in kwargs and kwargs[key] is not None:
            setattr(claim, key, kwargs[key])

    await db.commit()
    await db.refresh(claim)
    _invalidate_cache()
    return _claim_to_dict(claim)


async def deactivate_claim(db, claim_id):
    # type: (AsyncSession, uuid.UUID) -> Optional[Dict]
    claim = await db.get(ClaimDefinition, claim_id)
    if not claim:
        return None
    claim.is_active = False
    await db.commit()
    await db.refresh(claim)
    _invalidate_cache()
    return _claim_to_dict(claim)
