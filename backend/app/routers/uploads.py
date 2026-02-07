from __future__ import annotations

import os
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.schemas.oauth_app import OAuthAppResponse
from app.services import app_service

router = APIRouter(prefix="/api/apps", tags=["uploads"])

ALLOWED_TYPES = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    "image/svg+xml": "svg",
}
MAX_SIZE = 2 * 1024 * 1024  # 2 MB


@router.post("/{app_id}/icon", response_model=OAuthAppResponse)
async def upload_icon(
    app_id: uuid.UUID,
    file: UploadFile,
    db: AsyncSession = Depends(get_db),
):
    app = await app_service.get_app(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="App not found")

    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"File type {file.content_type} not allowed. Use png, jpg, gif, webp, or svg.",
        )

    data = await file.read()
    if len(data) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Max size is 2 MB.")

    ext = ALLOWED_TYPES[file.content_type]
    filename = f"{uuid.uuid4()}.{ext}"
    filepath = Path(settings.uploads_dir) / filename

    filepath.parent.mkdir(parents=True, exist_ok=True)
    filepath.write_bytes(data)

    # Delete old icon file if it was an upload
    _delete_old_icon(app.icon_url)

    app.icon_url = f"/uploads/{filename}"
    await db.commit()
    await db.refresh(app)
    return app


@router.delete("/{app_id}/icon", response_model=OAuthAppResponse)
async def delete_icon(
    app_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
):
    app = await app_service.get_app(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="App not found")

    _delete_old_icon(app.icon_url)

    app.icon_url = None
    await db.commit()
    await db.refresh(app)
    return app


def _delete_old_icon(icon_url: Optional[str]) -> None:
    if not icon_url or not icon_url.startswith("/uploads/"):
        return
    old_path = Path(settings.uploads_dir) / icon_url.split("/uploads/", 1)[1]
    if old_path.exists():
        os.remove(old_path)
