from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.security.keys import get_jwks
from app.services import scope_service

router = APIRouter(tags=["well-known"])


@router.get(
    "/.well-known/jwks.json",
    summary="JSON Web Key Set",
    description="Returns the public RSA key set used to verify RS256-signed access tokens and ID tokens.",
)
async def jwks():
    return get_jwks()


@router.get(
    "/.well-known/oauth-authorization-server",
    summary="OAuth 2.0 Authorization Server Metadata",
    description="RFC 8414 metadata document. Returns issuer, endpoints, supported grant types, response types, code challenge methods, scopes, and authentication methods.",
)
async def oauth_metadata(db: AsyncSession = Depends(get_db)):
    scope_names = sorted(await scope_service.get_valid_scope_names(db))
    return {
        "issuer": settings.issuer,
        "authorization_endpoint": f"{settings.issuer}/oauth/authorize",
        "token_endpoint": f"{settings.issuer}/oauth/token",
        "userinfo_endpoint": f"{settings.issuer}/oauth/userinfo",
        "introspection_endpoint": f"{settings.issuer}/oauth/token/introspect",
        "revocation_endpoint": f"{settings.issuer}/oauth/token/revoke",
        "jwks_uri": f"{settings.issuer}/.well-known/jwks.json",
        "token_endpoint_auth_methods_supported": ["client_secret_post", "none"],
        "grant_types_supported": ["client_credentials", "authorization_code", "refresh_token"],
        "response_types_supported": ["code"],
        "code_challenge_methods_supported": ["S256", "plain"],
        "scopes_supported": scope_names,
    }


@router.get(
    "/.well-known/openid-configuration",
    summary="OpenID Connect Discovery",
    description="OIDC discovery document. Returns issuer, endpoints, supported algorithms (`RS256`), scopes, grant types, and authentication methods. Clients can auto-configure from this URL.",
)
async def openid_configuration(db: AsyncSession = Depends(get_db)):
    scope_names = sorted(await scope_service.get_valid_scope_names(db))
    return {
        "issuer": settings.issuer,
        "authorization_endpoint": f"{settings.issuer}/oauth/authorize",
        "token_endpoint": f"{settings.issuer}/oauth/token",
        "userinfo_endpoint": f"{settings.issuer}/oauth/userinfo",
        "jwks_uri": f"{settings.issuer}/.well-known/jwks.json",
        "introspection_endpoint": f"{settings.issuer}/oauth/token/introspect",
        "revocation_endpoint": f"{settings.issuer}/oauth/token/revoke",
        "response_types_supported": ["code"],
        "grant_types_supported": ["client_credentials", "authorization_code", "refresh_token"],
        "subject_types_supported": ["public"],
        "id_token_signing_alg_values_supported": ["RS256"],
        "scopes_supported": scope_names,
        "token_endpoint_auth_methods_supported": ["client_secret_post", "none"],
        "code_challenge_methods_supported": ["S256", "plain"],
    }
