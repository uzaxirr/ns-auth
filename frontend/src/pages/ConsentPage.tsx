import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { API_BASE } from "@/lib/api"
import {
  Key,
  User,
  Mail,
  GraduationCap,
  Activity,
  Globe,
  Wallet,
  RefreshCw,
  Loader2,
  AppWindow,
} from "lucide-react"

interface AppInfo {
  app_name: string
  app_icon_url: string | null
  app_description: string | null
  privacy_policy_url: string | null
  scopes: Array<{ name: string; description: string; claims: string[] }>
}

interface UserInfo {
  id: string
  email: string | null
  display_name: string | null
  avatar_url: string | null
  cohort: string | null
  bio: string | null
  wallet_address: string | null
}

const SCOPE_META: Record<
  string,
  {
    icon: typeof Key
    getValue: (u: UserInfo) => string
    subtitle: string
  }
> = {
  openid: {
    icon: Key,
    getValue: (u) => u.display_name || u.email || u.id.slice(0, 12) + "...",
    subtitle: "OpenID Connect identity",
  },
  profile: {
    icon: User,
    getValue: (u) => u.display_name || "Your profile",
    subtitle: "Name and profile picture",
  },
  email: {
    icon: Mail,
    getValue: (u) => u.email || "Your email address",
    subtitle: "Email address",
  },
  cohort: {
    icon: GraduationCap,
    getValue: (u) => u.cohort || "Your cohort",
    subtitle: "Cohort information",
  },
  activity: {
    icon: Activity,
    getValue: () => "Your activity stats",
    subtitle: "Posts, streaks, and activity",
  },
  socials: {
    icon: Globe,
    getValue: () => "Your social links",
    subtitle: "Twitter, GitHub, LinkedIn",
  },
  wallet: {
    icon: Wallet,
    getValue: (u) =>
      u.wallet_address
        ? u.wallet_address.slice(0, 6) + "..." + u.wallet_address.slice(-4)
        : "Your wallet address",
    subtitle: "Blockchain wallet",
  },
  offline_access: {
    icon: RefreshCw,
    getValue: () => "Persistent access",
    subtitle: "Long-lived refresh tokens",
  },
}

export function ConsentPage() {
  const [searchParams] = useSearchParams()
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const clientId = searchParams.get("client_id") || ""
  const redirectUri = searchParams.get("redirect_uri") || ""
  const scope = searchParams.get("scope") || "openid"
  const state = searchParams.get("state") || ""
  const codeChallenge = searchParams.get("code_challenge") || ""
  const codeChallengeMethod = searchParams.get("code_challenge_method") || ""

  useEffect(() => {
    Promise.all([
      fetch(
        `${API_BASE}/oauth/authorize/info?client_id=${clientId}&scope=${encodeURIComponent(scope)}`
      ).then((r) => r.json()),
      fetch(`${API_BASE}/auth/me`, { credentials: "include" }).then((r) =>
        r.ok ? r.json() : null
      ),
    ])
      .then(([app, user]) => {
        setAppInfo(app)
        setUserInfo(user)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [clientId, scope])

  async function handleConsent(approved: boolean) {
    setSubmitting(true)
    const form = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: codeChallengeMethod,
      approved: approved ? "true" : "false",
    })

    const resp = await fetch(`${API_BASE}/oauth/authorize/consent`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      credentials: "include",
      body: form,
    })

    const data = await resp.json()
    if (data.redirect_to) {
      window.location.href = data.redirect_to
    } else {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  const appName = appInfo?.app_name || "Unknown App"

  return (
    <div className="min-h-screen flex flex-col">
      {/* Main content */}
      <main className="flex-1 flex items-center justify-center px-4 py-8">
        <div className="w-full max-w-3xl rounded-2xl border border-border overflow-hidden">
          {/* Branding bar — inside the card */}
          <div className="flex items-center gap-3 px-6 py-4 border-b border-border">
            <img src="/ns-flag-white.svg" alt="NS" className="h-5 w-auto" />
            <span className="text-sm font-medium text-muted-foreground">
              Sign in with Network School
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2">
            {/* Left column — app icon + app name + user chip */}
            <div className="flex flex-col justify-center p-8 md:border-r border-border">
              {appInfo?.app_icon_url ? (
                <img
                  src={appInfo.app_icon_url}
                  alt={appName}
                  className="w-12 h-12 rounded-xl mb-5"
                />
              ) : (
                <div className="w-12 h-12 rounded-xl bg-secondary flex items-center justify-center mb-5">
                  <AppWindow className="w-6 h-6 text-muted-foreground" />
                </div>
              )}
              <h1 className="text-xl text-muted-foreground leading-snug">
                Sign in to
              </h1>
              <h2 className="text-2xl font-semibold text-foreground mt-1">
                {appName}
              </h2>

              {userInfo && (
                <div className="mt-6 inline-flex items-center gap-2.5 rounded-full border border-border pl-1 pr-4 py-1 w-fit">
                  {userInfo.avatar_url ? (
                    <img
                      src={userInfo.avatar_url}
                      alt=""
                      className="w-7 h-7 rounded-full object-cover"
                    />
                  ) : (
                    <div className="w-7 h-7 rounded-full bg-secondary flex items-center justify-center">
                      <User className="w-3.5 h-3.5 text-muted-foreground" />
                    </div>
                  )}
                  <span className="text-sm text-foreground truncate max-w-[180px]">
                    {userInfo.email || userInfo.display_name || "User"}
                  </span>
                </div>
              )}

              {appInfo?.app_description && (
                <p className="mt-5 text-sm text-muted-foreground leading-relaxed">
                  {appInfo.app_description}
                </p>
              )}
            </div>

            {/* Right column — scopes + actions */}
            <div className="flex flex-col p-8">
              <p className="text-sm text-muted-foreground mb-5">
                Network School will allow{" "}
                <span className="font-medium text-foreground">{appName}</span>{" "}
                to access this info about you
              </p>

              {/* Scope items */}
              <div className="space-y-0.5 mb-6">
                {appInfo?.scopes.map((s) => {
                  const meta = SCOPE_META[s.name]
                  const Icon = meta?.icon || Key
                  const value =
                    meta && userInfo ? meta.getValue(userInfo) : s.name
                  const subtitle = meta?.subtitle || s.description

                  return (
                    <div
                      key={s.name}
                      className="flex items-start gap-3 py-3 border-b border-border last:border-0"
                    >
                      <Icon className="w-[18px] h-[18px] text-muted-foreground mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {value}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {subtitle}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>

              {/* Privacy text */}
              {appInfo?.privacy_policy_url && (
                <p className="text-xs text-muted-foreground leading-relaxed mb-6">
                  Review{" "}
                  <a
                    href={appInfo.privacy_policy_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-foreground transition-colors"
                  >
                    {appName}&rsquo;s Privacy Policy
                  </a>
                  . Network School will share your name, email address, and
                  profile picture with {appName}.
                </p>
              )}

              {/* Action buttons */}
              <div className="flex items-center justify-end gap-3 mt-auto pt-2">
                <button
                  onClick={() => handleConsent(false)}
                  disabled={submitting}
                  className="px-5 py-2 text-sm font-medium text-foreground rounded-full border border-border hover:bg-secondary transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleConsent(true)}
                  disabled={submitting}
                  className="px-5 py-2 text-sm font-medium text-primary-foreground bg-primary rounded-full hover:bg-primary/90 transition-colors disabled:opacity-50"
                >
                  {submitting ? (
                    <Loader2 className="w-4 h-4 animate-spin inline" />
                  ) : (
                    "Continue"
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Footer — outside card, matching Google placement */}
      <footer className="flex items-center justify-end gap-6 px-8 py-4 text-xs text-muted-foreground">
        <a href="https://ns.com" className="hover:text-foreground transition-colors">
          Help
        </a>
        <a href="https://ns.com/privacy" className="hover:text-foreground transition-colors">
          Privacy
        </a>
        <a href="https://ns.com/terms" className="hover:text-foreground transition-colors">
          Terms
        </a>
      </footer>
    </div>
  )
}
