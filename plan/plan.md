Plan to implement                                                                                                                                                     │
│                                                                                                                                                                       │
│ Add Authorization Code Flow — "Sign in with Network School"                                                                                                           │
│                                                                                                                                                                       │
│ Context                                                                                                                                                               │
│                                                                                                                                                                       │
│ The OAuth provider currently only supports client_credentials (machine-to-machine). We need the Authorization Code flow so NS residents can log into third-party apps │
│  with their NS identity. This builds the full infrastructure now with a simple email-based login, and documents how to plug in Privy (ns.com's auth provider) later.  │
│                                                                                                                                                                       │
│ The Flow We're Building                                                                                                                                               │
│                                                                                                                                                                       │
│ 1. App redirects user → GET /oauth/authorize?client_id=X&redirect_uri=...&scope=openid profile email&response_type=code                                               │
│ 2. User not logged in → redirect to frontend /login page                                                                                                              │
│ 3. User logs in (email-based for now, Privy later) → session cookie set                                                                                               │
│ 4. Redirect back to /oauth/authorize → shows consent screen                                                                                                           │
│ 5. User approves → auth code generated → redirect to app's callback?code=XXX&state=YYY                                                                                │
│ 6. App backend exchanges code → POST /oauth/token (grant_type=authorization_code)                                                                                     │
│ 7. App backend gets access_token + id_token with user claims                                                                                                          │
│ 8. App calls GET /oauth/userinfo → gets user profile                                                                                                                  │
│                                                                                                                                                                       │
│ ---                                                                                                                                                                   │
│ Phase 1: Dependencies + Config                                                                                                                                        │
│                                                                                                                                                                       │
│ backend/requirements.txt — add                                                                                                                                        │
│                                                                                                                                                                       │
│ psycopg2-binary==2.9.10   # (already present)                                                                                                                         │
│ No new deps needed yet. Privy SDK (privy-client) added later.                                                                                                         │
│                                                                                                                                                                       │
│ backend/app/config.py — add settings                                                                                                                                  │
│                                                                                                                                                                       │
│ session_secret: str = "change-me-in-production"           # OAUTH_SESSION_SECRET                                                                                      │
│ session_expiry_seconds: int = 86400                       # 24h                                                                                                       │
│ authorization_code_expiry_seconds: int = 600              # 10min                                                                                                     │
│ frontend_url: str = "http://localhost:5173"               # OAUTH_FRONTEND_URL                                                                                        │
│ privy_app_id: Optional[str] = None                        # OAUTH_PRIVY_APP_ID (future)                                                                               │
│ privy_app_secret: Optional[str] = None                    # OAUTH_PRIVY_APP_SECRET (future)                                                                           │
│                                                                                                                                                                       │
│ ---                                                                                                                                                                   │
│ Phase 2: Database Models + Migration                                                                                                                                  │
│                                                                                                                                                                       │
│ NEW backend/app/models/user.py                                                                                                                                        │
│                                                                                                                                                                       │
│ users table:                                                                                                                                                          │
│   id            UUID PK                                                                                                                                               │
│   privy_did     String(255), unique, indexed, nullable  ← nullable for now (email login), required when Privy added                                                   │
│   email         String(320), unique, indexed, not null                                                                                                                │
│   display_name  String(255), nullable                                                                                                                                 │
│   avatar_url    Text, nullable                                                                                                                                        │
│   cohort        String(100), nullable                                                                                                                                 │
│   created_at    DateTime(tz)                                                                                                                                          │
│   updated_at    DateTime(tz)                                                                                                                                          │
│                                                                                                                                                                       │
│ NEW backend/app/models/authorization_code.py                                                                                                                          │
│                                                                                                                                                                       │
│ authorization_codes table:                                                                                                                                            │
│   id                     UUID PK                                                                                                                                      │
│   code                   String(128), unique, indexed                                                                                                                 │
│   client_id              FK → oauth_apps.client_id CASCADE                                                                                                            │
│   user_id                FK → users.id CASCADE                                                                                                                        │
│   redirect_uri           Text                                                                                                                                         │
│   scope                  Text (space-delimited)                                                                                                                       │
│   code_challenge         String(128), nullable  ← PKCE                                                                                                                │
│   code_challenge_method  String(10), nullable                                                                                                                         │
│   state                  String(512), nullable                                                                                                                        │
│   used                   Boolean, default False                                                                                                                       │
│   expires_at             DateTime(tz)                                                                                                                                 │
│   created_at             DateTime(tz)                                                                                                                                 │
│                                                                                                                                                                       │
│ MODIFY backend/app/models/access_token.py                                                                                                                             │
│                                                                                                                                                                       │
│ - Add user_id: Optional[UUID] FK → users.id SET NULL, nullable (null for client_credentials tokens)                                                                   │
│                                                                                                                                                                       │
│ MODIFY backend/app/models/__init__.py                                                                                                                                 │
│                                                                                                                                                                       │
│ - Export User, AuthorizationCode                                                                                                                                      │
│                                                                                                                                                                       │
│ Alembic migration                                                                                                                                                     │
│                                                                                                                                                                       │
│ - alembic revision --autogenerate -m "add users authcodes and token user_id"                                                                                          │
│                                                                                                                                                                       │
│ ---                                                                                                                                                                   │
│ Phase 3: Session Service                                                                                                                                              │
│                                                                                                                                                                       │
│ NEW backend/app/services/session_service.py                                                                                                                           │
│                                                                                                                                                                       │
│ - create_session_token(user_id) → str — HS256 JWT with sub=user_id, type=session                                                                                      │
│ - set_session_cookie(response, token) — httponly, secure, samesite=lax                                                                                                │
│ - clear_session_cookie(response)                                                                                                                                      │
│ - get_session_user_id(request) → Optional[UUID] — decode cookie, return user_id or None                                                                               │
│                                                                                                                                                                       │
│ ---                                                                                                                                                                   │
│ Phase 4: Authorization Code Service                                                                                                                                   │
│                                                                                                                                                                       │
│ NEW backend/app/services/authz_service.py                                                                                                                             │
│                                                                                                                                                                       │
│ - validate_authorize_request(db, client_id, redirect_uri, response_type, scope) → (app, error)                                                                        │
│   - Checks: response_type=code, client_id exists, redirect_uri in app's allowed list, scopes valid                                                                    │
│ - create_authorization_code(db, client_id, user_id, redirect_uri, scope, code_challenge, ...) → code                                                                  │
│   - Generates secrets.token_urlsafe(64), stores with 10min expiry                                                                                                     │
│ - exchange_authorization_code(db, code, redirect_uri, client_id, code_verifier) → (auth_code, error)                                                                  │
│   - Validates: code exists, not used, not expired, client_id matches, redirect_uri matches, PKCE S256 check                                                           │
│   - Marks code as used                                                                                                                                                │
│                                                                                                                                                                       │
│ ---                                                                                                                                                                   │
│ Phase 5: User Service (email-based login for now)                                                                                                                     │
│                                                                                                                                                                       │
│ NEW backend/app/services/user_service.py                                                                                                                              │
│                                                                                                                                                                       │
│ - get_or_create_user_by_email(db, email, display_name) → User                                                                                                         │
│   - Finds by email or creates new user (JIT provisioning)                                                                                                             │
│   - Simple for now — no password, just email identification                                                                                                           │
│ - get_user(db, user_id) → Optional[User]                                                                                                                              │
│                                                                                                                                                                       │
│ This gets replaced/extended with Privy verification later.                                                                                                            │
│                                                                                                                                                                       │
│ ---                                                                                                                                                                   │
│ Phase 6: Token Service Extensions                                                                                                                                     │
│                                                                                                                                                                       │
│ MODIFY backend/app/services/token_service.py — add two functions                                                                                                      │
│                                                                                                                                                                       │
│ - issue_user_token(db, client_id, user_id, scope) → (jwt, expires_in)                                                                                                 │
│   - Same as issue_token but sub = user_id (not client_id), stores user_id on AccessToken                                                                              │
│ - issue_id_token(db, client_id, user_id, scope) → Optional[str]                                                                                                       │
│   - Only if "openid" in scopes                                                                                                                                        │
│   - Claims: iss, sub (user_id), aud (client_id), exp, iat                                                                                                             │
│   - Adds email/name/picture/cohort based on granted scopes                                                                                                            │
│   - Signed RS256 (same keys)                                                                                                                                          │
│                                                                                                                                                                       │
│ ---                                                                                                                                                                   │
│ Phase 7: Backend Endpoints                                                                                                                                            │
│                                                                                                                                                                       │
│ NEW backend/app/routers/auth.py — auth router (prefix: /auth)                                                                                                         │
│ ┌──────────────┬────────┬───────────────────────────────────────────────────────────────────────────────────────────────────────────────┐                             │
│ │   Endpoint   │ Method │                                                    Purpose                                                    │                             │
│ ├──────────────┼────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────┤                             │
│ │ /auth/login  │ POST   │ Email-based login: accepts {email, display_name?}, creates/finds user, sets session cookie, returns user info │                             │
│ ├──────────────┼────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────┤                             │
│ │ /auth/me     │ GET    │ Returns current session user (from cookie)                                                                    │                             │
│ ├──────────────┼────────┼───────────────────────────────────────────────────────────────────────────────────────────────────────────────┤                             │
│ │ /auth/logout │ POST   │ Clears session cookie                                                                                         │                             │
│ └──────────────┴────────┴───────────────────────────────────────────────────────────────────────────────────────────────────────────────┘                             │
│ MODIFY backend/app/routers/oauth.py — add endpoints                                                                                                                   │
│ ┌──────────────────────────┬────────┬──────────────────────────────────────────────────────────────────────────────────┐                                              │
│ │         Endpoint         │ Method │                                     Purpose                                      │                                              │
│ ├──────────────────────────┼────────┼──────────────────────────────────────────────────────────────────────────────────┤                                              │
│ │ /oauth/authorize         │ GET    │ Authorization Code entry point — validates params, redirects to login or consent │                                              │
│ ├──────────────────────────┼────────┼──────────────────────────────────────────────────────────────────────────────────┤                                              │
│ │ /oauth/authorize/consent │ POST   │ Consent approval — generates auth code, redirects to app callback                │                                              │
│ ├──────────────────────────┼────────┼──────────────────────────────────────────────────────────────────────────────────┤                                              │
│ │ /oauth/authorize/info    │ GET    │ Returns app name + scope descriptions for consent UI                             │                                              │
│ ├──────────────────────────┼────────┼──────────────────────────────────────────────────────────────────────────────────┤                                              │
│ │ /oauth/userinfo          │ GET    │ OIDC UserInfo — returns user claims based on Bearer token scopes                 │                                              │
│ └──────────────────────────┴────────┴──────────────────────────────────────────────────────────────────────────────────┘                                              │
│ MODIFY backend/app/routers/oauth.py — extend POST /oauth/token                                                                                                        │
│                                                                                                                                                                       │
│ - Add authorization_code grant type branch                                                                                                                            │
│ - New form params: code, redirect_uri, code_verifier                                                                                                                  │
│ - Existing client_credentials path untouched                                                                                                                          │
│                                                                                                                                                                       │
│ MODIFY backend/app/routers/wellknown.py — add OIDC discovery                                                                                                          │
│ ┌───────────────────────────────────┬────────┬──────────────────────────────────┐                                                                                     │
│ │             Endpoint              │ Method │             Purpose              │                                                                                     │
│ ├───────────────────────────────────┼────────┼──────────────────────────────────┤                                                                                     │
│ │ /.well-known/openid-configuration │ GET    │ Standard OIDC discovery document │                                                                                     │
│ └───────────────────────────────────┴────────┴──────────────────────────────────┘                                                                                     │
│ Update existing oauth-authorization-server to include new grant types.                                                                                                │
│                                                                                                                                                                       │
│ MODIFY backend/app/main.py                                                                                                                                            │
│                                                                                                                                                                       │
│ - Register auth.router                                                                                                                                                │
│                                                                                                                                                                       │
│ ---                                                                                                                                                                   │
│ Phase 8: Frontend — Login + Consent Pages                                                                                                                             │
│                                                                                                                                                                       │
│ NEW frontend/src/pages/LoginPage.tsx                                                                                                                                  │
│                                                                                                                                                                       │
│ - Standalone page (no dashboard Layout)                                                                                                                               │
│ - Reads authorize params from URL query string                                                                                                                        │
│ - Shows branded "Sign in with Network School" card                                                                                                                    │
│ - Email input + "Continue" button (simple for now)                                                                                                                    │
│ - POSTs to /auth/login with email → session cookie set                                                                                                                │
│ - Redirects back to /oauth/authorize with original params                                                                                                             │
│                                                                                                                                                                       │
│ NEW frontend/src/pages/ConsentPage.tsx                                                                                                                                │
│                                                                                                                                                                       │
│ - Standalone page (no dashboard Layout)                                                                                                                               │
│ - Fetches app info from /oauth/authorize/info                                                                                                                         │
│ - Shows: "[App Name] wants to access your account"                                                                                                                    │
│ - Lists requested scopes with human-readable descriptions                                                                                                             │
│ - Approve / Deny buttons                                                                                                                                              │
│ - Approve → HTML form POST to /oauth/authorize/consent (browser follows 302 redirect natively)                                                                        │
│ - Deny → redirect to app callback with ?error=access_denied                                                                                                           │
│                                                                                                                                                                       │
│ MODIFY frontend/src/App.tsx                                                                                                                                           │
│                                                                                                                                                                       │
│ - Add routes: /login → LoginPage, /consent → ConsentPage (outside Layout)                                                                                             │
│                                                                                                                                                                       │
│ MODIFY frontend/src/lib/api.ts                                                                                                                                        │
│                                                                                                                                                                       │
│ - Add: login(email, displayName?), getCurrentUser(), logout(), getAuthorizeInfo(clientId, scope)                                                                      │
│                                                                                                                                                                       │
│ ---                                                                                                                                                                   │
│ Phase 9: Railway Env Vars + Deploy                                                                                                                                    │
│                                                                                                                                                                       │
│ Backend env vars to add:                                                                                                                                              │
│                                                                                                                                                                       │
│ OAUTH_SESSION_SECRET=<generate-random-64-char-string>                                                                                                                 │
│ OAUTH_FRONTEND_URL=https://frontend-production-a6eb.up.railway.app                                                                                                    │
│                                                                                                                                                                       │
│ Deploy                                                                                                                                                                │
│                                                                                                                                                                       │
│ railway up -d -s backend backend/ --path-as-root                                                                                                                      │
│ railway up -d -s frontend frontend/ --path-as-root                                                                                                                    │
│                                                                                                                                                                       │
│ ---                                                                                                                                                                   │
│ File Manifest                                                                                                                                                         │
│                                                                                                                                                                       │
│ Create (8 files):                                                                                                                                                     │
│                                                                                                                                                                       │
│ - backend/app/models/user.py                                                                                                                                          │
│ - backend/app/models/authorization_code.py                                                                                                                            │
│ - backend/app/services/session_service.py                                                                                                                             │
│ - backend/app/services/authz_service.py                                                                                                                               │
│ - backend/app/services/user_service.py                                                                                                                                │
│ - backend/app/routers/auth.py                                                                                                                                         │
│ - frontend/src/pages/LoginPage.tsx                                                                                                                                    │
│ - frontend/src/pages/ConsentPage.tsx                                                                                                                                  │
│                                                                                                                                                                       │
│ Modify (9 files):                                                                                                                                                     │
│                                                                                                                                                                       │
│ - backend/app/config.py — new settings                                                                                                                                │
│ - backend/app/models/__init__.py — export new models                                                                                                                  │
│ - backend/app/models/access_token.py — add user_id column                                                                                                             │
│ - backend/app/services/token_service.py — add issue_user_token, issue_id_token                                                                                        │
│ - backend/app/routers/oauth.py — authorize, consent, userinfo, extend token                                                                                           │
│ - backend/app/routers/wellknown.py — OIDC discovery                                                                                                                   │
│ - backend/app/main.py — register auth router                                                                                                                          │
│ - frontend/src/App.tsx — add login/consent routes                                                                                                                     │
│ - frontend/src/lib/api.ts — add auth API methods                                                                                                                      │
│                                                                                                                                                                       │
│ Auto-generated (1 file):                                                                                                                                              │
│                                                                                                                                                                       │
│ - backend/alembic/versions/<hash>_add_users_authcodes_and_token_user_id.py                                                                                            │
│                                                                                                                                                                       │
│ ---                                                                                                                                                                   │
│ Verification                                                                                                                                                          │
│                                                                                                                                                                       │
│ 1. Run backend locally — migrations apply cleanly                                                                                                                     │
│ 2. GET /.well-known/openid-configuration returns valid OIDC metadata                                                                                                  │
│ 3. Test the full flow manually:                                                                                                                                       │
│   - Register an app with redirect_uris: ["http://localhost:3000/callback"] and scopes ["openid", "profile", "email"]                                                  │
│   - Open http://localhost:8000/oauth/authorize?response_type=code&client_id=XXX&redirect_uri=http://localhost:3000/callback&scope=openid profile email&state=test123  │
│   - Should redirect to login → enter email → consent screen → approve → redirects to localhost:3000/callback?code=XXX&state=test123                                   │
│   - Exchange code: POST /oauth/token with grant_type=authorization_code → get access_token + id_token                                                                 │
│   - GET /oauth/userinfo with Bearer token → get user profile                                                                                                          │
│ 4. Existing client_credentials flow still works (run test_client.py)                                                                                                  │
│ 5. Deploy to Railway and repeat                                                                                                                                       │
│                                                                                                                                                                       │
│ ---                                                                                                                                                                   │
│ Appendix A: ns.com Authentication Research Findings                                                                                                                   │
│                                                                                                                                                                       │
│ What ns.com Uses                                                                                                                                                      │
│                                                                                                                                                                       │
│ ns.com (Network School) uses Privy (privy.io) as its authentication provider. Privy is a Web3-friendly auth platform that also handles traditional login methods. All │
│  auth traffic goes through https://auth.privy.io.                                                                                                                     │
│                                                                                                                                                                       │
│ How We Discovered This                                                                                                                                                │
│                                                                                                                                                                       │
│ Privy was not obvious — there's no mention of "Privy" in the page HTML or inline scripts. It was found by analyzing the JavaScript bundle at                          │
│ /_next/static/chunks/4ba79c04-a9a9355530ce95c7.js, which contains the full Privy SDK implementation communicating with https://auth.privy.io.                         │
│                                                                                                                                                                       │
│ ns.com Login Methods                                                                                                                                                  │
│ ┌────────────────────────┬─────────────────────────────────────────────────┐                                                                                          │
│ │         Method         │                 Implementation                  │                                                                                          │
│ ├────────────────────────┼─────────────────────────────────────────────────┤                                                                                          │
│ │ Continue with Google   │ OAuth via Privy's Google integration            │                                                                                          │
│ ├────────────────────────┼─────────────────────────────────────────────────┤                                                                                          │
│ │ Continue with Apple    │ OAuth via Privy's Apple integration             │                                                                                          │
│ ├────────────────────────┼─────────────────────────────────────────────────┤                                                                                          │
│ │ Continue with Email    │ Email OTP code via Privy                        │                                                                                          │
│ ├────────────────────────┼─────────────────────────────────────────────────┤                                                                                          │
│ │ Wallet login (ETH/SOL) │ Supported in SDK bundle, may not be user-facing │                                                                                          │
│ ├────────────────────────┼─────────────────────────────────────────────────┤                                                                                          │
│ │ Passkeys/WebAuthn      │ Supported in SDK bundle                         │                                                                                          │
│ ├────────────────────────┼─────────────────────────────────────────────────┤                                                                                          │
│ │ Farcaster              │ Supported in SDK bundle                         │                                                                                          │
│ └────────────────────────┴─────────────────────────────────────────────────┘                                                                                          │
│ ns.com Full Tech Stack                                                                                                                                                │
│ ┌──────────────────┬─────────────────────────────────────────────────────────────────────────┐                                                                        │
│ │      Layer       │                               Technology                                │                                                                        │
│ ├──────────────────┼─────────────────────────────────────────────────────────────────────────┤                                                                        │
│ │ Framework        │ Next.js (App Router, React Server Components)                           │                                                                        │
│ ├──────────────────┼─────────────────────────────────────────────────────────────────────────┤                                                                        │
│ │ Deployment       │ Vercel (dpl_He87s9xutK2hjGHF1KPfDdB9Frxs)                               │                                                                        │
│ ├──────────────────┼─────────────────────────────────────────────────────────────────────────┤                                                                        │
│ │ Authentication   │ Privy (auth.privy.io)                                                   │                                                                        │
│ ├──────────────────┼─────────────────────────────────────────────────────────────────────────┤                                                                        │
│ │ State Management │ React Query (dehydrated state for SSR)                                  │                                                                        │
│ ├──────────────────┼─────────────────────────────────────────────────────────────────────────┤                                                                        │
│ │ Styling          │ Tailwind CSS                                                            │                                                                        │
│ ├──────────────────┼─────────────────────────────────────────────────────────────────────────┤                                                                        │
│ │ UI Components    │ Radix UI (AlertDialog, ScrollArea, Dialog), Vaul (drawer), Lucide icons │                                                                        │
│ ├──────────────────┼─────────────────────────────────────────────────────────────────────────┤                                                                        │
│ │ Video            │ Mux (player.mux.com, image.mux.com)                                     │                                                                        │
│ ├──────────────────┼─────────────────────────────────────────────────────────────────────────┤                                                                        │
│ │ Image CDN        │ assets.ns.com                                                           │                                                                        │
│ ├──────────────────┼─────────────────────────────────────────────────────────────────────────┤                                                                        │
│ │ Analytics        │ Google Analytics (G-RV2XE5BM4T)                                         │                                                                        │
│ ├──────────────────┼─────────────────────────────────────────────────────────────────────────┤                                                                        │
│ │ Error Tracking   │ Sentry                                                                  │                                                                        │
│ ├──────────────────┼─────────────────────────────────────────────────────────────────────────┤                                                                        │
│ │ Form Service     │ Fillout (server.fillout.com) for /apply page                            │                                                                        │
│ ├──────────────────┼─────────────────────────────────────────────────────────────────────────┤                                                                        │
│ │ Payments         │ Stripe (per privacy policy)                                             │                                                                        │
│ ├──────────────────┼─────────────────────────────────────────────────────────────────────────┤                                                                        │
│ │ Cloud Hosting    │ AWS + Google Cloud (per privacy policy)                                 │                                                                        │
│ ├──────────────────┼─────────────────────────────────────────────────────────────────────────┤                                                                        │
│ │ Fonts            │ Inter (body), Suisse Works (headings)                                   │                                                                        │
│ └──────────────────┴─────────────────────────────────────────────────────────────────────────┘                                                                        │
│ ns.com User Model (from /networkschool profile page)                                                                                                                  │
│ ┌───────────────┬─────────────────────────────────────────┬──────────────────────────────────────┐                                                                    │
│ │     Field     │                  Type                   │               Example                │                                                                    │
│ ├───────────────┼─────────────────────────────────────────┼──────────────────────────────────────┤                                                                    │
│ │ Profile ID    │ UUID                                    │ 23809e39-d643-49a5-9e67-9a82a71d53aa │                                                                    │
│ ├───────────────┼─────────────────────────────────────────┼──────────────────────────────────────┤                                                                    │
│ │ Username      │ string                                  │ networkschool                        │                                                                    │
│ ├───────────────┼─────────────────────────────────────────┼──────────────────────────────────────┤                                                                    │
│ │ Display Name  │ string                                  │ NS                                   │                                                                    │
│ ├───────────────┼─────────────────────────────────────────┼──────────────────────────────────────┤                                                                    │
│ │ Join Date     │ ISO 8601                                │ 2025-05-05T15:25:42.667871Z          │                                                                    │
│ ├───────────────┼─────────────────────────────────────────┼──────────────────────────────────────┤                                                                    │
│ │ Bio           │ optional text                           │ —                                    │                                                                    │
│ ├───────────────┼─────────────────────────────────────────┼──────────────────────────────────────┤                                                                    │
│ │ Social Links  │ URLs                                    │ LinkedIn, etc.                       │                                                                    │
│ ├───────────────┼─────────────────────────────────────────┼──────────────────────────────────────┤                                                                    │
│ │ User Stats    │ object                                  │ tasks entered, tasks won             │                                                                    │
│ ├───────────────┼─────────────────────────────────────────┼──────────────────────────────────────┤                                                                    │
│ │ User Activity │ tracked separately via React Query keys │                                      │                                                                    │
│ └───────────────┴─────────────────────────────────────────┴──────────────────────────────────────┘                                                                    │
│ ns.com Session Management                                                                                                                                             │
│                                                                                                                                                                       │
│ - Three-token system: privy:token (access), privy:refresh_token, privy:id_token stored in localStorage                                                                │
│ - Cross-tab sync: BroadcastChannel('auth') with postMessage({ type: 'LOGIN' })                                                                                        │
│ - Logout tracking: localStorage key ns:isLoggingOut                                                                                                                   │
│ - PKCE flow: OAuth uses code challenge/verifier (security best practice)                                                                                              │
│ - CSRF protection: State codes in localStorage                                                                                                                        │
│ - Captcha: Captcha token support in SDK                                                                                                                               │
│                                                                                                                                                                       │
│ ---                                                                                                                                                                   │
│ Appendix B: Privy Token System — Deep Technical Reference                                                                                                             │
│                                                                                                                                                                       │
│ Three Token Types                                                                                                                                                     │
│                                                                                                                                                                       │
│ Access Token                                                                                                                                                          │
│ ┌──────────┬────────────────────────────────┐                                                                                                                         │
│ │ Property │             Value              │                                                                                                                         │
│ ├──────────┼────────────────────────────────┤                                                                                                                         │
│ │ Format   │ ES256-signed JWT               │                                                                                                                         │
│ ├──────────┼────────────────────────────────┤                                                                                                                         │
│ │ Lifetime │ 1 hour (default, configurable) │                                                                                                                         │
│ ├──────────┼────────────────────────────────┤                                                                                                                         │
│ │ Issuer   │ "privy.io"                     │                                                                                                                         │
│ ├──────────┼────────────────────────────────┤                                                                                                                         │
│ │ Purpose  │ Proves user is authenticated   │                                                                                                                         │
│ └──────────┴────────────────────────────────┘                                                                                                                         │
│ JWT Claims:                                                                                                                                                           │
│ {                                                                                                                                                                     │
│   "sid": "session-id",                                                                                                                                                │
│   "sub": "did:privy:XXXXXX",                                                                                                                                          │
│   "iss": "privy.io",                                                                                                                                                  │
│   "aud": "<your-privy-app-id>",                                                                                                                                       │
│   "iat": 1700000000,                                                                                                                                                  │
│   "exp": 1700003600                                                                                                                                                   │
│ }                                                                                                                                                                     │
│ Delivered via Authorization: Bearer {token} header or privy-token HTTP-only cookie.                                                                                   │
│                                                                                                                                                                       │
│ Identity Token                                                                                                                                                        │
│ ┌──────────┬────────────────────────────────────────────────────────┐                                                                                                 │
│ │ Property │                         Value                          │                                                                                                 │
│ ├──────────┼────────────────────────────────────────────────────────┤                                                                                                 │
│ │ Format   │ ES256-signed JWT                                       │                                                                                                 │
│ ├──────────┼────────────────────────────────────────────────────────┤                                                                                                 │
│ │ Lifetime │ 10 hours (default, configurable)                       │                                                                                                 │
│ ├──────────┼────────────────────────────────────────────────────────┤                                                                                                 │
│ │ Purpose  │ Contains user profile data (linked accounts, metadata) │                                                                                                 │
│ └──────────┴────────────────────────────────────────────────────────┘                                                                                                 │
│ JWT Claims:                                                                                                                                                           │
│ {                                                                                                                                                                     │
│   "sub": "did:privy:XXXXXX",                                                                                                                                          │
│   "iss": "privy.io",                                                                                                                                                  │
│   "aud": "<your-privy-app-id>",                                                                                                                                       │
│   "iat": 1700000000,                                                                                                                                                  │
│   "exp": 1700036000,                                                                                                                                                  │
│   "linked_accounts": "[{\"type\":\"google_oauth\",\"email\":\"user@gmail.com\",\"name\":\"User Name\",...}]",                                                         │
│   "custom_metadata": "{}"                                                                                                                                             │
│ }                                                                                                                                                                     │
│ Delivered via privy-id-token header or HTTP-only cookie. Must be explicitly enabled in Privy Dashboard → User Management → Authentication → Advanced.                 │
│                                                                                                                                                                       │
│ Refresh Token                                                                                                                                                         │
│                                                                                                                                                                       │
│ - Opaque string (NOT a JWT — cannot be decoded)                                                                                                                       │
│ - 30-day lifetime                                                                                                                                                     │
│ - Managed entirely by Privy client SDK; backend never sees this                                                                                                       │
│                                                                                                                                                                       │
│ Token Verification                                                                                                                                                    │
│                                                                                                                                                                       │
│ There is NO JWKS endpoint. Privy does not expose /.well-known/jwks.json. Verification uses a static verification key from the Privy Dashboard (Configuration → App    │
│ settings).                                                                                                                                                            │
│                                                                                                                                                                       │
│ Option A: Python SDK (recommended)                                                                                                                                    │
│                                                                                                                                                                       │
│ # pip install privy-client                                                                                                                                            │
│ from privy.api import PrivyAPI                                                                                                                                        │
│                                                                                                                                                                       │
│ client = PrivyAPI(app_id="insert-app-id", app_secret="insert-app-secret")                                                                                             │
│                                                                                                                                                                       │
│ # Verify access token                                                                                                                                                 │
│ verified = client.users.verify_access_token(access_token)                                                                                                             │
│ # Returns: app_id, user_id, issuer, issued_at, expiration, session_id                                                                                                 │
│                                                                                                                                                                       │
│ # Get user by identity token                                                                                                                                          │
│ user = client.users.get_by_id_token(id_token="the-identity-token")                                                                                                    │
│ # Returns: full user object with linked accounts                                                                                                                      │
│                                                                                                                                                                       │
│ # Get user by DID                                                                                                                                                     │
│ user = client.users.get(user_id="did:privy:abc123")                                                                                                                   │
│                                                                                                                                                                       │
│ Note: The SDK is synchronous. In FastAPI (async), wrap calls with asyncio.get_event_loop().run_in_executor().                                                         │
│                                                                                                                                                                       │
│ Option B: Manual JWT Verification                                                                                                                                     │
│                                                                                                                                                                       │
│ import jwt  # PyJWT                                                                                                                                                   │
│                                                                                                                                                                       │
│ PRIVY_VERIFICATION_KEY = """-----BEGIN PUBLIC KEY-----                                                                                                                │
│ ...from Privy Dashboard...                                                                                                                                            │
│ -----END PUBLIC KEY-----"""                                                                                                                                           │
│ PRIVY_APP_ID = "your-privy-app-id"                                                                                                                                    │
│                                                                                                                                                                       │
│ decoded = jwt.decode(                                                                                                                                                 │
│     access_token,                                                                                                                                                     │
│     PRIVY_VERIFICATION_KEY,                                                                                                                                           │
│     algorithms=["ES256"],                                                                                                                                             │
│     issuer="privy.io",                                                                                                                                                │
│     audience=PRIVY_APP_ID                                                                                                                                             │
│ )                                                                                                                                                                     │
│                                                                                                                                                                       │
│ privy_did = decoded["sub"]  # e.g., "did:privy:clxyz..."                                                                                                              │
│                                                                                                                                                                       │
│ Must validate: signature (ES256), iss == "privy.io", aud == your app ID, exp not expired.                                                                             │
│                                                                                                                                                                       │
│ Privy User Object (from REST API)                                                                                                                                     │
│ ┌──────────────────┬──────────┬────────────────────────────────────────────────────────────────────┐                                                                  │
│ │      Field       │   Type   │                            Description                             │                                                                  │
│ ├──────────────────┼──────────┼────────────────────────────────────────────────────────────────────┤                                                                  │
│ │ id               │ string   │ Privy DID (did:privy:XXXX)                                         │                                                                  │
│ ├──────────────────┼──────────┼────────────────────────────────────────────────────────────────────┤                                                                  │
│ │ createdAt        │ ISO 8601 │ Account creation date                                              │                                                                  │
│ ├──────────────────┼──────────┼────────────────────────────────────────────────────────────────────┤                                                                  │
│ │ linkedAccounts   │ array    │ All linked accounts (see below)                                    │                                                                  │
│ ├──────────────────┼──────────┼────────────────────────────────────────────────────────────────────┤                                                                  │
│ │ mfaMethods       │ array    │ MFA methods configured                                             │                                                                  │
│ ├──────────────────┼──────────┼────────────────────────────────────────────────────────────────────┤                                                                  │
│ │ hasAcceptedTerms │ boolean  │ Terms acceptance                                                   │                                                                  │
│ ├──────────────────┼──────────┼────────────────────────────────────────────────────────────────────┤                                                                  │
│ │ isGuest          │ boolean  │ Guest account flag                                                 │                                                                  │
│ ├──────────────────┼──────────┼────────────────────────────────────────────────────────────────────┤                                                                  │
│ │ email            │ object   │ { address: "user@example.com" }                                    │                                                                  │
│ ├──────────────────┼──────────┼────────────────────────────────────────────────────────────────────┤                                                                  │
│ │ phone            │ object   │ { number: "+15555555555" }                                         │                                                                  │
│ ├──────────────────┼──────────┼────────────────────────────────────────────────────────────────────┤                                                                  │
│ │ wallet           │ object   │ First verified wallet (address, chainType)                         │                                                                  │
│ ├──────────────────┼──────────┼────────────────────────────────────────────────────────────────────┤                                                                  │
│ │ smartWallet      │ object   │ Smart wallet address                                               │                                                                  │
│ ├──────────────────┼──────────┼────────────────────────────────────────────────────────────────────┤                                                                  │
│ │ google           │ object   │ Google OAuth (subject, email, name)                                │                                                                  │
│ ├──────────────────┼──────────┼────────────────────────────────────────────────────────────────────┤                                                                  │
│ │ twitter          │ object   │ Twitter (subject, username, name, profilePictureUrl)               │                                                                  │
│ ├──────────────────┼──────────┼────────────────────────────────────────────────────────────────────┤                                                                  │
│ │ discord          │ object   │ Discord (subject, username, email)                                 │                                                                  │
│ ├──────────────────┼──────────┼────────────────────────────────────────────────────────────────────┤                                                                  │
│ │ github           │ object   │ GitHub (subject, username, name, email)                            │                                                                  │
│ ├──────────────────┼──────────┼────────────────────────────────────────────────────────────────────┤                                                                  │
│ │ farcaster        │ object   │ Farcaster (fid, ownerAddress, username, displayName, bio, pfp)     │                                                                  │
│ ├──────────────────┼──────────┼────────────────────────────────────────────────────────────────────┤                                                                  │
│ │ telegram         │ object   │ Telegram (telegramUserId, firstName, lastName, username, photoUrl) │                                                                  │
│ ├──────────────────┼──────────┼────────────────────────────────────────────────────────────────────┤                                                                  │
│ │ customMetadata   │ object   │ Server-set key-value pairs                                         │                                                                  │
│ └──────────────────┴──────────┴────────────────────────────────────────────────────────────────────┘                                                                  │
│ Linked Account Types: wallet, smart_wallet, email, phone, google_oauth, twitter_oauth, discord_oauth, github_oauth, spotify_oauth, instagram_oauth, tiktok_oauth,     │
│ line_oauth, linkedin_oauth, apple_oauth, farcaster, telegram, passkey, custom_auth, cross_app                                                                         │
│                                                                                                                                                                       │
│ Privy REST API                                                                                                                                                        │
│ ┌─────────────────┬────────┬─────────────────────────────────┐                                                                                                        │
│ │    Operation    │ Method │              Path               │                                                                                                        │
│ ├─────────────────┼────────┼─────────────────────────────────┤                                                                                                        │
│ │ Get user by DID │ GET    │ /api/v1/users/{did}             │                                                                                                        │
│ ├─────────────────┼────────┼─────────────────────────────────┤                                                                                                        │
│ │ List all users  │ GET    │ /api/v1/users?cursor=&limit=100 │                                                                                                        │
│ ├─────────────────┼────────┼─────────────────────────────────┤                                                                                                        │
│ │ Query by email  │ POST   │ /api/v1/users/email/address     │                                                                                                        │
│ ├─────────────────┼────────┼─────────────────────────────────┤                                                                                                        │
│ │ Query by wallet │ POST   │ /api/v1/users/wallet/address    │                                                                                                        │
│ ├─────────────────┼────────┼─────────────────────────────────┤                                                                                                        │
│ │ Query by phone  │ POST   │ /api/v1/users/phone/number      │                                                                                                        │
│ └─────────────────┴────────┴─────────────────────────────────┘                                                                                                        │
│ Auth for all REST calls:                                                                                                                                              │
│ - Base URL: https://api.privy.io                                                                                                                                      │
│ - Authorization: Basic {base64(app_id:app_secret)}                                                                                                                    │
│ - Header: privy-app-id: {your-app-id}                                                                                                                                 │
│ - Content-Type: application/json                                                                                                                                      │
│                                                                                                                                                                       │
│ Critical Notes for Integration                                                                                                                                        │
│                                                                                                                                                                       │
│ 1. ES256, not RS256 — Privy uses ECDSA P-256, not RSA. Our OAuth provider uses RS256 for its own tokens; Privy tokens use a different algorithm.                      │
│ 2. You need ns.com's Privy credentials — either the verification key (read-only, safe to share) for manual verification, or app_id + app_secret for full SDK access.  │
│ 3. aud claim ties tokens to a specific Privy app — tokens from ns.com's Privy will have ns.com's app ID as audience.                                                  │
│ 4. Identity tokens require Dashboard opt-in — without enabling them, you only get access tokens (no user profile in the JWT).                                         │
│ 5. Python package is privy-client — not privy (that's an unrelated PyPI package for password protection).                                                             │
│ 6. SDK is sync-only — must use run_in_executor in async FastAPI code.                                                                                                 │
│                                                                                                                                                                       │
│ ---                                                                                                                                                                   │
│ Appendix C: Privy Integration Steps (for when ready)                                                                                                                  │
│                                                                                                                                                                       │
│ 1. Get credentials: Obtain Privy app_id + app_secret (either your own Privy account, or ns.com's verification key)                                                    │
│ 2. Install SDK: add privy-client to requirements.txt                                                                                                                  │
│ 3. Create backend/app/services/privy_service.py:                                                                                                                      │
│   - verify_privy_token(token) — uses PrivyAPI.users.verify_access_token() (sync, run in executor)                                                                     │
│   - get_privy_user_data(privy_did) — uses PrivyAPI.users.get()                                                                                                        │
│   - get_or_create_user(db, privy_did, privy_user_data) — JIT provision: find by privy_did or create, update profile on each login                                     │
│ 4. Add POST /auth/login/privy endpoint — accepts {privy_token}, verifies via SDK, creates/updates local user, sets session cookie                                     │
│ 5. Update frontend LoginPage — two options:                                                                                                                           │
│   - Embed Privy SDK: install @privy-io/react-auth, show Google/Apple/Email login directly                                                                             │
│   - Redirect to ns.com: redirect user to ns.com login, receive token on callback                                                                                      │
│ 6. Set Railway env vars: OAUTH_PRIVY_APP_ID, OAUTH_PRIVY_APP_SECRET                                                                                                   │
│ 7. Profile data extraction: iterate linked_accounts array — pull email/name from google_oauth, email from apple_oauth/email, avatar from Google profile picture       │
│ 8. Map Privy DID to local user: use did:privy:XXX as stable users.privy_did identifier                                                                                │
╰───────────────────────────────────────────────────────────────────────────────────────────────────