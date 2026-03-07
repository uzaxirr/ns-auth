# Network School OAuth Provider

OAuth 2.0 / OpenID Connect identity provider for Network School ("Sign in with Network School"). Lets third-party apps request NS user data via standard OAuth scopes — the same pattern as "Sign in with Google."

## Purpose & Motive

Network School (NS) is building a developer ecosystem where third-party apps can integrate with NS identity and community data. This OAuth provider is the **single gateway** for that — any app wanting to know "is this person an NS member?" or "what cohort are they in?" goes through this server.

**Why it exists:** NS members use dozens of tools (learning platforms, project trackers, social apps). Without a central identity provider, each app would need its own auth, leading to fragmented identity, no single source of truth for membership/roles, and no way to gate access to NS-only resources. This server solves that by giving every app a standard OAuth interface to verify NS membership and request user data.

**What it enables:**
- **Membership gating** — Third-party apps can verify a user is a current NS Discord member before granting access
- **Role-based access** — Discord roles (set by NS admins) flow through as OAuth claims, so apps can offer different features based on a user's NS role
- **Community data** — Apps can request scopes like `roles`, `profile`, `date_joined` to personalize experiences without each app collecting this data separately
- **Live data** — Discord-sourced claims (roles, display name, avatar) are fetched live from Discord API with a 5-minute TTL cache, so apps always see current data rather than stale login-time snapshots
- **Developer self-service** — Anyone can register an OAuth app through the admin dashboard, get credentials, and start integrating

**Who uses it:** NS community builders shipping apps for fellow members, NS core team building internal tools, and eventually external partners building on the NS platform.

## Versioning Strategy

### v1 — Discord-based (current priority)
Use **Discord OAuth2** as the upstream identity provider. The NS community already lives on Discord with roles and access control in place. DC (core team member #2) will provide bot API keys for additional scope data (roles, membership, etc.). This gives us:
- Instant access control — Discord roles map to permissions, kick/ban is built-in
- Faster launch — Discord handles auth infra, we just wrap it
- Community visibility — apps can be shown in the NS Discord server
- Membership gating — verify users are NS Discord members before granting access

**v1 flow:** Third-party app → our OAuth server → Discord OAuth2 login → verify NS Discord membership → issue NS tokens → return user data.

### v2 — Standalone NS OAuth (future)
The full custom identity provider with Privy (email OTP / Google / Apple) as currently built. Balaji vets v1 before greenlighting v2. The existing Privy-based code stays in the repo on a branch for v2.

### What stays the same across v1/v2
- The **external OAuth interface** — third-party apps always talk to our server (`/oauth/authorize`, `/oauth/token`, `/oauth/userinfo`)
- RS256 access tokens, PKCE support, scope-gated claims
- Admin dashboard for registering OAuth apps
- Demo app demonstrating the flow

### What changes in v1
- **User authentication**: Privy → Discord OAuth2 (`https://discord.com/oauth2/authorize`)
- **Identity verification**: Privy DID → Discord user ID + NS server membership check
- **User data source**: Privy API → Discord API + DC's bot API (for roles, profile, etc.)
- **Frontend login**: Privy modal → Discord OAuth redirect
- **User model**: `privy_did` → `discord_id` (minimal — all profile data fetched live from Discord API)
- **Environment vars**: `OAUTH_PRIVY_*` → `OAUTH_DISCORD_CLIENT_ID`, `OAUTH_DISCORD_CLIENT_SECRET`, `OAUTH_DISCORD_BOT_TOKEN`, `OAUTH_DISCORD_GUILD_ID`

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
| `GET /auth/discord` | Redirect to Discord OAuth2 login |
| `GET /auth/discord/callback` | Discord OAuth2 callback — exchanges code, verifies NS membership, creates session code |
| `POST /auth/session/exchange` | Exchange single-use session code for session JWT (60s TTL) |
| `POST /auth/login/privy` | **[v2 only]** Exchange Privy token for session cookie |
| `GET /auth/me` | Current user from session cookie |
| `POST /apps` | Create OAuth app (returns client_id + client_secret) |
| `GET /.well-known/openid-configuration` | OIDC discovery |
| `GET /.well-known/jwks.json` | Public JWK set |

### OAuth Flows

**Client Credentials** — machine-to-machine, no user context.
**Authorization Code + PKCE** — user-facing flow:
1. Client redirects to `/oauth/authorize` with PKCE challenge
2. Backend checks session → redirects to frontend `/login` or `/consent`
3. **v1**: User authenticates via Discord OAuth2 → backend verifies NS Discord membership
   **v2**: User authenticates via Privy (email OTP / Google / Apple)
4. User approves scopes on consent screen
5. Backend generates auth code → redirects to client callback
6. Client exchanges code for tokens via `/oauth/token`
7. Client fetches user data via `/oauth/userinfo`

### Scopes & Claims

Defined in DB (`scope_definitions` + `claim_definitions` tables). The userinfo endpoint returns claims based on granted scopes:

| Scope | Claims | Source |
|-------|--------|--------|
| `openid` | `sub` | System |
| `email` | `email`, `email_verified` | Discord OAuth |
| `profile` | `name`, `picture`, `discord_username`, `banner_url`, `accent_color`, `public_badges` | Discord API (live, 5-min cache) |
| `roles` | `roles` | Discord API (live, 5-min cache) |
| `date_joined` | `date_joined`, `discord_joined_at`, `boosting_since` | System + Discord API |
| `offline_access` | refresh tokens | — |

No user profile data is stored in the DB. Everything comes live from Discord API.

### Authentication

- **User auth (v1)**: Discord OAuth2 — user logs in via Discord, backend verifies membership in NS Discord server (guild). DC's bot token used for role/member data.
- **User auth (v2)**: Privy (ES256 JWT verified via JWKS from `auth.privy.io`)
- **Sessions**: HS256 JWT in httponly cookie (`ns_session`, samesite=lax)
- **Access tokens**: RS256 JWT (auto-generated RSA keys in `backend/keys/`)
- **Client auth**: client_secret hashed with bcrypt

### Database

PostgreSQL `oauth_provider` on localhost:5432 (user: system user, no password).

**Tables**: `users`, `oauth_apps`, `access_tokens`, `refresh_tokens`, `authorization_codes`, `scope_definitions`, `claim_definitions`, `alembic_version`

**User model fields**: id (UUID), discord_id, email, is_admin, created_at, updated_at. All profile data (name, avatar, roles, badges, etc.) is fetched live from the Discord API — nothing cached in the DB.

**User model fields (v2)**: id (UUID), privy_did, email, is_admin, created_at, updated_at

**Migrations**: Alembic. Run from `backend/`:
```bash
alembic revision --autogenerate -m "description"
alembic upgrade head
```
Alembic uses `psycopg2-binary` (sync) since asyncpg can't run migrations.

## Frontend (Admin Dashboard)

Vite 7 + React 19 + Tailwind CSS v4 + shadcn-style components.

- **Pages**: Dashboard (list apps), CreateApp (register OAuth app with scope selector), AppDetail (credentials, API playground), LoginPage, ConsentPage
- **Login (v1)**: LoginPage redirects to backend `/auth/discord` which initiates Discord OAuth2 flow. No Privy dependency.
- **Login (v2)**: `PrivyProvider.tsx` wraps the app, Privy modal auto-triggers on mount
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

**v1 (Discord-based):**
```
OAUTH_DISCORD_CLIENT_ID=<discord app client id>
OAUTH_DISCORD_CLIENT_SECRET=<discord app client secret>
OAUTH_DISCORD_BOT_TOKEN=<DC's bot token for guild/role API access>
OAUTH_DISCORD_GUILD_ID=<NS discord server ID>
OAUTH_SESSION_SECRET=<64+ char secret for HS256 session JWTs>
OAUTH_CORS_ORIGINS=["http://localhost:5173","http://localhost:3000"]
OAUTH_FRONTEND_URL=http://localhost:5173
```

**v2 (Privy-based):**
```
OAUTH_PRIVY_APP_ID=<privy app id>
OAUTH_PRIVY_APP_SECRET=<privy app secret>
OAUTH_SESSION_SECRET=<64+ char secret for HS256 session JWTs>
OAUTH_CORS_ORIGINS=["http://localhost:5173","http://localhost:3000"]
OAUTH_FRONTEND_URL=http://localhost:5173
```

Frontend needs `VITE_API_BASE` in `frontend/.env`. (v2 also needs `VITE_PRIVY_APP_ID`.)

## Key Technical Decisions & Gotchas

- **python-jose** needs PEM bytes (not cryptography key objects) for JWT signing
- **Consent endpoint** returns JSON `{"redirect_to": url}` instead of 302 redirect, because cross-origin fetch with `redirect: "manual"` makes Location header inaccessible (opaque redirect response)
- **React StrictMode double-mount** — the Callback page uses `useRef(false)` guard to prevent exchanging the one-time-use auth code twice
- **Pydantic-settings** requires `"env_file": ".env"` in `model_config` to load the `.env` file
- **Discord OAuth2 scopes (v1)**: Request `identify email guilds.members.read` from Discord. The `guilds.members.read` scope lets us check NS server membership and roles without the bot token for the authenticating user. Bot token is used for additional guild-wide queries.
- **NS membership gating (v1)**: After Discord login, backend calls Discord API to verify user is a member of the NS guild (`OAUTH_DISCORD_GUILD_ID`). Non-members are rejected.
- **Discord role → scope mapping (v1)**: DC's bot manages roles. Discord roles flow through as the `roles` claim when the `roles` scope is granted.
- **[v2] Privy JWT** only contains `sub` (DID) — email must be fetched separately from Privy Server API (`GET /api/v1/users/{did}`)
- **JIT user provisioning**: Users are created on first login via Discord (v1) or Privy (v2). All profile data comes from Discord — no manually-seeded fields.
- **RSA keys** auto-generate on first backend startup into `backend/keys/`
- **Cross-origin session cookies**: In production (HTTPS), session cookies use `SameSite=None; Secure=True` because the frontend and backend are on different Railway domains. Without this, the session cookie won't be sent in cross-origin requests (consent approval, `/auth/me`). The `session_service.py` auto-detects production mode by checking if `settings.issuer` starts with `https`.
- **Session token relay** uses a single-use intermediate code (not the JWT itself in the URL). After Discord login, backend stores a 60-second session code and redirects to `/auth/session?code=<code>`. The frontend exchanges this code via `POST /auth/session/exchange` to get the session JWT. This prevents tokens from leaking in URLs, browser history, or Referer headers.

## Deployment (Railway)

Project: **cus-auth** on Railway. Three services + one PostgreSQL database.

### Live URLs

| Service | URL |
|---------|-----|
| Backend | https://backend-production-c59b.up.railway.app |
| Frontend (Admin) | https://frontend-production-a6eb.up.railway.app |
| Demo App | https://demo-app-production-9550.up.railway.app |

### Service Architecture

Each service has a `railway.toml` in its directory:
- **backend** — Nixpacks Python build, runs Alembic migrations then uvicorn
- **frontend** — Nixpacks Node build, serves static `dist/` via `npx serve`
- **demo-app** — Nixpacks Node build, serves static `dist/` via `npx serve`

PostgreSQL is Railway-managed, accessible via internal hostname `postgres.railway.internal`.

### Deploying

```bash
# Deploy all services (from project root)
railway up --service backend --detach
railway up --service frontend --detach
railway up --service demo-app --detach
```

Each service's `rootDirectory` is configured in Railway's service settings (not via env vars). `railway up` uploads from the git repo root — Railway uses the `rootDirectory` setting to scope the build.

### Railway Environment Variables

**Backend** (`--service backend`):
- `OAUTH_DATABASE_URL` — async PostgreSQL connection string (set by Railway)
- `OAUTH_DATABASE_URL_SYNC` — sync PostgreSQL connection string (for Alembic)
- `OAUTH_ISSUER` — Backend public URL
- `OAUTH_RSA_PRIVATE_KEY` / `OAUTH_RSA_PUBLIC_KEY` — Base64-encoded PEM keys (production uses env vars, not files)
- `OAUTH_DISCORD_CLIENT_ID` / `OAUTH_DISCORD_CLIENT_SECRET` / `OAUTH_DISCORD_BOT_TOKEN` / `OAUTH_DISCORD_GUILD_ID` **(v1)**
- `OAUTH_PRIVY_APP_ID` / `OAUTH_PRIVY_APP_SECRET` **(v2)**
- `OAUTH_SESSION_SECRET`
- `OAUTH_CORS_ORIGINS` — JSON array of allowed origins (must include frontend + demo-app URLs)
- `OAUTH_FRONTEND_URL` — Frontend URL for redirects

**Frontend** (`--service frontend`):
- `VITE_API_BASE` — Backend URL
- `VITE_PRIVY_APP_ID` — Privy app ID for login modal **(v2 only)**

**Demo App** (`--service demo-app`):
- `VITE_OAUTH_SERVER` — Backend URL
- `VITE_CLIENT_ID` / `VITE_CLIENT_SECRET` — OAuth app credentials (registered on the production backend)
- `VITE_REDIRECT_URI` — Demo app callback URL
- `VITE_SCOPES` — Space-separated scope list

### Railway CLI Cheatsheet

```bash
railway variables --service <name>                  # List all vars
railway variables --set "KEY=val" --service <name>   # Set var
railway variables --set "K1=v1" --set "K2=v2" ...    # Set multiple
railway domain --service <name>                      # Get/create domain
railway service status                               # Check deploy status
railway up --service <name> --detach                 # Deploy
```

To delete a variable, use the GraphQL API (CLI has no delete command):
```bash
TOKEN=$(python3 -c "import json; d=json.load(open('$HOME/.railway/config.json')); print(d['user']['token'])")
curl -s -X POST "https://backboard.railway.com/graphql/v2" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" \
  -d '{"query": "mutation { variableDelete(input: { name: \"VAR_NAME\", serviceId: \"...\", environmentId: \"...\", projectId: \"...\" }) }"}'
```

### Railway Gotchas

- **`railway up` always uploads from git repo root** — it ignores `cwd`. Use `rootDirectory` in the service settings to scope the build to a subdirectory. **CRITICAL: always run `railway up` from the repo root (`/Users/uzaxirr/work/oauth/`), NOT from a subdirectory.** If you run from e.g. `frontend/`, Railway will upload only that dir's contents and the `rootDirectory: "frontend"` lookup will fail with "Could not find root directory: frontend."
- **`rootDirectory` must be set for all services** — Without it, Railway sees the entire monorepo and can't detect the app type. Set via GraphQL API: `mutation { serviceInstanceUpdate(input: { rootDirectory: "backend" }, serviceId: "...", environmentId: "...") }`. Current values: backend → `"backend"`, frontend → `"frontend"`, demo-app → `"demo-app"`.
- **Setting `rootDirectory`** requires the GraphQL API — the Railway CLI doesn't support it directly.
- **Never set `NIXPACKS_PKGS` or `NIXPACKS_BUILD_CMD`** to invalid values — Nixpacks reads them as Nix expressions and the build will fail with cryptic errors like `undefined variable 'delete'`.
- **Node version on Railway defaults to v18** — Privy SDK and Vite 7 require Node >=20. Set `NIXPACKS_NODE_VERSION=20` env var on Node services (frontend, demo-app), or add a `.node-version` file with `20` in the service's root directory.
- **`npm ci` requires lock file in sync** — If `package-lock.json` is regenerated with a different Node/npm version, `npm ci` on Railway will fail with "Missing: ... from lock file". Fix: `rm -rf node_modules package-lock.json && npm install` from the correct subdirectory, then redeploy.
- **`serve` must be a production dependency** (not devDependency) for the Nixpacks start command `npx serve dist -s` to work.
- **CORS origins must be updated** when adding new service domains — both in the backend env var and the Privy dashboard's allowed origins.
- **Production RSA keys** are stored as base64-encoded PEM in env vars (`OAUTH_RSA_PRIVATE_KEY`, `OAUTH_RSA_PUBLIC_KEY`), not as files. The backend's `security/keys.py` handles both modes.
- **Alembic migrations run on deploy** — the backend's `railway.toml` start command runs `alembic upgrade head` before starting uvicorn.
- **Changing Railway env vars can auto-trigger a redeploy** from the source (GitHub). If the service is not connected to a GitHub repo, these auto-triggered deploys will fail immediately with no build. Deploy via `railway up` instead.

### Common Deployment Mistakes & Fixes

| Mistake | Symptom | Fix |
|---------|---------|-----|
| Running `railway up` from subdirectory | "Could not find root directory: X" | Always run from repo root |
| Missing `rootDirectory` setting | "Railpack could not determine how to build the app" (sees entire repo) | Set via GraphQL API |
| Default Node v18 on Railway | `npm warn EBADENGINE` + build errors from Vite 7 / Privy SDK | Set `NIXPACKS_NODE_VERSION=20` env var |
| Stale `package-lock.json` | `npm ci` fails: "Missing: zod@X.X.X from lock file" | Delete lock + `node_modules`, run `npm install` |
| Backend deploys but old code runs | New endpoints return 404 | Check `railway deployment list` — deploy may have FAILED silently |
| Session cookie `SameSite=Lax` in production | Consent "Allow" does nothing, `/auth/me` returns `{}` | Use `SameSite=None; Secure=True` for cross-domain (already auto-detected in `session_service.py`) |

## Useful Commands

```bash
# Test Discord login flow (v1) — open in browser
open "http://localhost:8000/auth/discord?next=http://localhost:5173"

# Test client_credentials flow
curl -X POST http://localhost:8000/oauth/token \
  -d "grant_type=client_credentials&client_id=<id>&client_secret=<secret>&scope=openid"

# Check database
python3 -c "import psycopg2; conn = psycopg2.connect(dbname='oauth_provider', user='$(whoami)'); ..."

# Seed user profile data
python3 backend/seed_users.py

# [v2] Create a Privy test user
curl -X POST "https://auth.privy.io/api/v1/users" \
  -H "Content-Type: application/json" \
  -H "Authorization: Basic $(echo -n '<app_id>:<app_secret>' | base64)" \
  -H "privy-app-id: <app_id>" \
  -d '{"linked_accounts": [{"type": "email", "address": "user@example.com"}]}'
```
