from __future__ import annotations

from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.schemas.oauth_app import OAuthAppCreate, OAuthAppCreated, OAuthAppResponse, OAuthAppUpdate
from app.services import app_service, user_service
from app.services.session_service import get_session_user_id

router = APIRouter(prefix="/api/apps", tags=["apps"])


def require_session(request: Request) -> UUID:
    """Dependency that requires a valid session cookie. Returns the user ID."""
    user_id = get_session_user_id(request)
    if not user_id:
        raise HTTPException(status_code=401, detail="Not authenticated")
    return user_id


class StatusUpdate(BaseModel):
    status: str


@router.post(
    "/",
    response_model=OAuthAppCreated,
    status_code=201,
    summary="Register a new OAuth app",
    description="Creates a new OAuth client application. Returns the `client_id` and `client_secret` — the secret is only returned once at creation time (stored as a bcrypt hash). Scopes are validated against the set of available scopes.",
    responses={
        201: {"description": "App created. **`client_secret` is only returned in this response.**"},
        400: {"description": "Invalid scopes."},
    },
)
async def create_app(body: OAuthAppCreate, db: AsyncSession = Depends(get_db), user_id: UUID = Depends(require_session)):
    app, client_secret = await app_service.create_app(
        db, body.name, body.description, body.scopes, body.redirect_uris,
        body.icon_url, body.privacy_policy_url, owner_id=user_id,
    )
    return OAuthAppCreated(
        id=app.id,
        name=app.name,
        description=app.description,
        client_id=app.client_id,
        client_secret=client_secret,
        scopes=app.scopes,
        redirect_uris=app.redirect_uris,
        icon_url=app.icon_url,
        privacy_policy_url=app.privacy_policy_url,
        status=app.status,
        created_at=app.created_at,
        updated_at=app.updated_at,
    )


@router.get(
    "/",
    response_model=list[OAuthAppResponse],
    summary="List all OAuth apps",
    description="Returns all registered OAuth applications, sorted by creation date (newest first). Does not include client secrets.",
)
async def list_apps(db: AsyncSession = Depends(get_db), _user: UUID = Depends(require_session)):
    return await app_service.list_apps(db)


@router.get(
    "/pending",
    response_model=list[OAuthAppResponse],
    summary="List pending apps (admin only)",
    description="Returns all apps with status=pending. Requires admin privileges.",
)
async def list_pending_apps(
    request: Request,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(require_session),
):
    user = await user_service.get_user_by_id(db, user_id)
    if not user or not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    return await app_service.list_apps_by_status(db, "pending")


@router.patch(
    "/{app_id}/status",
    response_model=OAuthAppResponse,
    summary="Update app approval status (admin only)",
    description="Set an app's status to approved or rejected. Requires admin privileges.",
    responses={
        200: {"description": "Updated app."},
        400: {"description": "Invalid status."},
        403: {"description": "Admin access required."},
        404: {"description": "App not found."},
    },
)
async def update_app_status(
    app_id: UUID,
    body: StatusUpdate,
    request: Request,
    db: AsyncSession = Depends(get_db),
    user_id: UUID = Depends(require_session),
):
    user = await user_service.get_user_by_id(db, user_id)
    if not user or not user.is_admin:
        raise HTTPException(status_code=403, detail="Admin access required")
    app = await app_service.update_app_status(db, app_id, body.status)
    if not app:
        raise HTTPException(status_code=404, detail="App not found")
    return app


@router.get(
    "/{app_id}",
    response_model=OAuthAppResponse,
    summary="Get an OAuth app",
    description="Returns a single OAuth app by its UUID. Does not include the client secret.",
    responses={404: {"description": "App not found."}},
)
async def get_app(app_id: UUID, db: AsyncSession = Depends(get_db), _user: UUID = Depends(require_session)):
    app = await app_service.get_app(db, app_id)
    if not app:
        raise HTTPException(status_code=404, detail="App not found")
    return app


@router.patch(
    "/{app_id}",
    response_model=OAuthAppResponse,
    summary="Update an OAuth app",
    description="Partially updates an OAuth app. Only provided fields are changed. Scopes are re-validated if provided.",
    responses={
        200: {"description": "Updated app."},
        400: {"description": "Invalid scopes."},
        404: {"description": "App not found."},
    },
)
async def update_app(app_id: UUID, body: OAuthAppUpdate, db: AsyncSession = Depends(get_db), user_id: UUID = Depends(require_session)):
    # M3: Ownership check — only owner or admin can update
    existing = await app_service.get_app(db, app_id)
    if not existing:
        raise HTTPException(status_code=404, detail="App not found")
    user = await user_service.get_user_by_id(db, user_id)
    if existing.owner_id and existing.owner_id != user_id and not (user and user.is_admin):
        raise HTTPException(status_code=403, detail="Not authorized to modify this app")

    app = await app_service.update_app(
        db, app_id,
        name=body.name,
        description=body.description,
        scopes=body.scopes,
        redirect_uris=body.redirect_uris,
        icon_url=body.icon_url,
        privacy_policy_url=body.privacy_policy_url,
    )
    return app


@router.delete(
    "/{app_id}",
    status_code=204,
    summary="Delete an OAuth app",
    description="Permanently deletes an OAuth app and its credentials. This cannot be undone.",
    responses={
        204: {"description": "App deleted."},
        404: {"description": "App not found."},
    },
)
async def delete_app(app_id: UUID, db: AsyncSession = Depends(get_db), user_id: UUID = Depends(require_session)):
    # M3: Ownership check — only owner or admin can delete
    existing = await app_service.get_app(db, app_id)
    if not existing:
        raise HTTPException(status_code=404, detail="App not found")
    user = await user_service.get_user_by_id(db, user_id)
    if existing.owner_id and existing.owner_id != user_id and not (user and user.is_admin):
        raise HTTPException(status_code=403, detail="Not authorized to delete this app")

    await app_service.delete_app(db, app_id)
