from __future__ import annotations

import os
import uuid
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request, UploadFile
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.schemas.oauth_app import OAuthAppResponse
from app.services import app_service
from app.services.session_service import get_session_user_id

router = APIRouter(prefix="/api/apps", tags=["uploads"])

ALLOWED_TYPES = {
    "image/png": "png",
    "image/jpeg": "jpg",
    "image/gif": "gif",
    "image/webp": "webp",
    # H5: SVG removed — stored XSS via <script> in SVG
}
MAX_SIZE = 2 * 1024 * 1024  # 2 MB

# L7: Magic byte signatures for file type validation
_MAGIC_BYTES = {
    "png": b"\x89PNG\r\n\x1a\n",
    "jpg": b"\xff\xd8\xff",
    "gif": (b"GIF87a", b"GIF89a"),
    "webp": b"RIFF",  # RIFF....WEBP
}


def _validate_magic(data: bytes, ext: str) -> bool:
    """Check file magic bytes match the claimed type."""
    magic = _MAGIC_BYTES.get(ext)
    if magic is None:
        return False
    if isinstance(magic, tuple):
        return any(data.startswith(m) for m in magic)
    if ext == "webp":
        return data[:4] == b"RIFF" and data[8:12] == b"WEBP"
    return data.startswith(magic)


@router.post(
    "/{app_id}/icon",
    response_model=OAuthAppResponse,
    summary="Upload app icon",
    description="Upload an icon for an OAuth app. Accepts PNG, JPEG, GIF, and WebP. Max file size: 2 MB. Replaces the existing icon if one exists.",
    responses={
        200: {"description": "Updated app with `icon_url`."},
        400: {"description": "File type not allowed or file too large."},
        404: {"description": "App not found."},
    },
)
async def upload_icon(
    app_id: uuid.UUID,
    file: UploadFile,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    # H5: Require authentication
    if not get_session_user_id(request):
        raise HTTPException(status_code=401, detail="Authentication required")

    app = await app_service.get_app(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="App not found")

    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=400,
            detail=f"File type {file.content_type} not allowed. Use png, jpg, gif, or webp.",
        )

    data = await file.read()
    if len(data) > MAX_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Max size is 2 MB.")

    ext = ALLOWED_TYPES[file.content_type]

    # L7: Validate magic bytes match claimed content type
    if not _validate_magic(data, ext):
        raise HTTPException(status_code=400, detail="File content does not match declared type.")
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


@router.delete(
    "/{app_id}/icon",
    response_model=OAuthAppResponse,
    summary="Delete app icon",
    description="Removes the icon from an OAuth app and deletes the file from storage.",
    responses={
        200: {"description": "Updated app with `icon_url: null`."},
        404: {"description": "App not found."},
    },
)
async def delete_icon(
    app_id: uuid.UUID,
    request: Request,
    db: AsyncSession = Depends(get_db),
):
    # H5: Require authentication
    if not get_session_user_id(request):
        raise HTTPException(status_code=401, detail="Authentication required")

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
