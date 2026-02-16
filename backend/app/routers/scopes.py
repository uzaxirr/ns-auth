from __future__ import annotations

from fastapi import APIRouter

from app.scopes import AVAILABLE_SCOPES

router = APIRouter(prefix="/api/scopes", tags=["scopes"])


@router.get(
    "/",
    summary="List available scopes",
    description="Returns all available OAuth scopes with their descriptions and the claims each scope grants access to.",
)
async def list_scopes():
    return AVAILABLE_SCOPES
