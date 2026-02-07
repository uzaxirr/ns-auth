from __future__ import annotations

from fastapi import APIRouter

from app.scopes import AVAILABLE_SCOPES

router = APIRouter(prefix="/api/scopes", tags=["scopes"])


@router.get("/")
async def list_scopes():
    return AVAILABLE_SCOPES
