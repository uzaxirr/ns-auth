# Network School OAuth Provider

OAuth 2.0 / OpenID Connect identity provider for Network School. Lets third-party apps authenticate NS users via **"Sign in with Network School"** — the same pattern as "Sign in with Google."

## Architecture

```
┌─────────────┐     ┌─────────────────┐     ┌─────────────┐
│  Frontend    │     │    Backend       │     │  Demo App   │
│  (Admin UI)  │────▶│  (OAuth Server)  │◀────│  (Client)   │
│  React/Vite  │     │  FastAPI         │     │  React/Vite │
│  :5173       │     │  :8000           │     │  :3000      │
└─────────────┘     └────────┬─────────┘     └─────────────┘
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
- **Privy account** — you need an app ID and secret from [privy.io](https://privy.io)

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

# Demo app
cd ../demo-app
npm install
```

### 3. Configure environment variables

**`backend/.env`**

```env
OAUTH_PRIVY_APP_ID=<your privy app id>
OAUTH_PRIVY_APP_SECRET=<your privy app secret>
OAUTH_SESSION_SECRET=<64+ character random string>
OAUTH_CORS_ORIGINS=["http://localhost:5173","http://localhost:3000"]
OAUTH_FRONTEND_URL=http://localhost:5173
```

All backend env vars use the `OAUTH_` prefix. See `backend/app/config.py` for the full list with defaults.

**`frontend/.env`**

```env
VITE_API_BASE=http://localhost:8000
VITE_PRIVY_APP_ID=<same privy app id>
```

**`demo-app/.env`**

```env
VITE_OAUTH_SERVER=http://localhost:8000
VITE_CLIENT_ID=<client_id from registering an app>
VITE_CLIENT_SECRET=<client_secret from registering an app>
VITE_REDIRECT_URI=http://localhost:3000/callback
VITE_SCOPES=openid profile email cohort socials wallet
```

> You'll get the `CLIENT_ID` and `CLIENT_SECRET` after registering an OAuth app (step 5 below).

### 4. Run database migrations

```bash
cd backend
alembic upgrade head
```

### 5. Start all three services

Run each in a separate terminal:

```bash
# Terminal 1 — Backend (port 8000)
cd backend
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000

# Terminal 2 — Frontend (port 5173)
cd frontend
npm run dev

# Terminal 3 — Demo App (port 3000)
cd demo-app
npm run dev
```

### 6. Register your first OAuth app

Open http://localhost:5173, log in via Privy, and click **Create App**. Or use the API:

```bash
curl -X POST http://localhost:8000/api/apps/ \
  -H "Content-Type: application/json" \
  -d '{
    "name": "My App",
    "description": "My test application",
    "scopes": ["openid", "profile", "email"],
    "redirect_uris": ["http://localhost:3000/callback"],
    "icon_url": "https://ui-avatars.com/api/?name=MA&background=3b82f6&color=fff&size=128"
  }'
```

The response includes `client_id` and `client_secret`. Put these in your `demo-app/.env` and restart the demo app.

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

Returns `client_id` and `client_secret`. **Save the secret** — it's only shown once.

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

| Scope | Claims Returned | Description |
|-------|----------------|-------------|
| `openid` | `sub` | Required. User's unique ID |
| `profile` | `name`, `picture`, `bio` | Display name, avatar, bio |
| `email` | `email`, `email_verified` | Email address |
| `cohort` | `cohort` | NS cohort (e.g. "NS-7") |
| `socials` | `socials` | JSON: twitter, github, linkedin, website |
| `wallet` | `wallet_address` | Blockchain wallet address |
| `activity` | `posts_count`, `streak_days`, `last_active` | Activity statistics |
| `offline_access` | — | Enables refresh tokens |

---

## OAuth Flows

### Authorization Code + PKCE (User-Facing)

This is the primary flow for apps that want users to "Sign in with Network School."

```
Your App                    NS OAuth Server                 User
  │                              │                            │
  │──1. Redirect to /authorize──▶│                            │
  │                              │──2. Show login/consent───▶│
  │                              │◀──3. User approves────────│
  │◀──4. Redirect with code──────│                            │
  │──5. POST /oauth/token───────▶│                            │
  │◀──6. Return access_token─────│                            │
  │──7. GET /oauth/userinfo─────▶│                            │
  │◀──8. Return user claims──────│                            │
```

**Step 1 — Redirect user to authorize:**

```
GET /oauth/authorize
  ?response_type=code
  &client_id=YOUR_CLIENT_ID
  &redirect_uri=https://yourapp.com/callback
  &scope=openid profile email
  &state=RANDOM_STATE
  &code_challenge=BASE64URL_SHA256_HASH
  &code_challenge_method=S256
```

**Step 2-4 — User logs in via Privy, approves scopes, gets redirected back:**

```
https://yourapp.com/callback?code=AUTH_CODE&state=RANDOM_STATE
```

**Step 5 — Exchange code for tokens:**

```bash
curl -X POST https://backend-production-c59b.up.railway.app/oauth/token \
  -d "grant_type=authorization_code" \
  -d "code=AUTH_CODE" \
  -d "redirect_uri=https://yourapp.com/callback" \
  -d "client_id=YOUR_CLIENT_ID" \
  -d "client_secret=YOUR_CLIENT_SECRET" \
  -d "code_verifier=ORIGINAL_RANDOM_STRING"
```

**Step 7 — Fetch user info:**

```bash
curl https://backend-production-c59b.up.railway.app/oauth/userinfo \
  -H "Authorization: Bearer ACCESS_TOKEN"
```

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
| `/oauth/authorize/consent` | POST | User approves/denies (returns JSON `{redirect_to}`) |
| `/oauth/authorize/info` | GET | Get app name + scopes for consent UI |
| `/oauth/token` | POST | Exchange code or credentials for tokens |
| `/oauth/userinfo` | GET | Get user claims (Bearer token required) |
| `/.well-known/openid-configuration` | GET | OIDC discovery document |
| `/.well-known/jwks.json` | GET | Public JWK set for token verification |
| `/auth/login/privy` | POST | Exchange Privy token for session cookie |
| `/auth/me` | GET | Current user from session cookie |
| `/api/apps/` | CRUD | Manage OAuth applications |

---

## Database & Migrations

### Tables

| Table | Purpose |
|-------|---------|
| `users` | NS users (UUID id, privy_did, email, display_name, avatar_url, cohort, bio, socials, wallet_address) |
| `oauth_apps` | Registered OAuth applications (client_id, hashed client_secret, scopes, redirect_uris) |
| `access_tokens` | Issued access tokens |
| `authorization_codes` | Temporary auth codes (10 min TTL) |
| `alembic_version` | Migration tracking |

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
| `OAUTH_PRIVY_APP_ID` | Privy app ID |
| `OAUTH_PRIVY_APP_SECRET` | Privy app secret |
| `OAUTH_SESSION_SECRET` | 64+ char secret for session JWTs |
| `OAUTH_CORS_ORIGINS` | JSON array of allowed origins |
| `OAUTH_FRONTEND_URL` | Frontend URL for redirects |

**Frontend** (`--service frontend`):

| Variable | Description |
|----------|-------------|
| `VITE_API_BASE` | Backend URL |
| `VITE_PRIVY_APP_ID` | Privy app ID |
| `NIXPACKS_NODE_VERSION` | Set to `20` (required for Vite 7 + Privy SDK) |

**Demo App** (`--service demo-app`):

| Variable | Description |
|----------|-------------|
| `VITE_OAUTH_SERVER` | Backend URL |
| `VITE_CLIENT_ID` | OAuth app client_id |
| `VITE_CLIENT_SECRET` | OAuth app client_secret |
| `VITE_REDIRECT_URI` | Callback URL (demo-app URL + `/callback`) |
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
# Test client_credentials flow
curl -X POST http://localhost:8000/oauth/token \
  -d "grant_type=client_credentials&client_id=ID&client_secret=SECRET&scope=openid"

# Dev login (skip Privy OTP — local only)
curl -X POST http://localhost:8000/auth/dev/login-as \
  -H "Content-Type: application/json" \
  -d '{"email": "user@example.com"}'

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
│   │   ├── models/          # SQLAlchemy ORM models
│   │   ├── routers/         # FastAPI route handlers
│   │   ├── services/        # Business logic
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
│   │   ├── config.ts        # OAuth client configuration
│   │   ├── Home.tsx         # "Sign in with NS" button + PKCE
│   │   └── Callback.tsx     # Token exchange + userinfo display
│   ├── package.json
│   └── railway.toml
└── CLAUDE.md                # Detailed technical reference
```
