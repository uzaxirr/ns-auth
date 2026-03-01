from __future__ import annotations

import time
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Set

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.scope_definition import ScopeDefinition

# In-memory cache
_cache_data = None  # type: Optional[List[Dict]]
_cache_time = 0.0
_CACHE_TTL = 60.0  # seconds


def _invalidate_cache() -> None:
    global _cache_data, _cache_time
    _cache_data = None
    _cache_time = 0.0


def _scope_to_dict(scope: ScopeDefinition) -> Dict:
    return {
        "id": str(scope.id),
        "name": scope.name,
        "description": scope.description,
        "claims": scope.claims or [],
        "required_roles": scope.required_roles or [],
        "icon": scope.icon,
        "sort_order": scope.sort_order,
        "is_active": scope.is_active,
        "is_system": scope.is_system,
    }


async def get_all_scopes(db: AsyncSession, include_inactive: bool = False) -> List[Dict]:
    """Returns all scopes (cached for active-only queries)."""
    global _cache_data, _cache_time

    if not include_inactive and _cache_data is not None and (time.time() - _cache_time) < _CACHE_TTL:
        return _cache_data

    query = select(ScopeDefinition).order_by(ScopeDefinition.sort_order)
    if not include_inactive:
        query = query.where(ScopeDefinition.is_active == True)  # noqa: E712

    result = await db.execute(query)
    scopes = [_scope_to_dict(s) for s in result.scalars().all()]

    if not include_inactive:
        _cache_data = scopes
        _cache_time = time.time()

    return scopes


async def get_scope_by_name(db: AsyncSession, name: str) -> Optional[Dict]:
    """Single scope lookup by name."""
    result = await db.execute(
        select(ScopeDefinition).where(ScopeDefinition.name == name)
    )
    scope = result.scalar_one_or_none()
    return _scope_to_dict(scope) if scope else None


async def get_valid_scope_names(db: AsyncSession) -> Set[str]:
    """Set of active scope names (for validation)."""
    scopes = await get_all_scopes(db)
    return {s["name"] for s in scopes}


async def get_claims_for_scopes(
    db: AsyncSession,
    scope_names: List[str],
    user_roles: Optional[List] = None,
) -> List[str]:
    """Union of all claim names for given scopes, filtered by role requirements."""
    scopes = await get_all_scopes(db)
    claims = []  # type: List[str]
    seen = set()  # type: Set[str]

    # Extract role names from user_roles (can be list of dicts or list of strings)
    user_role_names = set()  # type: Set[str]
    if user_roles:
        for role in user_roles:
            if isinstance(role, dict):
                user_role_names.add(role.get("name", ""))
            else:
                user_role_names.add(str(role))

    for scope in scopes:
        if scope["name"] not in scope_names:
            continue

        # Role gating: skip if user doesn't have required roles
        required = scope.get("required_roles") or []
        if required and not user_role_names.intersection(set(required)):
            continue

        for claim in scope.get("claims", []):
            if claim not in seen:
                claims.append(claim)
                seen.add(claim)

    return claims


async def filter_scopes_by_roles(
    db: AsyncSession,
    scope_names: List[str],
    user_roles: Optional[List] = None,
) -> List[str]:
    """Returns only scopes the user qualifies for based on Discord roles."""
    scopes = await get_all_scopes(db)

    user_role_names = set()  # type: Set[str]
    if user_roles:
        for role in user_roles:
            if isinstance(role, dict):
                user_role_names.add(role.get("name", ""))
            else:
                user_role_names.add(str(role))

    qualified = []  # type: List[str]
    for scope in scopes:
        if scope["name"] not in scope_names:
            continue
        required = scope.get("required_roles") or []
        if not required or user_role_names.intersection(set(required)):
            qualified.append(scope["name"])

    return qualified


async def create_scope(
    db: AsyncSession,
    name: str,
    description: str,
    claims: List[str],
    required_roles: Optional[List[str]] = None,
    icon: Optional[str] = None,
    sort_order: int = 0,
    is_system: bool = False,
) -> Dict:
    """Create a new scope definition."""
    scope = ScopeDefinition(
        name=name,
        description=description,
        claims=claims,
        required_roles=required_roles or [],
        icon=icon,
        sort_order=sort_order,
        is_system=is_system,
    )
    db.add(scope)
    await db.commit()
    await db.refresh(scope)
    _invalidate_cache()
    return _scope_to_dict(scope)


async def update_scope(
    db: AsyncSession,
    scope_id: uuid.UUID,
    name: Optional[str] = None,
    description: Optional[str] = None,
    claims: Optional[List[str]] = None,
    required_roles: Optional[List[str]] = None,
    icon: Optional[str] = None,
    sort_order: Optional[int] = None,
    is_active: Optional[bool] = None,
) -> Optional[Dict]:
    """Update an existing scope definition."""
    scope = await db.get(ScopeDefinition, scope_id)
    if not scope:
        return None

    if name is not None:
        scope.name = name
    if description is not None:
        scope.description = description
    if claims is not None:
        scope.claims = claims
    if required_roles is not None:
        scope.required_roles = required_roles
    if icon is not None:
        scope.icon = icon
    if sort_order is not None:
        scope.sort_order = sort_order
    if is_active is not None:
        scope.is_active = is_active

    await db.commit()
    await db.refresh(scope)
    _invalidate_cache()
    return _scope_to_dict(scope)


async def deactivate_scope(db: AsyncSession, scope_id: uuid.UUID) -> Optional[Dict]:
    """Soft-delete a scope (set is_active=False)."""
    scope = await db.get(ScopeDefinition, scope_id)
    if not scope:
        return None
    if scope.is_system:
        return None  # Can't deactivate system scopes
    scope.is_active = False
    await db.commit()
    await db.refresh(scope)
    _invalidate_cache()
    return _scope_to_dict(scope)
