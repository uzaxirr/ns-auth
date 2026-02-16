from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

from app.config import settings
from app.routers import apps, auth, oauth, scopes, uploads, wellknown
from app.security.keys import get_private_key


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Generate RSA keys on startup if they don't exist
    get_private_key()
    # Ensure uploads directory exists
    Path(settings.uploads_dir).mkdir(parents=True, exist_ok=True)
    yield


app = FastAPI(
    title="Network School OAuth Provider",
    description="""OAuth 2.0 / OpenID Connect identity provider for Network School.

Lets third-party apps request NS user data via standard OAuth scopes — the same pattern as "Sign in with Google."

## Flows

- **Authorization Code + PKCE** — user-facing "Sign in with Network School" flow
- **Client Credentials** — machine-to-machine, no user context

## Scopes

| Scope | Claims |
|-------|--------|
| `openid` | `sub` |
| `email` | `email`, `email_verified` |
| `profile` | `name`, `picture`, `bio` |
| `cohort` | `cohort` |
| `socials` | `socials` (JSON: twitter, github, linkedin, website) |
| `wallet` | `wallet_address` |
| `activity` | `posts_count`, `streak_days`, `last_active` |
| `offline_access` | refresh tokens |

## Authentication

- **User auth**: Privy (ES256 JWT verified via JWKS)
- **Sessions**: HS256 JWT in httponly cookie (`ns_session`)
- **Access tokens**: RS256 JWT (auto-generated RSA keys)
- **Client auth**: `client_secret` verified via bcrypt
""",
    version="1.0.0",
    lifespan=lifespan,
    openapi_tags=[
        {
            "name": "oauth",
            "description": "OAuth 2.0 / OpenID Connect endpoints — authorization, token exchange, userinfo, introspection, and revocation.",
        },
        {
            "name": "auth",
            "description": "User authentication and session management via Privy.",
        },
        {
            "name": "apps",
            "description": "Register, list, update, and delete OAuth client applications.",
        },
        {
            "name": "uploads",
            "description": "Upload and manage OAuth app icons.",
        },
        {
            "name": "scopes",
            "description": "List available OAuth scopes and their claims.",
        },
        {
            "name": "well-known",
            "description": "OIDC discovery and JWKS endpoints (RFC 8414 / RFC 5849).",
        },
    ],
    license_info={"name": "Private", "url": "https://ns.com"},
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/uploads", StaticFiles(directory=settings.uploads_dir), name="uploads")

app.include_router(apps.router)
app.include_router(auth.router)
app.include_router(oauth.router)
app.include_router(scopes.router)
app.include_router(uploads.router)
app.include_router(wellknown.router)


@app.get("/health", tags=["health"], summary="Health check", description="Returns `{\"status\": \"ok\"}` when the server is running.")
async def health():
    return {"status": "ok"}
