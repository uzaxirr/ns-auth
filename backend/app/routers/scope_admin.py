from __future__ import annotations

import os
import uuid as uuid_mod
from pathlib import Path
from typing import List, Optional
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.services import scope_service, user_service, claim_service
from app.services import claim_resolver
from app.services.session_service import get_session_user_id

router = APIRouter(prefix="/api/admin", tags=["admin"])

ALLOWED_ICON_TYPES = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
}
MAX_ICON_SIZE = 2 * 1024 * 1024  # 2 MB


def require_session(request: Request) -> UUID:
    user_id = get_session_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user_id


async def _require_admin(db: AsyncSession, user_id: UUID) -> None:
    user = await user_service.get_user_by_id(db, user_id)
    if not user or not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")


# ── Scope models ──────────────────────────────────────────────────────

class ScopeCreate(BaseModel):
    name: str = Field(..., max_length=50)
    description: str = Field(..., max_length=255)
    claims: List[str] = Field(default_factory=list)
    required_roles: List[str] = Field(default_factory=list)
    icon: Optional[str] = Field(None, max_length=255)
    sort_order: int = Field(0)


class ScopeUpdate(BaseModel):
    name: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = Field(None, max_length=255)
    claims: Optional[List[str]] = None
    required_roles: Optional[List[str]] = None
    icon: Optional[str] = Field(None, max_length=255)
    sort_order: Optional[int] = None
    is_active: Optional[bool] = None


# ── Claim models ──────────────────────────────────────────────────────

class ClaimCreate(BaseModel):
    name: str = Field(..., max_length=50)
    label: str = Field(..., max_length=100)
    description: str = Field("", max_length=255)
    source: str = Field("model", max_length=20)


class ClaimUpdate(BaseModel):
    label: Optional[str] = Field(None, max_length=100)
    description: Optional[str] = Field(None, max_length=255)
    source: Optional[str] = Field(None, max_length=20)
    is_active: Optional[bool] = None


# ── Scope endpoints ──────────────────────────────────────────────────

@router.get(
    "/scopes/",
    summary="List all scopes (admin)",
    description="Returns all scope definitions including inactive ones.",
)
async def list_admin_scopes(
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(require_session),
):
    await _require_admin(db, user_id)
    return await scope_service.get_all_scopes(db, include_inactive=True)


@router.get(
    "/scopes/available-claims",
    summary="List available claim names",
    description="Returns all active claim names that can be assigned to scopes.",
)
async def available_claims(
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(require_session),
):
    await _require_admin(db, user_id)
    return await claim_resolver.get_available_claim_names(db)


@router.post(
    "/scopes/",
    summary="Create a scope (admin)",
    status_code=201,
)
async def create_scope(
    body: ScopeCreate,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(require_session),
):
    await _require_admin(db, user_id)
    existing = await scope_service.get_scope_by_name(db, body.name)
    if existing:
        raise HTTPException(status_code=409, detail=f"Scope '{body.name}' already exists")
    return await scope_service.create_scope(
        db,
        name=body.name,
        description=body.description,
        claims=body.claims,
        required_roles=body.required_roles,
        icon=body.icon,
        sort_order=body.sort_order,
    )


@router.patch(
    "/scopes/{scope_id}",
    summary="Update a scope (admin)",
)
async def update_scope(
    scope_id: UUID,
    body: ScopeUpdate,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(require_session),
):
    await _require_admin(db, user_id)
    update_data = body.dict(exclude_unset=True)
    result = await scope_service.update_scope(db, scope_id, **update_data)
    if not result:
        raise HTTPException(status_code=404, detail="Scope not found")
    return result


@router.delete(
    "/scopes/{scope_id}",
    summary="Deactivate a scope (admin)",
)
async def deactivate_scope(
    scope_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(require_session),
):
    await _require_admin(db, user_id)
    result = await scope_service.deactivate_scope(db, scope_id)
    if result is None:
        raise HTTPException(
            status_code=400,
            detail="Scope not found or is a system scope that cannot be deactivated",
        )
    return result


@router.post(
    "/scopes/{scope_id}/icon",
    summary="Upload a custom icon for a scope",
)
async def upload_scope_icon(
    scope_id: UUID,
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(require_session),
):
    await _require_admin(db, user_id)

    if file.content_type not in ALLOWED_ICON_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"File type {file.content_type} not allowed. Use png, jpg, gif, webp, or svg.",
        )

    data = await file.read()
    if len(data) > MAX_ICON_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Max size is 2 MB.")

    ext = ALLOWED_ICON_TYPES[file.content_type]
    filename = f"{uuid_mod.uuid4()}.{ext}"
    filepath = Path(settings.uploads_dir) / filename
    filepath.parent.mkdir(parents=True, exist_ok=True)
    filepath.write_bytes(data)

    from app.models.scope_definition import ScopeDefinition
    scope = await db.get(ScopeDefinition, scope_id)
    if not scope:
        os.remove(filepath)
        raise HTTPException(status_code=404, detail="Scope not found")

    # Delete old uploaded icon if exists
    if scope.icon and scope.icon.startswith("/uploads/"):
        old_path = Path(settings.uploads_dir) / scope.icon.split("/uploads/", 1)[1]
        if old_path.exists():
            os.remove(old_path)

    scope.icon = f"/uploads/{filename}"
    await db.commit()
    await db.refresh(scope)
    return scope_service._scope_to_dict(scope)


# ── Claims endpoints ─────────────────────────────────────────────────

@router.get(
    "/claims",
    summary="List all claim definitions",
    description="Returns all claim definitions including inactive ones.",
)
async def list_claims(
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(require_session),
):
    await _require_admin(db, user_id)
    return await claim_service.get_all_claims(db, include_inactive=True)


@router.post(
    "/claims",
    summary="Create a claim definition",
    status_code=201,
)
async def create_claim(
    body: ClaimCreate,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(require_session),
):
    await _require_admin(db, user_id)
    try:
        return await claim_service.create_claim(
            db, name=body.name, label=body.label,
            description=body.description, source=body.source,
        )
    except Exception:
        raise HTTPException(status_code=409, detail=f"Claim '{body.name}' already exists")


@router.patch(
    "/claims/{claim_id}",
    summary="Update a claim definition",
)
async def update_claim(
    claim_id: UUID,
    body: ClaimUpdate,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(require_session),
):
    await _require_admin(db, user_id)
    update_data = body.dict(exclude_unset=True)
    result = await claim_service.update_claim(db, claim_id, **update_data)
    if not result:
        raise HTTPException(status_code=404, detail="Claim not found")
    return result


@router.delete(
    "/claims/{claim_id}",
    summary="Deactivate a claim definition",
)
async def deactivate_claim(
    claim_id: UUID,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(require_session),
):
    await _require_admin(db, user_id)
    result = await claim_service.deactivate_claim(db, claim_id)
    if not result:
        raise HTTPException(status_code=404, detail="Claim not found")
    return result


# ── Roles endpoint ───────────────────────────────────────────────────

@router.get(
    "/roles",
    summary="List available Discord roles",
    description="Returns all role names from the NS Discord guild via bot API.",
)
async def list_roles(
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(require_session),
):
    await _require_admin(db, user_id)
    from app.services import discord_service
    guild_roles = await discord_service.get_guild_roles()
    # Return sorted role names, excluding @everyone
    return sorted(name for name in guild_roles.values() if name != "@everyone")
