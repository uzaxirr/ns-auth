from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services import scope_service

router = APIRouter(prefix="/api/scopes", tags=["scopes"])


@router.get(
    "/",
    summary="List available scopes",
    description="Returns all active OAuth scopes with their descriptions, claims, and icons.",
)
async def list_scopes(db: AsyncSession = Depends(get_db)):
    return await scope_service.get_all_scopes(db)
