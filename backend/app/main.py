from contextlib import asynccontextmanager
from pathlib import Path

from fastapi import FastAPI, Request, Response
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from fastapi.staticfiles import StaticFiles
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address
from starlette.middleware.base import BaseHTTPMiddleware

from app.config import settings
from app.routers import apps, auth, oauth, scope_admin, scopes, uploads, wellknown
from app.security.keys import get_private_key

limiter = Limiter(key_func=get_remote_address, default_limits=["60/minute"])


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
| `profile` | `name`, `picture` |
| `roles` | `roles` (Discord roles, live) |
| `date_joined` | `date_joined` |
| `offline_access` | refresh tokens |

## Authentication

- **User auth**: Discord OAuth2 (NS guild membership required)
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
            "description": "User authentication and session management via Discord OAuth2.",
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

# M7: Security headers middleware
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response: Response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        if settings.issuer.startswith("https"):
            response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
        response.headers["Content-Security-Policy"] = "default-src 'none'; frame-ancestors 'none'"
        return response


app.add_middleware(SecurityHeadersMiddleware)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# M8: Rate limiting
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

app.mount("/uploads", StaticFiles(directory=settings.uploads_dir), name="uploads")

app.include_router(apps.router)
app.include_router(auth.router)
app.include_router(oauth.router)
app.include_router(scope_admin.router)
app.include_router(scopes.router)
app.include_router(uploads.router)
app.include_router(wellknown.router)


@app.get("/", include_in_schema=False)
async def root():
    return RedirectResponse("https://nsauth.org")


@app.get("/health", tags=["health"], summary="Health check", description="Returns `{\"status\": \"ok\"}` when the server is running.")
async def health():
    return {"status": "ok"}
