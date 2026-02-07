from fastapi import APIRouter, Depends, Form
from fastapi.responses import JSONResponse
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.services import token_service

router = APIRouter(prefix="/oauth", tags=["oauth"])


def oauth_error(error: str, description: str, status_code: int = 400) -> JSONResponse:
    return JSONResponse(
        status_code=status_code,
        content={"error": error, "error_description": description},
    )


@router.post("/token")
async def token(
    grant_type: str = Form(...),
    client_id: str = Form(None),
    client_secret: str = Form(None),
    scope: str = Form(None),
    db: AsyncSession = Depends(get_db),
):
    if grant_type != "client_credentials":
        return oauth_error("unsupported_grant_type", "Only client_credentials grant type is supported")

    if not client_id or not client_secret:
        return oauth_error("invalid_request", "client_id and client_secret are required")

    app = await token_service.authenticate_client(db, client_id, client_secret)
    if not app:
        return oauth_error("invalid_client", "Invalid client credentials", 401)

    requested_scopes = scope.split() if scope else []
    access_token, expires_in = await token_service.issue_token(db, app, requested_scopes)

    return {
        "access_token": access_token,
        "token_type": "Bearer",
        "expires_in": expires_in,
        "scope": scope or "",
    }


@router.post("/token/introspect")
async def introspect(
    token: str = Form(...),
    client_id: str = Form(None),
    client_secret: str = Form(None),
    db: AsyncSession = Depends(get_db),
):
    result = await token_service.introspect_token(db, token)
    return result


@router.post("/token/revoke")
async def revoke(
    token: str = Form(...),
    client_id: str = Form(None),
    client_secret: str = Form(None),
    db: AsyncSession = Depends(get_db),
):
    await token_service.revoke_token(db, token)
    return {}
