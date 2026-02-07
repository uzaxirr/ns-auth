# Network School OAuth Provider

OAuth 2.0 / OpenID Connect identity provider for Network School ("Sign in with Network School"). Lets third-party apps request NS user data via standard OAuth scopes — the same pattern as "Sign in with Google."

## Quick Start

```bash
# Backend (port 8000)
cd backend
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000

# Frontend admin dashboard (port 5173)
cd frontend
npm run dev

# Demo client app (port 3000)
cd demo-app
npm run dev
```

All three must run simultaneously for the full flow.

## Architecture

```
backend/          FastAPI + SQLAlchemy async + asyncpg + PostgreSQL
frontend/         Vite + React 19 + TypeScript + Tailwind v4 (admin dashboard)
demo-app/         Vite + React 19 + TypeScript (OAuth client demo)
```

### Backend (`backend/app/`)

| Layer | Files | Purpose |
|-------|-------|---------|
| **Models** | `models/user.py`, `oauth_app.py`, `access_token.py`, `authorization_code.py` | SQLAlchemy ORM (async, UUID primary keys) |
| **Services** | `services/token_service.py`, `authz_service.py`, `privy_service.py`, `session_service.py`, `user_service.py`, `app_service.py` | Business logic layer |
| **Routers** | `routers/oauth.py`, `auth.py`, `apps.py`, `scopes.py`, `wellknown.py`, `uploads.py` | FastAPI HTTP endpoints |
| **Security** | `security/keys.py`, `hashing.py` | RSA key management, bcrypt hashing |
| **Config** | `config.py` | Pydantic-settings with `OAUTH_` env prefix |

### Key Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /oauth/token` | Token endpoint (client_credentials + authorization_code grants) |
| `GET /oauth/authorize` | Authorization code flow entry point |
| `POST /oauth/authorize/consent` | User approves/denies — returns JSON `{"redirect_to": "..."}` |
| `GET /oauth/userinfo` | OIDC UserInfo (Bearer token, scope-gated claims) |
| `GET /oauth/authorize/info` | Returns app name + scopes for consent UI |
| `POST /auth/login/privy` | Exchange Privy token for session cookie |
| `GET /auth/me` | Current user from session cookie |
| `POST /apps` | Create OAuth app (returns client_id + client_secret) |
| `GET /.well-known/openid-configuration` | OIDC discovery |
| `GET /.well-known/jwks.json` | Public JWK set |

### OAuth Flows

**Client Credentials** — machine-to-machine, no user context.
**Authorization Code + PKCE** — user-facing flow:
1. Client redirects to `/oauth/authorize` with PKCE challenge
2. Backend checks session → redirects to frontend `/login` or `/consent`
3. User authenticates via Privy (email OTP / Google / Apple)
4. User approves scopes on consent screen
5. Backend generates auth code → redirects to client callback
6. Client exchanges code for tokens via `/oauth/token`
7. Client fetches user data via `/oauth/userinfo`

### Scopes & Claims

Defined in `backend/app/scopes.py`. The userinfo endpoint returns claims based on granted scopes:

| Scope | Claims |
|-------|--------|
| `openid` | `sub` |
| `email` | `email`, `email_verified` |
| `profile` | `name`, `picture`, `bio` |
| `cohort` | `cohort` |
| `socials` | `socials` (JSON object: twitter, github, linkedin, website) |
| `wallet` | `wallet_address` |
| `activity` | `posts_count`, `streak_days`, `last_active` |
| `offline_access` | refresh tokens |

### Authentication

- **User auth**: Privy (ES256 JWT verified via JWKS from `auth.privy.io`)
- **Sessions**: HS256 JWT in httponly cookie (`ns_session`, samesite=lax)
- **Access tokens**: RS256 JWT (auto-generated RSA keys in `backend/keys/`)
- **Client auth**: client_secret hashed with bcrypt

### Database

PostgreSQL `oauth_provider` on localhost:5432 (user: system user, no password).

**Tables**: `users`, `oauth_apps`, `access_tokens`, `authorization_codes`, `alembic_version`

**User model fields**: id (UUID), privy_did, email, display_name, avatar_url, cohort, bio, socials (JSON), wallet_address, created_at, updated_at

**Migrations**: Alembic. Run from `backend/`:
```bash
alembic revision --autogenerate -m "description"
alembic upgrade head
```
Alembic uses `psycopg2-binary` (sync) since asyncpg can't run migrations.

## Frontend (Admin Dashboard)

Vite 7 + React 19 + Tailwind CSS v4 + shadcn-style components.

- **Pages**: Dashboard (list apps), CreateApp (register OAuth app with scope selector), AppDetail (credentials, API playground), LoginPage, ConsentPage
- **Privy integration**: `PrivyProvider.tsx` wraps the app, configured with NS branding (light theme, black accent, ns.com flag logo)
- **Auto-login**: LoginPage auto-triggers Privy modal on mount (no intermediate "Continue with Privy" button)
- **Consent flow**: Fetches app info from backend, shows scope list, posts approval → reads JSON redirect_to (not 302, due to CORS)

Tailwind v4 uses `@tailwindcss/vite` plugin — not the PostCSS config approach.

## Demo App (OAuth Client)

Standalone Vite + React app on port 3000. Demonstrates the full "Sign in with Network School" flow.

- **Home**: "Sign in with Network School" button, generates PKCE S256 challenge, redirects to `/oauth/authorize`
- **Callback**: Exchanges auth code for tokens, fetches userinfo, displays profile card with all scope data
- **Config**: `demo-app/src/config.ts` has `CLIENT_ID`, `CLIENT_SECRET`, `REDIRECT_URI`, `SCOPES`

## Environment

- **Python 3.9.6** (system macOS) — must use `from __future__ import annotations` and `Optional[X]` / `List[X]` syntax (not `X | None` / `list[X]`)
- **Node**: managed by nvm (ignore nvm warnings in npm output)
- **macOS**: no `timeout` command — use `sleep + kill` pattern for timeouts

### Required Environment Variables (`backend/.env`)

All prefixed with `OAUTH_`:

```
OAUTH_PRIVY_APP_ID=<privy app id>
OAUTH_PRIVY_APP_SECRET=<privy app secret>
OAUTH_SESSION_SECRET=<64+ char secret for HS256 session JWTs>
OAUTH_CORS_ORIGINS=["http://localhost:5173","http://localhost:3000"]
OAUTH_FRONTEND_URL=http://localhost:5173
```

Frontend needs `VITE_PRIVY_APP_ID` and `VITE_API_BASE` in `frontend/.env`.

## Key Technical Decisions & Gotchas

- **python-jose** needs PEM bytes (not cryptography key objects) for JWT signing
- **Consent endpoint** returns JSON `{"redirect_to": url}` instead of 302 redirect, because cross-origin fetch with `redirect: "manual"` makes Location header inaccessible (opaque redirect response)
- **React StrictMode double-mount** — the Callback page uses `useRef(false)` guard to prevent exchanging the one-time-use auth code twice
- **Pydantic-settings** requires `"env_file": ".env"` in `model_config` to load the `.env` file
- **Privy JWT** only contains `sub` (DID) — email must be fetched separately from Privy Server API (`GET /api/v1/users/{did}`)
- **JIT user provisioning**: Users are created on first login via Privy. Email is fetched from Privy API and stored. Profile fields (cohort, bio, socials, wallet) start empty and are filled via seed scripts or admin tools.
- **RSA keys** auto-generate on first backend startup into `backend/keys/`
- **`POST /auth/dev/login-as`** endpoint exists for testing — creates sessions without Privy OTP. Remove before production.

## Useful Commands

```bash
# Create a Privy test user
curl -X POST "https://auth.privy.io/api/v1/users" \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $(echo -n '<app_id>:<app_secret>' | base64)" \
  -H "privy-app-id: <app_id>" \
  -d '{"linked_accounts": [{"type": "email", "address": "user@example.com"}]}'

# Seed user profile data
python3 backend/seed_users.py

# Test client_credentials flow
curl -X POST http://localhost:8000/oauth/token \
  -d "grant_type=client_credentials&client_id=<id>&client_secret=<secret>&scope=openid"

# Check database
python3 -c "import psycopg2; conn = psycopg2.connect(dbname='oauth_provider', user='$(whoami)'); ..."
```
