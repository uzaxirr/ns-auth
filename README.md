# Network School OAuth Provider

OAuth 2.0 / OpenID Connect identity provider for Network School. Lets third-party apps authenticate NS users via **"Sign in with Network School"** — the same pattern as "Sign in with Google."

Users authenticate via **Discord OAuth2**. The backend verifies they're a member of the NS Discord server, then issues standard OAuth tokens that third-party apps consume.

## Architecture

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────┐
│  Frontend    │     │    Backend       │     │   Discord    │
│  (Admin UI)  │────▶│  (OAuth Server)  │────▶│   OAuth2     │
│  React/Vite  │     │  FastAPI         │◀──── Third-party apps
│  :5173       │     │  :8000           │
└─────────────┘     └────────┬─────────┘
                             │
                    ┌────────▼─────────┐
                    │   PostgreSQL     │
                    │  oauth_provider  │
                    └──────────────────┘
```

| Service | Local | Production |
|---------|-------|------------|
| Backend | http://localhost:8000 | https://backend-production-c59b.up.railway.app |
| Frontend (Admin) | http://localhost:5173 | https://frontend-production-a6eb.up.railway.app |
| Demo App | http://localhost:3000 | https://demo-app-production-9550.up.railway.app |

---

## Prerequisites

- **Python 3.9+** (macOS system Python works)
- **Node.js 20+** (via nvm: `nvm install 20`)
- **PostgreSQL** running locally
- **Railway CLI** for deployment: `npm i -g @railway/cli`
- **Discord application** — you need a client ID, client secret, and bot token from the [Discord Developer Portal](https://discord.com/developers/applications)

---

## Local Development Setup

### 1. Clone and create the database

```bash
git clone git@github.com:uzaxirr/ns-auth.git
cd ns-auth
createdb oauth_provider
```

### 2. Install dependencies

```bash
# Backend
cd backend
pip install -r requirements.txt

# Frontend
cd ../frontend
npm install

# Demo app (optional)
cd ../demo-app
npm install
```

### 3. Configure environment variables

**`backend/.env`**

```env
# Database — two connection strings required (async for the app, sync for Alembic migrations)
# Defaults to local PostgreSQL if not set. Change these for Supabase, Neon, AWS RDS, etc.
OAUTH_DATABASE_URL=postgresql+asyncpg://user:password@host:5432/dbname
OAUTH_DATABASE_URL_SYNC=postgresql://user:password@host:5432/dbname

# Discord OAuth2 (v1)
OAUTH_DISCORD_CLIENT_ID=<discord app client id>
OAUTH_DISCORD_CLIENT_SECRET=<discord app client secret>
OAUTH_DISCORD_BOT_TOKEN=<bot token for guild/role API access>
OAUTH_DISCORD_GUILD_ID=<NS discord server ID>

# Session & security
OAUTH_SESSION_SECRET=<64+ character random string>

# CORS & frontend
OAUTH_CORS_ORIGINS=["http://localhost:5173","http://localhost:3000"]
OAUTH_FRONTEND_URL=http://localhost:5173
```

> **Database connection strings:** The backend needs two DB URLs — one with `asyncpg` driver (for the app) and one with `psycopg2` (for Alembic migrations). If you're using a hosted DB like Supabase, Neon, or AWS RDS, take the connection string they provide and set both:
> - `OAUTH_DATABASE_URL` — prefix with `postgresql+asyncpg://`
> - `OAUTH_DATABASE_URL_SYNC` — prefix with `postgresql://`
>
> For local development, these default to `postgresql+asyncpg://$(whoami)@localhost:5432/oauth_provider` and you don't need to set them.

All backend env vars use the `OAUTH_` prefix. See `backend/app/config.py` for the full list with defaults.

**`frontend/.env`**

```env
VITE_API_BASE=http://localhost:8000
```

### 4. Run database migrations

```bash
cd backend
alembic upgrade head
```

### 5. Start all services

Run each in a separate terminal:

```bash
# Terminal 1 — Backend (port 8000)
cd backend
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000

# Terminal 2 — Frontend (port 5173)
cd frontend
npm run dev

# Terminal 3 — Demo app (port 3000, optional)
cd demo-app
npm run dev
```

### 6. Register your first OAuth app

Open http://localhost:5173, log in via Discord, and click **Create App**. Apps are immediately usable — no admin approval required.

The response includes `client_id` and `client_secret`. **Save the secret** — it's only shown once.

---

## Registering & Managing OAuth Apps

### Create an app

```
POST /api/apps/
```

```json
{
  "name": "App Name",
  "description": "What the app does",
  "scopes": ["openid", "profile", "email"],
  "redirect_uris": ["https://yourapp.com/callback"],
  "icon_url": "https://yourapp.com/logo.png",
  "privacy_policy_url": "https://yourapp.com/privacy"
}
```

Returns `client_id` and `client_secret`. **Save the secret** — it's only shown once. Apps are auto-approved and can be used immediately.

### Update an app

```
PATCH /api/apps/{app_id}
```

```json
{
  "icon_url": "https://new-icon-url.com/logo.png",
  "scopes": ["openid", "profile", "email", "cohort"]
}
```

### List / Get / Delete

```
GET  /api/apps/           # List all apps
GET  /api/apps/{app_id}   # Get single app
DELETE /api/apps/{app_id} # Delete app
```

### Available Scopes

| Scope | Claims Returned | Source | Description |
|-------|----------------|--------|-------------|
| `openid` | `sub` | System | Required. User's unique ID |
| `profile` | `name`, `picture`, `discord_username`, `banner_url`, `accent_color`, `public_badges` | Discord API (live) | Display name, avatar, username, banner, profile color, badges |
| `email` | `email`, `email_verified` | Discord OAuth | Email address |
| `roles` | `roles` | Discord API (live) | Discord roles in NS server (array of `{id, name}`) |
| `date_joined` | `date_joined`, `discord_joined_at`, `boosting_since` | System + Discord API | OAuth signup date, Discord server join date, boost status |
| `offline_access` | — | — | Enables refresh tokens (30-day expiry, rotate on use) |

**No user profile data is stored in the database.** The DB only holds identity (`id`, `discord_id`, `email`). All profile data — name, avatar, roles, badges, banner, etc. — is fetched live from the Discord API with a 5-minute cache, so third-party apps always see current data.

---

## OAuth Flows

### Authorization Code + PKCE (User-Facing)

This is the primary flow for apps that want users to "Sign in with Network School."

```
Your App                    NS OAuth Server                Discord
  │                              │                            │
  │──1. Redirect to /authorize──▶│                            │
  │                              │──2. Redirect to Discord───▶│
  │                              │                            │──3. User logs in
  │                              │◀──4. Discord callback──────│
  │                              │  (verify NS membership)    │
  │◀──5. Redirect with code──────│                            │
  │──6. POST /oauth/token───────▶│                            │
  │◀──7. access_token + refresh──│                            │
  │──8. GET /oauth/userinfo─────▶│                            │
  │◀──9. Return user claims──────│                            │
```

Users see Discord login, then land back in your app. No consent screen in v1 — users already consented when joining the NS Discord.

**Step 1 — Redirect user to authorize:**

```
GET /oauth/authorize
  ?response_type=code
  &client_id=YOUR_CLIENT_ID
  &redirect_uri=https://yourapp.com/callback
  &scope=openid profile email offline_access
  &state=RANDOM_STATE
  &code_challenge=BASE64URL_SHA256_HASH
  &code_challenge_method=S256
```

**Step 5 — User is redirected back with an auth code:**

```
https://yourapp.com/callback?code=AUTH_CODE&state=RANDOM_STATE
```

**Step 6 — Exchange code for tokens:**

```bash
curl -X POST https://backend-production-c59b.up.railway.app/oauth/token \
  -d "grant_type=authorization_code" \
  -d "code=AUTH_CODE" \
  -d "redirect_uri=https://yourapp.com/callback" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "code_verifier=ORIGINAL_RANDOM_STRING"
```

Response (when `offline_access` scope is granted):

```json
{
  "access_token": "eyJ...",
  "refresh_token": "abc123...",
  "token_type": "Bearer",
  "expires_in": 3600,
  "scope": "openid profile email offline_access",
  "id_token": "eyJ..."
}
```

**Step 8 — Fetch user info:**

```bash
curl https://backend-production-c59b.up.railway.app/oauth/userinfo \
  -H "Authorization: Bearer ACCESS_TOKEN"
```

### Refresh Tokens

When `offline_access` scope is granted, the token response includes a `refresh_token`. Use it to get new tokens without re-authenticating:

```bash
curl -X POST https://backend-production-c59b.up.railway.app/oauth/token \
  -d "grant_type=refresh_token" \
  -d "refresh_token=REFRESH_TOKEN" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET"
```

Returns a new `access_token` and a new `refresh_token` (rotation — old refresh token is revoked). Refresh tokens expire after 30 days. Access tokens expire after 1 hour.

### Client Credentials (Machine-to-Machine)

No user context. For server-to-server API calls.

```bash
curl -X POST http://localhost:8000/oauth/token \
  -d "grant_type=client_credentials" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "scope=openid"
```

### PKCE Code Generation (TypeScript)

```typescript
function generatePKCE() {
  const verifier = crypto.randomUUID() + crypto.randomUUID();
  const encoder = new TextEncoder();
  const data = encoder.encode(verifier);
  return crypto.subtle.digest("SHA-256", data).then((hash) => {
    const challenge = btoa(String.fromCharCode(...new Uint8Array(hash)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
    return { verifier, challenge };
  });
}
```

---

## Key Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/oauth/authorize` | GET | Start authorization code flow |
| `/oauth/token` | POST | Exchange code, credentials, or refresh token for tokens |
| `/oauth/userinfo` | GET | Get user claims (Bearer token required) |
| `/oauth/token/introspect` | POST | Check if a token is active |
| `/oauth/token/revoke` | POST | Revoke an access or refresh token |
| `/.well-known/openid-configuration` | GET | OIDC discovery document |
| `/.well-known/jwks.json` | GET | Public JWK set for token verification |
| `/auth/discord` | GET | Redirect to Discord OAuth2 login |
| `/auth/discord/callback` | GET | Discord OAuth2 callback |
| `/auth/me` | GET | Current user from session cookie |
| `/api/apps/` | CRUD | Manage OAuth applications |
| `/api/scopes/` | GET | List available scopes and claims |

---

## Database & Migrations

### Tables

| Table | Purpose |
|-------|---------|
| `users` | NS users (UUID id, discord_id, email, is_admin — all profile data fetched live from Discord) |
| `oauth_apps` | Registered OAuth applications (client_id, hashed client_secret, scopes, redirect_uris, status) |
| `access_tokens` | Issued JWT access tokens (hash, jti, scopes, expiry) |
| `refresh_tokens` | Issued opaque refresh tokens (hash, jti, scopes, expiry, rotation tracking) |
| `authorization_codes` | Temporary auth codes (10 min TTL, one-time use) |
| `scope_definitions` | Available OAuth scopes (DB-driven, extensible by admins) |
| `claim_definitions` | Claim-to-scope mappings with data sources (user field or Discord API) |

### Running Migrations

```bash
cd backend

# Apply all pending migrations
alembic upgrade head

# Create a new migration after model changes
alembic revision --autogenerate -m "Add new_field to users"

# Check current migration version
alembic current
```

> Alembic uses `psycopg2-binary` (sync driver) because `asyncpg` can't run migrations synchronously. Both are in `requirements.txt`.

---

## Deployment to Railway

### Service Architecture

The project runs on Railway as **3 services + 1 PostgreSQL database** in the `cus-auth` project.

| Service | Root Directory | Start Command |
|---------|---------------|---------------|
| backend | `backend` | `alembic upgrade head && uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| frontend | `frontend` | `npx serve dist -s -l $PORT` |
| demo-app | `demo-app` | `npx serve dist -s -l $PORT` |

### Deploying

**Always run from the repo root** (`/path/to/ns-auth/`), never from a subdirectory:

```bash
# Deploy a single service
railway up --service backend --detach
railway up --service frontend --detach
railway up --service demo-app --detach
```

Each service has a `railway.toml` in its directory that configures the build and start commands. Railway uses the `rootDirectory` setting to scope the build to the correct subdirectory.

### Environment Variables

**Backend** (`--service backend`):

| Variable | Description |
|----------|-------------|
| `OAUTH_DATABASE_URL` | Async PostgreSQL URL (`postgresql+asyncpg://...`) |
| `OAUTH_DATABASE_URL_SYNC` | Sync PostgreSQL URL for Alembic (`postgresql://...`) |
| `OAUTH_ISSUER` | Backend public URL |
| `OAUTH_RSA_PRIVATE_KEY` | Base64-encoded RSA private key PEM |
| `OAUTH_RSA_PUBLIC_KEY` | Base64-encoded RSA public key PEM |
| `OAUTH_DISCORD_CLIENT_ID` | Discord application client ID |
| `OAUTH_DISCORD_CLIENT_SECRET` | Discord application client secret |
| `OAUTH_DISCORD_BOT_TOKEN` | Discord bot token for guild/role API access |
| `OAUTH_DISCORD_GUILD_ID` | NS Discord server (guild) ID |
| `OAUTH_SESSION_SECRET` | 64+ char secret for session JWTs |
| `OAUTH_CORS_ORIGINS` | JSON array of allowed origins |
| `OAUTH_FRONTEND_URL` | Frontend URL for redirects |

**Frontend** (`--service frontend`):

| Variable | Description |
|----------|-------------|
| `VITE_API_BASE` | Backend URL |
| `NIXPACKS_NODE_VERSION` | Set to `20` (required for Vite 7) |

**Demo App** (`--service demo-app`):

| Variable | Description |
|----------|-------------|
| `VITE_OAUTH_SERVER` | Backend URL |
| `VITE_CLIENT_ID` | OAuth app client ID (registered on backend) |
| `VITE_CLIENT_SECRET` | OAuth app client secret |
| `VITE_REDIRECT_URI` | Demo app callback URL |
| `VITE_SCOPES` | Space-separated scope list |
| `NIXPACKS_NODE_VERSION` | Set to `20` |

### Managing Variables

```bash
railway variables --service backend              # List all vars
railway variables --set "KEY=val" --service backend  # Set a var
```

### Setting rootDirectory (First-Time Setup)

Railway CLI can't set `rootDirectory` — use the GraphQL API:

```bash
TOKEN=$(railway whoami --json | python3 -c "import sys,json; print(json.load(sys.stdin)['token'])" 2>/dev/null || python3 -c "import json; d=json.load(open('$HOME/.railway/config.json')); print(d['user']['token'])")

# Set rootDirectory for a service
curl -s -X POST "https://backboard.railway.com/graphql/v2" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "query": "mutation { serviceInstanceUpdate(input: { rootDirectory: \"backend\" }, serviceId: \"SERVICE_ID\", environmentId: \"ENV_ID\") }"
  }'
```

Service IDs: `backend=74d82bf8`, `frontend=aeaf64c4`, `demo-app=362b8081`, `env=841b21b5`

### Production RSA Keys

In production, RSA keys are stored as base64-encoded PEM strings in env vars (not files). Generate them:

```bash
# Generate RSA key pair
openssl genrsa -out private.pem 2048
openssl rsa -in private.pem -pubout -out public.pem

# Base64 encode for Railway env vars
PRIV=$(base64 < private.pem)
PUB=$(base64 < public.pem)

railway variables --set "OAUTH_RSA_PRIVATE_KEY=$PRIV" --service backend
railway variables --set "OAUTH_RSA_PUBLIC_KEY=$PUB" --service backend
```

The backend auto-detects whether to use env var keys or file-based keys (`backend/keys/`).

### Troubleshooting

| Problem | Symptom | Fix |
|---------|---------|-----|
| Ran `railway up` from subdirectory | "Could not find root directory" | Always run from repo root |
| Missing `rootDirectory` | "Could not determine how to build" | Set via GraphQL API (see above) |
| Node version too old | `EBADENGINE` warnings, build fails | Set `NIXPACKS_NODE_VERSION=20` |
| Stale `package-lock.json` | `npm ci` fails: "Missing from lock file" | Delete lock + node_modules, run `npm install` |
| Session cookie not sent | Consent "Allow" does nothing | Already handled: `SameSite=None; Secure=True` auto-detected for HTTPS |
| Old code after deploy | New endpoints return 404 | Check `railway deployment list` — deploy may have failed |
| CORS errors | Browser blocks requests | Update `OAUTH_CORS_ORIGINS` with all frontend/client URLs |

---

## Useful Commands

```bash
# Test Discord login flow — open in browser
open "http://localhost:8000/auth/discord?next=http://localhost:5173"

# Test client_credentials flow
curl -X POST http://localhost:8000/oauth/token \
  -d "grant_type=client_credentials&client_id=ID&client_secret=SECRET&scope=openid"

# Test refresh token flow
curl -X POST http://localhost:8000/oauth/token \
  -d "grant_type=refresh_token&refresh_token=TOKEN&client_id=ID&client_secret=SECRET"

# Check OIDC discovery
curl http://localhost:8000/.well-known/openid-configuration | python3 -m json.tool

# Check JWKS
curl http://localhost:8000/.well-known/jwks.json | python3 -m json.tool

# Seed user profile data
python3 backend/seed_users.py

# Check Railway deployment status
railway service list
railway logs --service backend
```

---

## Project Structure

```
ns-auth/
├── backend/
│   ├── app/
│   │   ├── models/          # SQLAlchemy ORM models (user, oauth_app, tokens, scopes, claims)
│   │   ├── routers/         # FastAPI route handlers (oauth, auth, apps, scopes, wellknown)
│   │   ├── services/        # Business logic (token, session, authz, discord, claims)
│   │   ├── security/        # RSA keys, bcrypt hashing
│   │   ├── schemas/         # Pydantic request/response schemas
│   │   ├── config.py        # Settings (pydantic-settings, OAUTH_ prefix)
│   │   ├── database.py      # Async SQLAlchemy engine + session
│   │   └── main.py          # FastAPI app entrypoint
│   ├── alembic/             # Database migrations
│   ├── keys/                # Auto-generated RSA keys (local dev)
│   ├── requirements.txt
│   └── railway.toml
├── frontend/
│   ├── src/
│   │   ├── pages/           # Dashboard, CreateApp, AppDetail, Login, Consent
│   │   ├── components/      # shadcn-style UI components
│   │   └── lib/             # API client, utilities
│   ├── package.json
│   └── railway.toml
├── demo-app/
│   ├── src/
│   │   ├── pages/           # Home (Sign in button), Callback (profile + refresh)
│   │   └── config.ts        # OAuth client configuration
│   ├── package.json
│   └── railway.toml
└── CLAUDE.md                # Detailed technical reference
```
