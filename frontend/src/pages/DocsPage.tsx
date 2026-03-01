import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { BookOpen, Code2, Key, Shield, ExternalLink, ArrowRight, Zap } from "lucide-react"
import { CodeBlock } from "@/components/docs/CodeBlock"

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:8000"

const SECTIONS = [
  { id: "overview", label: "Overview" },
  { id: "quickstart", label: "Quick Start" },
  { id: "register", label: "Register Your App" },
  { id: "auth-flow", label: "Authorization Flow" },
  { id: "endpoints", label: "Endpoints" },
  { id: "scopes", label: "Scopes & Claims" },
  { id: "react", label: "React" },
  { id: "nextjs", label: "Next.js" },
  { id: "nextauth", label: "NextAuth / Auth.js" },
  { id: "refresh", label: "Token Refresh" },
  { id: "errors", label: "Error Handling" },
  { id: "oidc", label: "OIDC Discovery" },
]

/* ── Code snippets ── */

const PKCE_CODE = `// pkce.ts — Generate PKCE S256 challenge
export async function generatePKCE() {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  const codeVerifier = btoa(String.fromCharCode(...array))
    .replace(/\\+/g, "-")
    .replace(/\\//g, "_")
    .replace(/=+$/, "")

  const encoder = new TextEncoder()
  const digest = await crypto.subtle.digest(
    "SHA-256",
    encoder.encode(codeVerifier)
  )
  const codeChallenge = btoa(
    String.fromCharCode(...new Uint8Array(digest))
  )
    .replace(/\\+/g, "-")
    .replace(/\\//g, "_")
    .replace(/=+$/, "")

  return { codeVerifier, codeChallenge }
}`

const REACT_SIGNIN_CODE = `// SignInWithNS.tsx
import { generatePKCE } from "./pkce"

const OAUTH_SERVER = "https://backend-production-c59b.up.railway.app"
const CLIENT_ID   = "your-client-id"
const REDIRECT_URI = "https://yourapp.com/callback"
const SCOPES = "openid profile email roles"

export function SignInWithNS() {
  async function handleSignIn() {
    const { codeVerifier, codeChallenge } = await generatePKCE()
    sessionStorage.setItem("pkce_code_verifier", codeVerifier)

    const state = crypto.randomUUID()
    sessionStorage.setItem("oauth_state", state)

    const params = new URLSearchParams({
      response_type: "code",
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      scope: SCOPES,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    })

    window.location.href =
      \`\${OAUTH_SERVER}/oauth/authorize?\${params}\`
  }

  return (
    <button onClick={handleSignIn}>
      Sign in with Network School
    </button>
  )
}`

const REACT_CALLBACK_CODE = `// Callback.tsx
import { useEffect, useRef, useState } from "react"

const OAUTH_SERVER = "https://backend-production-c59b.up.railway.app"
const CLIENT_ID    = "your-client-id"
const CLIENT_SECRET = "your-client-secret"
const REDIRECT_URI  = "https://yourapp.com/callback"

export function Callback() {
  const [user, setUser] = useState(null)
  const exchanged = useRef(false)

  useEffect(() => {
    async function exchange() {
      // Guard against React StrictMode double-mount
      if (exchanged.current) return
      exchanged.current = true

      const params = new URLSearchParams(window.location.search)
      const code  = params.get("code")
      const state = params.get("state")

      // Verify state matches
      if (state !== sessionStorage.getItem("oauth_state")) {
        throw new Error("State mismatch")
      }

      const codeVerifier =
        sessionStorage.getItem("pkce_code_verifier")

      // Exchange code for tokens
      const tokenRes = await fetch(
        \`\${OAUTH_SERVER}/oauth/token\`,
        {
          method: "POST",
          headers: {
            "Content-Type":
              "application/x-www-form-urlencoded",
          },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code,
            redirect_uri: REDIRECT_URI,
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            code_verifier: codeVerifier,
          }),
        }
      )
      const tokens = await tokenRes.json()

      // Fetch user profile
      const userRes = await fetch(
        \`\${OAUTH_SERVER}/oauth/userinfo\`,
        {
          headers: {
            Authorization: \`Bearer \${tokens.access_token}\`,
          },
        }
      )
      setUser(await userRes.json())
    }

    exchange()
  }, [])

  if (!user) return <p>Signing in...</p>
  return <pre>{JSON.stringify(user, null, 2)}</pre>
}`

const NEXTJS_BUTTON_CODE = `// app/components/SignInButton.tsx
"use client"

import { generatePKCE } from "@/lib/pkce"

const OAUTH_SERVER = "https://backend-production-c59b.up.railway.app"
const CLIENT_ID    = "your-client-id"
const REDIRECT_URI = "https://yourapp.com/api/auth/callback"
const SCOPES = "openid profile email roles"

export function SignInButton() {
  async function handleClick() {
    const { codeVerifier, codeChallenge } = await generatePKCE()
    sessionStorage.setItem("pkce_code_verifier", codeVerifier)

    const state = crypto.randomUUID()
    sessionStorage.setItem("oauth_state", state)

    const params = new URLSearchParams({
      response_type: "code",
      client_id: CLIENT_ID,
      redirect_uri: REDIRECT_URI,
      scope: SCOPES,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: "S256",
    })

    window.location.href =
      \`\${OAUTH_SERVER}/oauth/authorize?\${params}\`
  }

  return (
    <button onClick={handleClick}>
      Sign in with Network School
    </button>
  )
}`

const NEXTJS_ROUTE_CODE = `// app/api/auth/callback/route.ts
import { NextRequest, NextResponse } from "next/server"

const OAUTH_SERVER  = "https://backend-production-c59b.up.railway.app"
const CLIENT_ID     = process.env.NS_CLIENT_ID!
const CLIENT_SECRET = process.env.NS_CLIENT_SECRET!
const REDIRECT_URI  = process.env.NS_REDIRECT_URI!

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code")
  const codeVerifier =
    req.cookies.get("pkce_code_verifier")?.value

  // Exchange code for tokens (server-side)
  const tokenRes = await fetch(
    \`\${OAUTH_SERVER}/oauth/token\`,
    {
      method: "POST",
      headers: {
        "Content-Type":
          "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        code: code!,
        redirect_uri: REDIRECT_URI,
        client_id: CLIENT_ID,
        client_secret: CLIENT_SECRET,
        ...(codeVerifier && { code_verifier: codeVerifier }),
      }),
    }
  )
  const tokens = await tokenRes.json()

  // Fetch user profile
  const userRes = await fetch(
    \`\${OAUTH_SERVER}/oauth/userinfo\`,
    {
      headers: {
        Authorization: \`Bearer \${tokens.access_token}\`,
      },
    }
  )
  const user = await userRes.json()

  // Store session however you like (cookie, DB, etc.)
  // Then redirect to your app
  const response = NextResponse.redirect(
    new URL("/dashboard", req.url)
  )
  response.cookies.set("session", tokens.access_token, {
    httpOnly: true,
    secure: true,
    sameSite: "lax",
  })

  return response
}`

const NEXTAUTH_CODE = `// auth.ts — NextAuth / Auth.js configuration
import NextAuth from "next-auth"

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    {
      id: "network-school",
      name: "Network School",
      type: "oidc",
      // This single URL auto-configures everything:
      // endpoints, scopes, token signing, JWKS, etc.
      issuer:
        "https://backend-production-c59b.up.railway.app",
      clientId: process.env.NS_CLIENT_ID!,
      clientSecret: process.env.NS_CLIENT_SECRET!,
      checks: ["pkce", "state"],
      profile(profile) {
        return {
          id: profile.sub,
          name: profile.name,
          email: profile.email,
          image: profile.picture,
        }
      },
    },
  ],
})`

const NEXTAUTH_ENV_CODE = `# .env.local
NS_CLIENT_ID=your-client-id
NS_CLIENT_SECRET=your-client-secret
NEXTAUTH_URL=https://yourapp.com
NEXTAUTH_SECRET=generate-a-random-secret`

const NEXTAUTH_ROUTE_CODE = `// app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/auth"
export const { GET, POST } = handlers`

const NEXTAUTH_BUTTON_CODE = `// app/components/SignInButton.tsx
import { signIn, signOut, auth } from "@/auth"

export async function SignInButton() {
  const session = await auth()

  if (session?.user) {
    return (
      <div>
        <p>Welcome, {session.user.name}</p>
        <form action={async () => {
          "use server"
          await signOut()
        }}>
          <button>Sign out</button>
        </form>
      </div>
    )
  }

  return (
    <form action={async () => {
      "use server"
      await signIn("network-school")
    }}>
      <button>Sign in with Network School</button>
    </form>
  )
}`

const REFRESH_CODE = `// Refresh an expired access token
async function refreshAccessToken(refreshToken: string) {
  const res = await fetch(
    "https://backend-production-c59b.up.railway.app/oauth/token",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "refresh_token",
        refresh_token: refreshToken,
        client_id: "your-client-id",
        client_secret: "your-client-secret",
      }),
    }
  )

  const tokens = await res.json()
  // tokens.access_token  — new access token
  // tokens.refresh_token — new refresh token (rotation)
  return tokens
}`

const USERINFO_EXAMPLE = `{
  "sub": "3eda7aa4-9114-4a6a-8f68-c91d0553c3c9",
  "email": "alice@networkschool.com",
  "email_verified": true,
  "name": "Alice",
  "picture": "https://cdn.discordapp.com/avatars/...",
  "discord_username": "alice",
  "roles": [
    { "id": "1234567890", "name": "Cohort 5" },
    { "id": "0987654321", "name": "Builder" }
  ],
  "date_joined": "2024-06-15T10:30:00Z",
  "discord_joined_at": "2024-06-14T08:00:00Z",
  "boosting_since": null,
  "public_badges": ["ActiveDeveloper"]
}`

const OIDC_RESPONSE = `{
  "issuer": "https://backend-production-c59b.up.railway.app",
  "authorization_endpoint": ".../oauth/authorize",
  "token_endpoint": ".../oauth/token",
  "userinfo_endpoint": ".../oauth/userinfo",
  "jwks_uri": ".../.well-known/jwks.json",
  "introspection_endpoint": ".../oauth/token/introspect",
  "revocation_endpoint": ".../oauth/token/revoke",
  "response_types_supported": ["code"],
  "grant_types_supported": [
    "client_credentials",
    "authorization_code",
    "refresh_token"
  ],
  "id_token_signing_alg_values_supported": ["RS256"],
  "scopes_supported": [
    "openid", "profile", "email",
    "roles", "date_joined", "offline_access"
  ],
  "code_challenge_methods_supported": ["S256", "plain"]
}`

/* ── Components ── */

function SectionHeading({ id, children }: { id: string; children: React.ReactNode }) {
  return (
    <h2 id={id} className="text-xl font-semibold text-foreground mt-12 mb-4 scroll-mt-20 flex items-center gap-2">
      {children}
    </h2>
  )
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-secondary text-xs font-medium text-muted-foreground border border-border">
      {children}
    </span>
  )
}

function EndpointRow({ method, path, description }: { method: string; path: string; description: string }) {
  const color = method === "GET" ? "text-emerald-500" : "text-amber-500"
  return (
    <tr className="border-b border-border">
      <td className="py-3 pr-4 whitespace-nowrap">
        <code className={`text-xs font-semibold ${color}`}>{method}</code>
      </td>
      <td className="py-3 pr-4">
        <code className="text-sm text-foreground">{path}</code>
      </td>
      <td className="py-3 text-sm text-muted-foreground">{description}</td>
    </tr>
  )
}

/* ── Main page ── */

export function DocsPage() {
  const [activeSection, setActiveSection] = useState("overview")

  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setActiveSection(entry.target.id)
          }
        }
      },
      { rootMargin: "-20% 0px -70% 0px" }
    )

    for (const section of SECTIONS) {
      const el = document.getElementById(section.id)
      if (el) observer.observe(el)
    }

    return () => observer.disconnect()
  }, [])

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto flex items-center justify-between h-14 px-4">
          <div className="flex items-center gap-6">
            <Link to="/" className="font-semibold text-foreground flex items-center gap-2">
              <BookOpen className="h-4 w-4" />
              NS OAuth
            </Link>
            <nav className="flex items-center gap-4 text-sm">
              <span className="text-foreground font-medium">Docs</span>
              <Link to="/" className="text-muted-foreground hover:text-foreground transition-colors">
                Dashboard
              </Link>
            </nav>
          </div>
          <a
            href="https://github.com"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            Demo App <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </header>

      <div className="max-w-6xl mx-auto px-4 flex gap-10">
        {/* Sidebar */}
        <aside className="hidden lg:block w-48 shrink-0 sticky top-14 h-[calc(100vh-3.5rem)] py-8 overflow-y-auto">
          <nav className="space-y-0.5">
            {SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#${s.id}`}
                className={`block px-3 py-1.5 text-sm rounded-md transition-colors ${
                  activeSection === s.id
                    ? "text-foreground bg-secondary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"
                }`}
              >
                {s.label}
              </a>
            ))}
          </nav>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0 py-8 pb-24">
          {/* Hero */}
          <section id="overview" className="mb-12">
            <h1 className="text-3xl font-bold text-foreground tracking-tight mb-3">
              Sign in with Network School
            </h1>
            <p className="text-muted-foreground text-lg mb-6 max-w-2xl">
              Add NS identity to your app with a standard OAuth 2.0 + OIDC flow.
              Verify membership, read Discord roles, and personalize experiences for NS members.
            </p>
            <div className="flex flex-wrap gap-2">
              <Pill><Shield className="h-3 w-3" /> OAuth 2.0 + PKCE</Pill>
              <Pill><Key className="h-3 w-3" /> RS256 JWTs</Pill>
              <Pill><Zap className="h-3 w-3" /> Live Discord data</Pill>
            </div>
          </section>

          {/* Quick Start */}
          <SectionHeading id="quickstart">Quick Start</SectionHeading>
          <p className="text-muted-foreground mb-6">Get "Sign in with Network School" working in 5 steps:</p>
          <ol className="space-y-4 mb-8">
            {[
              { title: "Register your app", desc: "Go to the dashboard and create an OAuth app. Save your client_id and client_secret." },
              { title: "Redirect to authorize", desc: "Send users to /oauth/authorize with your client_id, redirect_uri, scopes, and a PKCE challenge." },
              { title: "User signs in via Discord", desc: "NS OAuth handles Discord login and verifies the user is an NS Discord member." },
              { title: "Exchange code for tokens", desc: "Your callback receives an authorization code. POST it to /oauth/token to get an access_token (and optionally a refresh_token)." },
              { title: "Fetch user data", desc: "Call /oauth/userinfo with the access token to get the user's profile, roles, and other claims." },
            ].map((step, i) => (
              <li key={i} className="flex gap-4">
                <span className="flex-shrink-0 w-7 h-7 rounded-full bg-secondary text-foreground text-sm font-semibold flex items-center justify-center border border-border">
                  {i + 1}
                </span>
                <div>
                  <p className="font-medium text-foreground">{step.title}</p>
                  <p className="text-sm text-muted-foreground">{step.desc}</p>
                </div>
              </li>
            ))}
          </ol>

          {/* Register Your App */}
          <SectionHeading id="register">Register Your App</SectionHeading>
          <div className="bg-secondary/50 border border-border rounded-lg p-5 mb-6">
            <ol className="space-y-3 text-sm">
              <li className="flex gap-3">
                <span className="font-semibold text-foreground">1.</span>
                <span className="text-muted-foreground">
                  Go to the{" "}
                  <Link to="/" className="text-foreground underline underline-offset-4">
                    admin dashboard
                  </Link>{" "}
                  and click "New App".
                </span>
              </li>
              <li className="flex gap-3">
                <span className="font-semibold text-foreground">2.</span>
                <span className="text-muted-foreground">
                  Fill in your app name, description, and add your callback URL(s) as redirect URIs.
                </span>
              </li>
              <li className="flex gap-3">
                <span className="font-semibold text-foreground">3.</span>
                <span className="text-muted-foreground">
                  Select the scopes your app needs (e.g. <code className="text-foreground bg-secondary px-1 rounded">openid profile email roles</code>).
                </span>
              </li>
              <li className="flex gap-3">
                <span className="font-semibold text-foreground">4.</span>
                <span className="text-muted-foreground">
                  Copy your <code className="text-foreground bg-secondary px-1 rounded">client_id</code> and <code className="text-foreground bg-secondary px-1 rounded">client_secret</code>. The secret is shown only once.
                </span>
              </li>
            </ol>
          </div>

          {/* Authorization Flow */}
          <SectionHeading id="auth-flow">Authorization Flow</SectionHeading>
          <p className="text-muted-foreground mb-4">
            NS OAuth uses the <strong className="text-foreground">Authorization Code flow with PKCE</strong> (RFC 7636).
            PKCE is required for all clients and prevents authorization code interception attacks.
          </p>
          <div className="bg-secondary/50 border border-border rounded-lg p-5 mb-6 font-mono text-sm text-muted-foreground space-y-2">
            <p><span className="text-foreground">1.</span> Your app generates a PKCE code_verifier + code_challenge (S256)</p>
            <p><span className="text-foreground">2.</span> Redirect user to <code className="text-foreground">/oauth/authorize</code> with challenge</p>
            <p className="pl-4"><ArrowRight className="inline h-3 w-3 text-muted-foreground" /> User authenticates via Discord</p>
            <p className="pl-4"><ArrowRight className="inline h-3 w-3 text-muted-foreground" /> NS verifies Discord server membership</p>
            <p><span className="text-foreground">3.</span> Redirect back to your app with <code className="text-foreground">?code=...&state=...</code></p>
            <p><span className="text-foreground">4.</span> POST code + code_verifier to <code className="text-foreground">/oauth/token</code></p>
            <p><span className="text-foreground">5.</span> Receive access_token (+ refresh_token if <code className="text-foreground">offline_access</code> scope)</p>
            <p><span className="text-foreground">6.</span> GET <code className="text-foreground">/oauth/userinfo</code> with Bearer token</p>
          </div>

          {/* Endpoints */}
          <SectionHeading id="endpoints">Endpoints</SectionHeading>
          <p className="text-muted-foreground mb-4">
            Base URL: <code className="text-foreground bg-secondary px-1.5 py-0.5 rounded text-sm">{API_BASE}</code>
          </p>
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 pr-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Method</th>
                  <th className="py-2 pr-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Path</th>
                  <th className="py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</th>
                </tr>
              </thead>
              <tbody>
                <EndpointRow method="GET" path="/oauth/authorize" description="Start authorization code flow" />
                <EndpointRow method="POST" path="/oauth/token" description="Exchange code/credentials for tokens" />
                <EndpointRow method="GET" path="/oauth/userinfo" description="Get user claims (Bearer token required)" />
                <EndpointRow method="POST" path="/oauth/token/introspect" description="Check if a token is active" />
                <EndpointRow method="POST" path="/oauth/token/revoke" description="Revoke an access token" />
                <EndpointRow method="GET" path="/.well-known/openid-configuration" description="OIDC discovery document" />
                <EndpointRow method="GET" path="/.well-known/jwks.json" description="Public RSA keys for token verification" />
              </tbody>
            </table>
          </div>

          <h3 className="text-base font-semibold text-foreground mb-3">Authorize parameters</h3>
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 pr-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Parameter</th>
                  <th className="py-2 pr-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Required</th>
                  <th className="py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                <tr className="border-b border-border">
                  <td className="py-2 pr-4"><code className="text-foreground">response_type</code></td>
                  <td className="py-2 pr-4 text-muted-foreground">Yes</td>
                  <td className="py-2 text-muted-foreground">Must be <code className="text-foreground">"code"</code></td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2 pr-4"><code className="text-foreground">client_id</code></td>
                  <td className="py-2 pr-4 text-muted-foreground">Yes</td>
                  <td className="py-2 text-muted-foreground">Your app's client ID</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2 pr-4"><code className="text-foreground">redirect_uri</code></td>
                  <td className="py-2 pr-4 text-muted-foreground">Yes</td>
                  <td className="py-2 text-muted-foreground">Must match a registered redirect URI</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2 pr-4"><code className="text-foreground">scope</code></td>
                  <td className="py-2 pr-4 text-muted-foreground">No</td>
                  <td className="py-2 text-muted-foreground">Space-separated scopes (default: <code className="text-foreground">"openid"</code>)</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2 pr-4"><code className="text-foreground">state</code></td>
                  <td className="py-2 pr-4 text-muted-foreground">Recommended</td>
                  <td className="py-2 text-muted-foreground">CSRF protection — random string, verify on callback</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2 pr-4"><code className="text-foreground">code_challenge</code></td>
                  <td className="py-2 pr-4 text-muted-foreground">Yes</td>
                  <td className="py-2 text-muted-foreground">PKCE challenge (base64url-encoded SHA-256 hash)</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2 pr-4"><code className="text-foreground">code_challenge_method</code></td>
                  <td className="py-2 pr-4 text-muted-foreground">Yes</td>
                  <td className="py-2 text-muted-foreground">Must be <code className="text-foreground">"S256"</code></td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="text-base font-semibold text-foreground mb-3">Token request parameters</h3>
          <p className="text-sm text-muted-foreground mb-3">
            POST to <code className="text-foreground bg-secondary px-1 rounded">/oauth/token</code> with <code className="text-foreground bg-secondary px-1 rounded">Content-Type: application/x-www-form-urlencoded</code>
          </p>
          <div className="overflow-x-auto mb-8">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 pr-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Parameter</th>
                  <th className="py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                <tr className="border-b border-border">
                  <td className="py-2 pr-4"><code className="text-foreground">grant_type</code></td>
                  <td className="py-2 text-muted-foreground"><code className="text-foreground">"authorization_code"</code>, <code className="text-foreground">"refresh_token"</code>, or <code className="text-foreground">"client_credentials"</code></td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2 pr-4"><code className="text-foreground">code</code></td>
                  <td className="py-2 text-muted-foreground">Authorization code from callback</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2 pr-4"><code className="text-foreground">redirect_uri</code></td>
                  <td className="py-2 text-muted-foreground">Must match the authorize request</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2 pr-4"><code className="text-foreground">client_id</code></td>
                  <td className="py-2 text-muted-foreground">Your app's client ID</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2 pr-4"><code className="text-foreground">client_secret</code></td>
                  <td className="py-2 text-muted-foreground">Your app's client secret</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2 pr-4"><code className="text-foreground">code_verifier</code></td>
                  <td className="py-2 text-muted-foreground">PKCE code verifier (original random string)</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Scopes & Claims */}
          <SectionHeading id="scopes">Scopes & Claims</SectionHeading>
          <p className="text-muted-foreground mb-4">
            Request scopes in the authorize URL. The userinfo endpoint returns claims based on the granted scopes.
            Discord-sourced claims are fetched live with a 5-minute cache.
          </p>
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 pr-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Scope</th>
                  <th className="py-2 pr-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Claims</th>
                  <th className="py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Source</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                <tr className="border-b border-border">
                  <td className="py-2 pr-4"><code className="text-foreground">openid</code></td>
                  <td className="py-2 pr-4 text-muted-foreground"><code>sub</code></td>
                  <td className="py-2 text-muted-foreground">System</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2 pr-4"><code className="text-foreground">email</code></td>
                  <td className="py-2 pr-4 text-muted-foreground"><code>email</code>, <code>email_verified</code></td>
                  <td className="py-2 text-muted-foreground">Discord OAuth</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2 pr-4"><code className="text-foreground">profile</code></td>
                  <td className="py-2 pr-4 text-muted-foreground"><code>name</code>, <code>picture</code>, <code>discord_username</code>, <code>banner_url</code>, <code>accent_color</code>, <code>public_badges</code></td>
                  <td className="py-2 text-muted-foreground">Discord API (live)</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2 pr-4"><code className="text-foreground">roles</code></td>
                  <td className="py-2 pr-4 text-muted-foreground"><code>roles</code> (array of {`{id, name}`})</td>
                  <td className="py-2 text-muted-foreground">Discord API (live)</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2 pr-4"><code className="text-foreground">date_joined</code></td>
                  <td className="py-2 pr-4 text-muted-foreground"><code>date_joined</code>, <code>discord_joined_at</code>, <code>boosting_since</code></td>
                  <td className="py-2 text-muted-foreground">Discord API (live)</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2 pr-4"><code className="text-foreground">offline_access</code></td>
                  <td className="py-2 pr-4 text-muted-foreground">(grants refresh token)</td>
                  <td className="py-2 text-muted-foreground">System</td>
                </tr>
              </tbody>
            </table>
          </div>

          <h3 className="text-base font-semibold text-foreground mb-3">Example /oauth/userinfo response</h3>
          <CodeBlock code={USERINFO_EXAMPLE} language="json" filename="GET /oauth/userinfo" />

          {/* React */}
          <SectionHeading id="react">
            <Code2 className="h-5 w-5 text-muted-foreground" /> React Integration
          </SectionHeading>
          <p className="text-muted-foreground mb-4">
            Three files to add "Sign in with Network School" to a React app.
            Copy the PKCE helper, then use the sign-in button and callback components.
          </p>

          <h3 className="text-base font-semibold text-foreground mb-2">1. PKCE helper</h3>
          <CodeBlock code={PKCE_CODE} language="typescript" filename="pkce.ts" />

          <h3 className="text-base font-semibold text-foreground mb-2 mt-6">2. Sign-in button</h3>
          <CodeBlock code={REACT_SIGNIN_CODE} language="tsx" filename="SignInWithNS.tsx" />

          <h3 className="text-base font-semibold text-foreground mb-2 mt-6">3. Callback page</h3>
          <p className="text-sm text-muted-foreground mb-2">
            The <code className="text-foreground bg-secondary px-1 rounded">exchanged</code> ref prevents double-exchange in React StrictMode.
          </p>
          <CodeBlock code={REACT_CALLBACK_CODE} language="tsx" filename="Callback.tsx" />

          {/* Next.js */}
          <SectionHeading id="nextjs">
            <Code2 className="h-5 w-5 text-muted-foreground" /> Next.js Integration
          </SectionHeading>
          <p className="text-muted-foreground mb-4">
            For Next.js App Router, use a client-side sign-in button with an API route handler for the server-side token exchange.
          </p>

          <h3 className="text-base font-semibold text-foreground mb-2">1. Client-side sign-in button</h3>
          <p className="text-sm text-muted-foreground mb-2">
            Uses the same PKCE helper from the React section. Copy <code className="text-foreground bg-secondary px-1 rounded">pkce.ts</code> into your <code className="text-foreground bg-secondary px-1 rounded">lib/</code> folder.
          </p>
          <CodeBlock code={NEXTJS_BUTTON_CODE} language="tsx" filename="app/components/SignInButton.tsx" />

          <h3 className="text-base font-semibold text-foreground mb-2 mt-6">2. API route handler (server-side)</h3>
          <p className="text-sm text-muted-foreground mb-2">
            Keep your client_secret on the server. The route handler exchanges the code and creates a session.
          </p>
          <CodeBlock code={NEXTJS_ROUTE_CODE} language="typescript" filename="app/api/auth/callback/route.ts" />

          {/* NextAuth / Auth.js */}
          <SectionHeading id="nextauth">
            <Zap className="h-5 w-5 text-muted-foreground" /> NextAuth / Auth.js (Recommended)
          </SectionHeading>
          <p className="text-muted-foreground mb-4">
            The easiest way to integrate. Since NS OAuth is a standard <strong className="text-foreground">OIDC provider</strong>, NextAuth (Auth.js) can auto-configure
            everything from a single discovery URL — endpoints, scopes, token signing keys, and more. No manual PKCE or callback wiring needed.
          </p>
          <div className="bg-secondary/50 border border-border rounded-lg p-4 mb-6 text-sm text-muted-foreground">
            <strong className="text-foreground">What is OIDC?</strong> OpenID Connect is a standard identity layer on top of OAuth 2.0.
            It adds a discovery endpoint (<code className="text-foreground">/.well-known/openid-configuration</code>) that describes all server capabilities.
            Auth libraries read this URL and auto-configure themselves — no need to manually specify each endpoint.
          </div>

          <h3 className="text-base font-semibold text-foreground mb-2">1. Configure the provider</h3>
          <p className="text-sm text-muted-foreground mb-2">
            Just point NextAuth at the <code className="text-foreground bg-secondary px-1 rounded">issuer</code> URL. It fetches <code className="text-foreground bg-secondary px-1 rounded">/.well-known/openid-configuration</code> and auto-discovers all endpoints, signing algorithms, and supported scopes.
          </p>
          <CodeBlock code={NEXTAUTH_CODE} language="typescript" filename="auth.ts" />

          <h3 className="text-base font-semibold text-foreground mb-2 mt-6">2. Environment variables</h3>
          <CodeBlock code={NEXTAUTH_ENV_CODE} language="bash" filename=".env.local" />

          <h3 className="text-base font-semibold text-foreground mb-2 mt-6">3. API route</h3>
          <CodeBlock code={NEXTAUTH_ROUTE_CODE} language="typescript" filename="app/api/auth/[...nextauth]/route.ts" />

          <h3 className="text-base font-semibold text-foreground mb-2 mt-6">4. Sign-in button</h3>
          <CodeBlock code={NEXTAUTH_BUTTON_CODE} language="tsx" filename="app/components/SignInButton.tsx" />

          {/* Token Refresh */}
          <SectionHeading id="refresh">Token Refresh</SectionHeading>
          <p className="text-muted-foreground mb-4">
            Request the <code className="text-foreground bg-secondary px-1 rounded">offline_access</code> scope to receive a refresh token.
            Refresh tokens use rotation &mdash; each use returns a new refresh token and invalidates the old one.
          </p>
          <CodeBlock code={REFRESH_CODE} language="typescript" filename="refresh.ts" />

          {/* Error Handling */}
          <SectionHeading id="errors">Error Handling</SectionHeading>
          <p className="text-muted-foreground mb-4">
            The token endpoint returns errors as JSON with <code className="text-foreground bg-secondary px-1 rounded">error</code> and <code className="text-foreground bg-secondary px-1 rounded">error_description</code> fields.
          </p>
          <div className="overflow-x-auto mb-6">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-border">
                  <th className="py-2 pr-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Error</th>
                  <th className="py-2 pr-4 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Status</th>
                  <th className="py-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Description</th>
                </tr>
              </thead>
              <tbody className="text-sm">
                <tr className="border-b border-border">
                  <td className="py-2 pr-4"><code className="text-foreground">invalid_client</code></td>
                  <td className="py-2 pr-4 text-muted-foreground">401</td>
                  <td className="py-2 text-muted-foreground">Unknown client_id or wrong client_secret</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2 pr-4"><code className="text-foreground">invalid_grant</code></td>
                  <td className="py-2 pr-4 text-muted-foreground">400</td>
                  <td className="py-2 text-muted-foreground">Authorization code expired, already used, or PKCE mismatch</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2 pr-4"><code className="text-foreground">invalid_request</code></td>
                  <td className="py-2 pr-4 text-muted-foreground">400</td>
                  <td className="py-2 text-muted-foreground">Missing required parameters or redirect_uri mismatch</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2 pr-4"><code className="text-foreground">access_denied</code></td>
                  <td className="py-2 pr-4 text-muted-foreground">—</td>
                  <td className="py-2 text-muted-foreground">User denied consent (returned as query param on redirect)</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2 pr-4"><code className="text-foreground">not_ns_member</code></td>
                  <td className="py-2 pr-4 text-muted-foreground">—</td>
                  <td className="py-2 text-muted-foreground">User is not a member of the NS Discord server</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2 pr-4"><code className="text-foreground">invalid_token</code></td>
                  <td className="py-2 pr-4 text-muted-foreground">401</td>
                  <td className="py-2 text-muted-foreground">Access token is expired, revoked, or malformed</td>
                </tr>
                <tr className="border-b border-border">
                  <td className="py-2 pr-4"><code className="text-foreground">unsupported_grant_type</code></td>
                  <td className="py-2 pr-4 text-muted-foreground">400</td>
                  <td className="py-2 text-muted-foreground">Use authorization_code, refresh_token, or client_credentials</td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* OIDC Discovery */}
          <SectionHeading id="oidc">OIDC Discovery</SectionHeading>
          <p className="text-muted-foreground mb-4">
            <strong className="text-foreground">OpenID Connect (OIDC)</strong> is a standard identity layer on top of OAuth 2.0.
            While OAuth alone only handles authorization ("this app can access your data"), OIDC adds authentication ("this is who the user is").
          </p>
          <p className="text-muted-foreground mb-4">
            NS OAuth publishes an{" "}
            <a
              href={`${API_BASE}/.well-known/openid-configuration`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-foreground underline underline-offset-4"
            >
              OIDC discovery document
            </a>{" "}
            — a single JSON file that describes everything about the server: endpoints, supported scopes, signing algorithms, and where to find the public keys.
            Any OIDC-compatible library (NextAuth, Passport.js, Spring Security, etc.) can auto-configure itself from this one URL.
          </p>
          <div className="bg-secondary/50 border border-border rounded-lg p-4 mb-6 text-sm text-muted-foreground">
            <strong className="text-foreground">TL;DR:</strong> Point your auth library at{" "}
            <code className="text-foreground bg-secondary px-1 rounded">{API_BASE}/.well-known/openid-configuration</code>{" "}
            and it handles the rest — no need to manually configure each endpoint.
          </div>
          <CodeBlock code={OIDC_RESPONSE} language="json" filename="GET /.well-known/openid-configuration" />
          <p className="text-sm text-muted-foreground">
            Access tokens and ID tokens are signed with <strong className="text-foreground">RS256</strong>. Verify them using the public keys from{" "}
            <code className="text-foreground bg-secondary px-1 rounded">/.well-known/jwks.json</code>.
            The JWKS endpoint rotates keys automatically — always fetch it dynamically rather than hardcoding keys.
          </p>

          {/* Footer */}
          <div className="mt-16 pt-8 border-t border-border text-sm text-muted-foreground">
            <p>
              Need help? Check the{" "}
              <a
                href="https://demo-app-production-9550.up.railway.app"
                target="_blank"
                rel="noopener noreferrer"
                className="text-foreground underline underline-offset-4"
              >
                demo app
              </a>{" "}
              for a working reference implementation, or reach out to the NS engineering team.
            </p>
          </div>
        </main>
      </div>
    </div>
  )
}
