from fastapi import APIRouter

from app.config import settings
from app.security.keys import get_jwks

router = APIRouter(tags=["well-known"])


@router.get("/.well-known/jwks.json")
async def jwks():
    return get_jwks()


@router.get("/.well-known/oauth-authorization-server")
async def oauth_metadata():
    return {
        "issuer": settings.issuer,
        "token_endpoint": f"{settings.issuer}/oauth/token",
        "introspection_endpoint": f"{settings.issuer}/oauth/token/introspect",
        "revocation_endpoint": f"{settings.issuer}/oauth/token/revoke",
        "jwks_uri": f"{settings.issuer}/.well-known/jwks.json",
        "token_endpoint_auth_methods_supported": ["client_secret_post"],
        "grant_types_supported": ["client_credentials"],
        "response_types_supported": [],
        "scopes_supported": [],
    }
