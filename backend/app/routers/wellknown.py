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
        "authorization_endpoint": f"{settings.issuer}/oauth/authorize",
        "token_endpoint": f"{settings.issuer}/oauth/token",
        "userinfo_endpoint": f"{settings.issuer}/oauth/userinfo",
        "introspection_endpoint": f"{settings.issuer}/oauth/token/introspect",
        "revocation_endpoint": f"{settings.issuer}/oauth/token/revoke",
        "jwks_uri": f"{settings.issuer}/.well-known/jwks.json",
        "token_endpoint_auth_methods_supported": ["client_secret_post", "none"],
        "grant_types_supported": ["client_credentials", "authorization_code"],
        "response_types_supported": ["code"],
        "code_challenge_methods_supported": ["S256", "plain"],
        "scopes_supported": [
            "openid", "profile", "email", "cohort",
            "activity", "socials", "wallet", "offline_access",
        ],
    }


@router.get("/.well-known/openid-configuration")
async def openid_configuration():
    return {
        "issuer": settings.issuer,
        "authorization_endpoint": f"{settings.issuer}/oauth/authorize",
        "token_endpoint": f"{settings.issuer}/oauth/token",
        "userinfo_endpoint": f"{settings.issuer}/oauth/userinfo",
        "jwks_uri": f"{settings.issuer}/.well-known/jwks.json",
        "introspection_endpoint": f"{settings.issuer}/oauth/token/introspect",
        "revocation_endpoint": f"{settings.issuer}/oauth/token/revoke",
        "response_types_supported": ["code"],
        "grant_types_supported": ["client_credentials", "authorization_code"],
        "subject_types_supported": ["public"],
        "id_token_signing_alg_values_supported": ["RS256"],
        "scopes_supported": [
            "openid", "profile", "email", "cohort",
            "activity", "socials", "wallet", "offline_access",
        ],
        "token_endpoint_auth_methods_supported": ["client_secret_post", "none"],
        "code_challenge_methods_supported": ["S256", "plain"],
    }
