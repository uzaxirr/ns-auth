import { Link, Navigate } from "react-router-dom"
import { useRef } from "react"
import { motion, useInView } from "motion/react"
import {
  Shield,
  Key,
  Code2,
  Users,
  ArrowRight,
  ExternalLink,
  BookOpen,
  Fingerprint,
  Radio,
  Layers,
} from "lucide-react"

const DEMO_URL = import.meta.env.VITE_DEMO_URL || "https://demo.nsauth.org"
const APP_HOSTNAME = import.meta.env.VITE_APP_HOSTNAME || "app.nsauth.org"

/* ── Data ── */

const STEPS = [
  {
    num: "01",
    title: "Register",
    description: "Create an app in the dashboard. Get your client_id and secret.",
    icon: Key,
  },
  {
    num: "02",
    title: "Authenticate",
    description: "Redirect users to NS Auth. They sign in via Discord and approve scopes.",
    icon: Users,
  },
  {
    num: "03",
    title: "Access Data",
    description: "Exchange the code for tokens. Fetch profile, roles, and membership data.",
    icon: Code2,
  },
]

const FEATURES = [
  {
    title: "OAuth 2.0 + PKCE",
    description: "Standards-compliant. PKCE, RS256 signed tokens, and a discovery endpoint. Works with any auth library out of the box.",
    icon: Shield,
  },
  {
    title: "Membership Gating",
    description: "Every sign-in verifies the user is a current Network School Discord member. Non-members are blocked automatically.",
    icon: Fingerprint,
  },
  {
    title: "Real-time Data",
    description: "Discord roles, display name, avatar, badges — fetched live with a 5-minute cache. Always current, never stale.",
    icon: Radio,
  },
  {
    title: "Drop-in SDKs",
    description: "Copy-paste React and Next.js examples. Works with NextAuth via a single discovery URL. Full docs and a working demo app.",
    icon: Layers,
  },
]

const SCOPES = [
  { scope: "openid", claims: "sub", note: "User identity" },
  { scope: "profile", claims: "name, picture, username, badges", note: "Discord profile (live)" },
  { scope: "email", claims: "email, email_verified", note: "Discord email" },
  { scope: "roles", claims: "roles [ ]", note: "Discord server roles (live)" },
  { scope: "date_joined", claims: "date_joined, boosting_since", note: "Membership dates" },
  { scope: "offline_access", claims: "refresh_token", note: "Long-lived sessions" },
]

const USERINFO_JSON = `{
  "sub": "3eda7aa4-9114-4a6a-8f68-c91d0553c3c9",
  "name": "Alice",
  "picture": "https://cdn.discordapp.com/avatars/...",
  "email": "alice@networkschool.com",
  "email_verified": true,
  "discord_username": "alice",
  "roles": [
    { "id": "1234567890", "name": "Cohort 5" },
    { "id": "0987654321", "name": "Builder" }
  ],
  "date_joined": "2024-06-15T10:30:00Z",
  "public_badges": ["ActiveDeveloper"]
}`

/* ── Animated wrapper ── */

function Reveal({ children, className = "", delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  const ref = useRef(null)
  const inView = useInView(ref, { once: true, margin: "-80px" })
  return (
    <motion.div
      ref={ref}
      initial={{ opacity: 0, y: 24 }}
      animate={inView ? { opacity: 1, y: 0 } : { opacity: 0, y: 24 }}
      transition={{ duration: 0.5, ease: [0.25, 1, 0.5, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  )
}

/* ── Page ── */

export function LandingPage() {
  if (window.location.hostname === APP_HOSTNAME) {
    return <Navigate to="/dashboard" replace />
  }

  return (
    <div className="min-h-screen bg-white text-[#0a0a0a]">
      {/* ── Nav ── */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-xl border-b border-gray-200/60">
        <div className="max-w-[1200px] mx-auto flex items-center justify-between h-14 px-6">
          <div className="flex items-center gap-8">
            <Link to="/" className="font-semibold flex items-center gap-2">
              <Shield className="h-4 w-4" />
              NS Auth
            </Link>
            <nav className="hidden sm:flex items-center gap-5 text-sm text-[#666]">
              <Link to="/docs" className="hover:text-[#0a0a0a] transition-colors">Docs</Link>
              <a href={DEMO_URL} className="hover:text-[#0a0a0a] transition-colors">Demo</a>
              <Link to="/dashboard" className="hover:text-[#0a0a0a] transition-colors">Dashboard</Link>
            </nav>
          </div>
          <Link to="/docs">
            <button className="h-9 px-4 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-900 transition-colors flex items-center gap-1.5">
              Get Started <ArrowRight className="h-3.5 w-3.5" />
            </button>
          </Link>
        </div>
      </header>

      {/* ── Hero ── */}
      <section className="pt-24 pb-20 sm:pt-32 sm:pb-28 px-6">
        <div className="max-w-[1200px] mx-auto grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
          {/* Left — headline */}
          <motion.div
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: [0.25, 1, 0.5, 1] }}
          >
            <h1 className="text-[clamp(2.25rem,5.5vw,4rem)] font-bold tracking-tight leading-[1.08] mb-6">
              Membership verification for
              <br />
              Network School apps
            </h1>
            <p className="text-lg sm:text-xl text-[#666] leading-relaxed max-w-xl mb-10">
              Verify NS Discord membership, access roles, and fetch profile data in your app — all through standard OAuth 2.0.
            </p>
            <div className="flex flex-wrap items-center gap-3">
              <Link to="/docs">
                <button className="h-11 px-6 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-900 transition-colors flex items-center gap-2">
                  <BookOpen className="h-4 w-4" />
                  Documentation
                </button>
              </Link>
              <a href={DEMO_URL} target="_blank" rel="noopener noreferrer">
                <button className="h-11 px-6 bg-white text-black text-sm font-medium rounded-lg border-2 border-black/10 hover:bg-gray-50 transition-colors flex items-center gap-2">
                  Live Demo
                  <ExternalLink className="h-3.5 w-3.5" />
                </button>
              </a>
            </div>
          </motion.div>

          {/* Right — logo mark */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: [0.25, 1, 0.5, 1], delay: 0.2 }}
            className="hidden lg:flex items-center justify-center"
          >
            <div className="relative w-72 h-72 flex items-center justify-center">
              {/* Outer ring */}
              <div className="absolute inset-0 rounded-full border border-gray-200" />
              <div className="absolute inset-4 rounded-full border border-gray-100" />
              {/* Center shield */}
              <div className="w-32 h-32 bg-[#0a0a0a] rounded-3xl flex items-center justify-center shadow-lg">
                <svg width="56" height="56" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.2" strokeLinejoin="round">
                  <path d="M12 2L4 6v5c0 5.55 3.41 10.74 8 12 4.59-1.26 8-6.45 8-12V6l-8-4z" />
                  <circle cx="12" cy="10" r="2.5" strokeLinecap="round" />
                  <path d="M12 12.5v4" strokeLinecap="round" />
                </svg>
              </div>
              {/* Floating labels */}
              <motion.div
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.6 }}
                className="absolute top-8 -left-4 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-medium text-[#0a0a0a] shadow-sm"
              >
                OAuth 2.0
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.7 }}
                className="absolute top-16 -right-6 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-medium text-[#0a0a0a] shadow-sm"
              >
                PKCE + RS256
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5, delay: 0.8 }}
                className="absolute bottom-16 -left-8 bg-white border border-gray-200 rounded-lg px-3 py-1.5 text-xs font-medium text-[#0a0a0a] shadow-sm"
              >
                Live Discord Data
              </motion.div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Divider ── */}
      <div className="max-w-[1200px] mx-auto px-6"><hr className="border-gray-200" /></div>

      {/* ── How It Works ── */}
      <section className="py-20 sm:py-28 px-6">
        <div className="max-w-[1200px] mx-auto">
          <Reveal>
            <p className="text-sm font-medium text-[#999] uppercase tracking-wider mb-3">How it works</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-16">Three steps to integrate</h2>
          </Reveal>

          <div className="grid sm:grid-cols-3 gap-8 sm:gap-12">
            {STEPS.map((step, i) => (
              <Reveal key={step.num} delay={i * 0.1}>
                <div className="group">
                  <div className="flex items-center justify-between mb-6">
                    <span className="text-xs font-mono text-[#ccc] tracking-wider">{step.num}</span>
                    <div className="h-10 w-10 rounded-lg bg-[#f5f5f5] flex items-center justify-center group-hover:bg-black group-hover:text-white transition-colors duration-200">
                      <step.icon className="h-4 w-4" />
                    </div>
                  </div>
                  <h3 className="font-semibold text-lg mb-2">{step.title}</h3>
                  <p className="text-sm text-[#666] leading-relaxed">{step.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-[1200px] mx-auto px-6"><hr className="border-gray-200" /></div>

      {/* ── Features ── */}
      <section className="py-20 sm:py-28 px-6">
        <div className="max-w-[1200px] mx-auto">
          <Reveal>
            <p className="text-sm font-medium text-[#999] uppercase tracking-wider mb-3">Capabilities</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">Built for the NS ecosystem</h2>
            <p className="text-[#666] max-w-lg mb-16 leading-relaxed">
              Everything you need to add Network School identity to your app.
            </p>
          </Reveal>

          <div className="grid sm:grid-cols-2 gap-6">
            {FEATURES.map((f, i) => (
              <Reveal key={f.title} delay={i * 0.08}>
                <div className="group p-6 sm:p-8 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
                  <div className="h-10 w-10 rounded-lg bg-[#f5f5f5] flex items-center justify-center mb-5 group-hover:bg-black group-hover:text-white transition-colors duration-200">
                    <f.icon className="h-4 w-4" />
                  </div>
                  <h3 className="font-semibold text-base mb-2">{f.title}</h3>
                  <p className="text-sm text-[#666] leading-relaxed">{f.description}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-[1200px] mx-auto px-6"><hr className="border-gray-200" /></div>

      {/* ── What you get back ── */}
      <section className="py-20 sm:py-28 px-6">
        <div className="max-w-[1200px] mx-auto">
          <div className="grid lg:grid-cols-2 gap-12 lg:gap-16 items-center">
            {/* Left — userinfo response */}
            <Reveal>
              <div className="rounded-xl border border-gray-200 bg-[#fafafa] overflow-hidden">
                <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-200 bg-white">
                  <span className="text-xs font-mono font-medium text-emerald-600">GET</span>
                  <span className="text-xs text-[#999] font-medium">/oauth/userinfo</span>
                </div>
                <pre className="p-5 font-mono text-[12.5px] leading-[1.7] text-[#444] overflow-x-auto whitespace-pre">{USERINFO_JSON}</pre>
              </div>
            </Reveal>

            {/* Right — description */}
            <Reveal delay={0.1}>
              <p className="text-sm font-medium text-[#999] uppercase tracking-wider mb-3">What you get back</p>
              <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">Structured user data</h2>
              <p className="text-[#666] leading-relaxed mb-6">
                One API call returns everything — identity, email, Discord profile, server roles, membership dates, and badges. All scope-gated and consent-driven.
              </p>
              <ul className="space-y-3 text-sm text-[#666]">
                <li className="flex items-start gap-3">
                  <span className="text-[#0a0a0a] font-semibold shrink-0 w-5">1.</span>
                  User authenticates via Discord
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#0a0a0a] font-semibold shrink-0 w-5">2.</span>
                  Exchange code for an access token
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#0a0a0a] font-semibold shrink-0 w-5">3.</span>
                  Call <code className="bg-[#f5f5f5] px-1.5 py-0.5 rounded text-[#0a0a0a] text-xs">/oauth/userinfo</code> with the token
                </li>
                <li className="flex items-start gap-3">
                  <span className="text-[#0a0a0a] font-semibold shrink-0 w-5">4.</span>
                  Get back JSON with all granted claims
                </li>
              </ul>
            </Reveal>
          </div>
        </div>
      </section>

      <div className="max-w-[1200px] mx-auto px-6"><hr className="border-gray-200" /></div>

      {/* ── Scopes ── */}
      <section className="py-20 sm:py-28 px-6">
        <div className="max-w-[1200px] mx-auto">
          <Reveal>
            <p className="text-sm font-medium text-[#999] uppercase tracking-wider mb-3">Scopes</p>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">Request only what you need</h2>
            <p className="text-[#666] max-w-lg mb-16 leading-relaxed">
              Granular, consent-driven access. Users see exactly what data your app requests.
            </p>
          </Reveal>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {SCOPES.map((s, i) => (
              <Reveal key={s.scope} delay={i * 0.05}>
                <div className="p-5 rounded-xl border border-gray-200 hover:border-gray-300 transition-colors">
                  <code className="text-sm font-semibold">{s.scope}</code>
                  <p className="text-xs text-[#666] mt-2 leading-relaxed">{s.claims}</p>
                  <p className="text-[11px] text-[#aaa] mt-1">{s.note}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      <div className="max-w-[1200px] mx-auto px-6"><hr className="border-gray-200" /></div>

      {/* ── CTA ── */}
      <section className="py-24 sm:py-32 px-6">
        <div className="max-w-[1200px] mx-auto text-center">
          <Reveal>
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight mb-4">
              Start building today
            </h2>
            <p className="text-[#666] max-w-md mx-auto mb-10 leading-relaxed">
              Register your app, grab your credentials, and add "Sign in with Network School" in minutes.
            </p>
            <div className="flex items-center justify-center gap-3">
              <Link to="/docs">
                <button className="h-11 px-6 bg-black text-white text-sm font-medium rounded-lg hover:bg-gray-900 transition-colors flex items-center gap-2">
                  Read the Docs
                  <ArrowRight className="h-4 w-4" />
                </button>
              </Link>
              <Link to="/dashboard">
                <button className="h-11 px-6 bg-white text-black text-sm font-medium rounded-lg border-2 border-black/10 hover:bg-gray-50 transition-colors">
                  Open Dashboard
                </button>
              </Link>
            </div>
          </Reveal>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="border-t border-gray-200 py-8 px-6">
        <div className="max-w-[1200px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-[#999]">
          <div className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5" />
            <span className="font-medium text-[#666]">NS Auth</span>
          </div>
          <nav className="flex items-center gap-5 text-[13px]">
            <Link to="/docs" className="hover:text-[#0a0a0a] transition-colors">Docs</Link>
            <a href={DEMO_URL} className="hover:text-[#0a0a0a] transition-colors">Demo</a>
            <Link to="/dashboard" className="hover:text-[#0a0a0a] transition-colors">Dashboard</Link>
            <a href="https://ns.com" target="_blank" rel="noopener noreferrer" className="hover:text-[#0a0a0a] transition-colors">
              ns.com
            </a>
          </nav>
        </div>
      </footer>
    </div>
  )
}
