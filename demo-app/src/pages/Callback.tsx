import { useEffect, useRef, useState } from "react"
import { OAUTH_SERVER, CLIENT_ID, CLIENT_SECRET, REDIRECT_URI } from "../config"

interface UserInfo {
  sub: string
  email?: string
  email_verified?: boolean
  name?: string
  picture?: string
  cohort?: string
  bio?: string
  socials?: Record<string, string>
  wallet_address?: string
}

const SOCIAL_ICONS: Record<string, string> = {
  twitter: "M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z",
  github: "M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z",
  linkedin: "M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z",
  website: "M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z",
}

function SocialIcon({ platform }: { platform: string }) {
  const path = SOCIAL_ICONS[platform.toLowerCase()]
  if (!path) {
    return <span style={{ fontSize: 12, fontWeight: 600, textTransform: "uppercase" as const }}>{platform[0]}</span>
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
      <path d={path} />
    </svg>
  )
}

function truncateAddress(addr: string) {
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`
}

function ScopeTag({ label }: { label: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, letterSpacing: "0.05em",
      textTransform: "uppercase" as const,
      padding: "2px 6px", borderRadius: 4,
      background: "rgba(99, 102, 241, 0.12)",
      color: "#818cf8",
    }}>{label}</span>
  )
}

function InfoRow({ icon, scope, label, value, mono }: {
  icon: React.ReactNode, scope: string, label: string, value?: string | null, mono?: boolean
}) {
  const hasValue = !!value
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      padding: "12px 0",
    }}>
      <div style={{
        width: 36, height: 36, borderRadius: 10,
        background: "#1a1a1e",
        display: "flex", alignItems: "center", justifyContent: "center",
        flexShrink: 0, color: "#71717a",
      }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2 }}>
          <span style={{ fontSize: 11, fontWeight: 500, color: "#52525b", textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>
            {label}
          </span>
          <ScopeTag label={scope} />
        </div>
        <div style={{
          fontSize: 13,
          color: hasValue ? "#e4e4e7" : "#3f3f46",
          fontFamily: mono ? "monospace" : "inherit",
          fontStyle: hasValue ? "normal" : "italic",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const,
        }}>
          {hasValue ? value : "Not set"}
        </div>
      </div>
    </div>
  )
}

export function Callback() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const exchanged = useRef(false)

  useEffect(() => {
    async function exchangeCode() {
      if (exchanged.current) return
      exchanged.current = true
      const params = new URLSearchParams(window.location.search)
      const code = params.get("code")
      const state = params.get("state")
      const errorParam = params.get("error")

      if (errorParam) {
        setError(`Authorization denied: ${errorParam}`)
        setLoading(false)
        return
      }

      if (!code) {
        setError("No authorization code received")
        setLoading(false)
        return
      }

      const savedState = sessionStorage.getItem("oauth_state")
      if (state !== savedState) {
        setError("State mismatch — possible CSRF attack")
        setLoading(false)
        return
      }

      const codeVerifier = sessionStorage.getItem("pkce_code_verifier")
      if (!codeVerifier) {
        setError("Missing PKCE code verifier")
        setLoading(false)
        return
      }

      try {
        const tokenRes = await fetch(`${OAUTH_SERVER}/oauth/token`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "authorization_code",
            code,
            redirect_uri: REDIRECT_URI,
            client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET,
            code_verifier: codeVerifier,
          }),
        })

        if (!tokenRes.ok) {
          const err = await tokenRes.json()
          throw new Error(err.error_description || err.error || "Token exchange failed")
        }

        const tokens = await tokenRes.json()

        const userRes = await fetch(`${OAUTH_SERVER}/oauth/userinfo`, {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        })

        if (!userRes.ok) throw new Error("Failed to fetch user info")

        const user = await userRes.json()
        setUserInfo(user)

        sessionStorage.removeItem("pkce_code_verifier")
        sessionStorage.removeItem("oauth_state")
      } catch (err: any) {
        setError(err.message || "Something went wrong")
      } finally {
        setLoading(false)
      }
    }

    exchangeCode()
  }, [])

  function handleSignOut() {
    setUserInfo(null)
    window.location.href = "/"
  }

  if (loading) {
    return (
      <div style={styles.page}>
        <div style={{ textAlign: "center" }}>
          <div style={styles.spinner} />
          <p style={{ color: "#71717a", fontSize: 14, marginTop: 20 }}>Authenticating...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div style={styles.page}>
        <div style={{ maxWidth: 400, textAlign: "center", padding: 24 }}>
          <div style={{
            width: 56, height: 56,
            background: "rgba(239, 68, 68, 0.1)",
            borderRadius: 16,
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px",
            color: "#ef4444", fontSize: 24, fontWeight: 700,
          }}>!</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, margin: "0 0 8px", color: "#fafafa" }}>
            Authentication Failed
          </h1>
          <p style={{ color: "#71717a", margin: "0 0 24px", fontSize: 14, lineHeight: 1.6 }}>{error}</p>
          <a href="/" style={{
            display: "inline-block", padding: "10px 24px",
            fontSize: 13, fontWeight: 600, background: "#fafafa", color: "#09090b",
            borderRadius: 8, textDecoration: "none",
          }}>Try Again</a>
        </div>
      </div>
    )
  }

  const socials = userInfo?.socials || {}
  const socialEntries = Object.entries(socials)
  const displayName = userInfo?.name || userInfo?.email?.split("@")[0] || "Network School Member"
  const initials = displayName[0]?.toUpperCase() || "N"

  return (
    <div style={styles.page}>
      <div style={{ maxWidth: 480, width: "100%", padding: "24px 16px" }}>
        {/* Success badge */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          gap: 6, marginBottom: 32,
        }}>
          <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#22c55e" }} />
          <span style={{ fontSize: 12, fontWeight: 500, color: "#22c55e", letterSpacing: "0.02em" }}>
            Signed in with Network School
          </span>
        </div>

        {/* Profile card */}
        <div style={{
          background: "#111113",
          borderRadius: 20,
          border: "1px solid #1e1e22",
          overflow: "hidden",
        }}>
          {/* Header with gradient + avatar */}
          <div style={{
            height: 100,
            background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)",
            position: "relative",
          }}>
            <div style={{
              position: "absolute", bottom: -36, left: "50%", transform: "translateX(-50%)",
              width: 72, height: 72, borderRadius: 18, overflow: "hidden",
              border: "3px solid #111113",
              background: userInfo?.picture ? "#18181b" : "linear-gradient(135deg, #6366f1, #8b5cf6)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {userInfo?.picture ? (
                <img src={userInfo.picture} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              ) : (
                <span style={{ fontSize: 26, fontWeight: 700, color: "#fafafa" }}>{initials}</span>
              )}
            </div>
          </div>

          {/* Name */}
          <div style={{ textAlign: "center", padding: "44px 24px 8px" }}>
            <h1 style={{
              fontSize: 22, fontWeight: 700, margin: 0,
              color: "#fafafa", letterSpacing: "-0.02em",
            }}>
              {displayName}
            </h1>
          </div>

          {/* Scope data section */}
          <div style={{ padding: "8px 24px 20px" }}>
            {/* openid — User ID */}
            <InfoRow
              scope="openid"
              label="User ID"
              value={userInfo?.sub}
              mono
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h4a2 2 0 012 2v14a2 2 0 01-2 2h-4" /><polyline points="10 17 15 12 10 7" /><line x1="15" y1="12" x2="3" y2="12" /></svg>}
            />

            <div style={{ height: 1, background: "#1e1e22" }} />

            {/* email */}
            <InfoRow
              scope="email"
              label="Email"
              value={userInfo?.email}
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" /><polyline points="22,6 12,13 2,6" /></svg>}
            />

            <div style={{ height: 1, background: "#1e1e22" }} />

            {/* profile — Name & Bio */}
            <InfoRow
              scope="profile"
              label="Display Name"
              value={userInfo?.name}
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>}
            />

            <InfoRow
              scope="profile"
              label="Bio"
              value={userInfo?.bio}
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /></svg>}
            />

            <div style={{ height: 1, background: "#1e1e22" }} />

            {/* cohort */}
            <InfoRow
              scope="cohort"
              label="Cohort"
              value={userInfo?.cohort}
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c0 1.657 2.686 3 6 3s6-1.343 6-3v-5" /></svg>}
            />

            <div style={{ height: 1, background: "#1e1e22" }} />

            {/* wallet */}
            <InfoRow
              scope="wallet"
              label="Wallet Address"
              value={userInfo?.wallet_address ? truncateAddress(userInfo.wallet_address) : null}
              mono
              icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 12V7H5a2 2 0 010-4h14v4" /><path d="M3 5v14a2 2 0 002 2h16v-5" /><path d="M18 12a2 2 0 100 4h4v-4z" /></svg>}
            />

            <div style={{ height: 1, background: "#1e1e22" }} />

            {/* socials */}
            <div style={{ padding: "12px 0" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 500, color: "#52525b", textTransform: "uppercase" as const, letterSpacing: "0.04em" }}>
                  Social Links
                </span>
                <ScopeTag label="socials" />
              </div>
              {socialEntries.length > 0 ? (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {socialEntries.map(([platform, url]) => (
                    <a
                      key={platform}
                      href={url.startsWith("http") ? url : `https://${url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      title={platform}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 6,
                        padding: "6px 12px", borderRadius: 8,
                        background: "#1a1a1e", border: "1px solid #27272a",
                        color: "#a1a1aa", fontSize: 12, fontWeight: 500,
                        textDecoration: "none", transition: "all 0.15s",
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background = "#27272a"
                        e.currentTarget.style.color = "#fafafa"
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = "#1a1a1e"
                        e.currentTarget.style.color = "#a1a1aa"
                      }}
                    >
                      <SocialIcon platform={platform} />
                      {platform.charAt(0).toUpperCase() + platform.slice(1)}
                    </a>
                  ))}
                </div>
              ) : (
                <span style={{ fontSize: 13, color: "#3f3f46", fontStyle: "italic" }}>Not set</span>
              )}
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div style={{
          display: "flex", justifyContent: "center", gap: 12,
          marginTop: 20, padding: "0 4px",
        }}>
          <button
            onClick={handleSignOut}
            style={{
              padding: "10px 24px", fontSize: 13, fontWeight: 600,
              background: "transparent", color: "#71717a",
              border: "1px solid #27272a", borderRadius: 10,
              cursor: "pointer", transition: "all 0.15s",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = "#3f3f46"
              e.currentTarget.style.color = "#a1a1aa"
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = "#27272a"
              e.currentTarget.style.color = "#71717a"
            }}
          >
            Sign Out
          </button>
        </div>

        {/* Powered by badge */}
        <div style={{
          textAlign: "center", marginTop: 32,
          fontSize: 11, color: "#3f3f46",
        }}>
          Powered by Network School OAuth
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    minHeight: "100vh",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    background: "#09090b",
    color: "#fafafa",
    fontFamily: "system-ui, -apple-system, sans-serif",
  },
  spinner: {
    width: 32, height: 32,
    border: "3px solid #27272a",
    borderTopColor: "#fafafa",
    borderRadius: "50%",
    animation: "spin 0.8s linear infinite",
    margin: "0 auto",
  },
}
