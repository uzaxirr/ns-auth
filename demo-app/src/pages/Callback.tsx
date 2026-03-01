import { useEffect, useRef, useState } from "react"
import { OAUTH_SERVER, CLIENT_ID, CLIENT_SECRET, REDIRECT_URI } from "../config"

interface UserInfo {
  sub: string
  email?: string
  email_verified?: boolean
  name?: string
  picture?: string
  roles?: Array<{ id: string; name: string }>
  date_joined?: string
  discord_username?: string
  discord_joined_at?: string
  boosting_since?: string
  banner_url?: string | null
  accent_color?: string | null
  public_badges?: string[]
}

const FONT = "'Outfit', system-ui, -apple-system, sans-serif"

/* ─── Developer view helpers ─── */

function ScopeTag({ label }: { label: string }) {
  return (
    <span style={{
      fontSize: 10, fontWeight: 600, letterSpacing: "0.05em",
      textTransform: "uppercase" as const,
      padding: "2px 7px", borderRadius: 4,
      background: "rgba(99, 102, 241, 0.15)", color: "#a5b4fc",
    }}>{label}</span>
  )
}

function SourceTag({ label }: { label: string }) {
  return (
    <span style={{
      fontSize: 9, fontWeight: 600, letterSpacing: "0.05em",
      textTransform: "uppercase" as const,
      padding: "2px 6px", borderRadius: 3,
      background: "rgba(52, 211, 153, 0.1)", color: "#6ee7b7",
    }}>{label}</span>
  )
}

function DevRow({ label, value, mono, scope, source }: {
  label: string; value?: string | null; mono?: boolean; scope: string; source: string
}) {
  const hasValue = value !== undefined && value !== null && value !== ""
  return (
    <div style={{ padding: "10px 0", display: "flex", flexDirection: "column", gap: 4 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <span style={{
          fontSize: 11, fontWeight: 600, color: "#71717a",
          textTransform: "uppercase" as const, letterSpacing: "0.06em",
        }}>{label}</span>
        <ScopeTag label={scope} />
        <SourceTag label={source} />
      </div>
      <div style={{
        fontSize: 13, lineHeight: 1.5,
        color: hasValue ? "#e4e4e7" : "#3f3f46",
        fontFamily: mono ? "'SF Mono', 'Fira Code', monospace" : "inherit",
        fontStyle: hasValue ? "normal" : "italic",
        overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" as const,
      }}>
        {hasValue ? value : "—"}
      </div>
    </div>
  )
}

function DevCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{
      background: "#0c0c0e", borderRadius: 14,
      border: "1px solid rgba(255,255,255,0.06)",
      padding: "16px 20px", marginBottom: 10,
    }}>
      <div style={{
        fontSize: 10, fontWeight: 700, color: "#52525b",
        textTransform: "uppercase" as const, letterSpacing: "0.12em",
        marginBottom: 8, paddingBottom: 8,
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}>{title}</div>
      {children}
    </div>
  )
}

/* ─── Icons ─── */

const ico = {
  mail: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="16" rx="3" /><path d="M22 7l-10 6L2 7" /></svg>,
  calendar: <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="4" width="18" height="18" rx="2" /><line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" /><line x1="3" y1="10" x2="21" y2="10" /></svg>,
  shield: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" /></svg>,
  zap: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" /></svg>,
  award: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="8" r="7" /><polyline points="8.21 13.89 7 23 12 20 17 23 15.79 13.88" /></svg>,
  check: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>,
  code: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>,
  userIcon: <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" /><circle cx="12" cy="7" r="4" /></svg>,
  refresh: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 11-2.12-9.36L23 10" /></svg>,
}

/* ─── App Logo ─── */

function AppLogo() {
  return (
    <a href="/" style={{ display: "flex", alignItems: "center", gap: 10, textDecoration: "none", color: "#fafafa" }}>
      <div style={{
        width: 28, height: 28, borderRadius: 7,
        background: "linear-gradient(135deg, #f59e0b, #d97706)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="#09090b" stroke="none">
          <path d="M4 19.5A2.5 2.5 0 016.5 17H20V2H6.5A2.5 2.5 0 014 4.5v15z"/>
          <path d="M6.5 17H20v5H6.5a2.5 2.5 0 010-5z" opacity="0.5"/>
        </svg>
      </div>
      <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.02em" }}>StudyTracker</span>
    </a>
  )
}

/* ─── Main component ─── */

export function Callback() {
  const [userInfo, setUserInfo] = useState<UserInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshToken, setRefreshToken] = useState<string | null>(null)
  const [accessToken, setAccessToken] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [tab, setTab] = useState<"profile" | "developer">("profile")
  const exchanged = useRef(false)

  useEffect(() => {
    async function exchangeCode() {
      if (exchanged.current) return
      exchanged.current = true
      const params = new URLSearchParams(window.location.search)
      const code = params.get("code")
      const state = params.get("state")
      const errorParam = params.get("error")

      if (errorParam) { setError(`Authorization denied: ${errorParam}`); setLoading(false); return }
      if (!code) { setError("No authorization code received"); setLoading(false); return }

      const savedState = sessionStorage.getItem("oauth_state")
      if (state !== savedState) { setError("State mismatch — possible CSRF attack"); setLoading(false); return }

      const codeVerifier = sessionStorage.getItem("pkce_code_verifier")
      if (!codeVerifier) { setError("Missing PKCE code verifier"); setLoading(false); return }

      try {
        const tokenRes = await fetch(`${OAUTH_SERVER}/oauth/token`, {
          method: "POST",
          headers: { "Content-Type": "application/x-www-form-urlencoded" },
          body: new URLSearchParams({
            grant_type: "authorization_code", code,
            redirect_uri: REDIRECT_URI, client_id: CLIENT_ID,
            client_secret: CLIENT_SECRET, code_verifier: codeVerifier,
          }),
        })
        if (!tokenRes.ok) {
          const err = await tokenRes.json()
          throw new Error(err.error_description || err.error || "Token exchange failed")
        }
        const tokens = await tokenRes.json()
        setAccessToken(tokens.access_token)
        if (tokens.refresh_token) setRefreshToken(tokens.refresh_token)

        const userRes = await fetch(`${OAUTH_SERVER}/oauth/userinfo`, {
          headers: { Authorization: `Bearer ${tokens.access_token}` },
        })
        if (!userRes.ok) throw new Error("Failed to fetch user info")
        setUserInfo(await userRes.json())
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

  async function handleRefresh() {
    if (!refreshToken) return
    setRefreshing(true)
    try {
      const res = await fetch(`${OAUTH_SERVER}/oauth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "refresh_token", refresh_token: refreshToken,
          client_id: CLIENT_ID, client_secret: CLIENT_SECRET,
        }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error_description || err.error || "Refresh failed")
      }
      const tokens = await res.json()
      setAccessToken(tokens.access_token)
      if (tokens.refresh_token) setRefreshToken(tokens.refresh_token)
      const userRes = await fetch(`${OAUTH_SERVER}/oauth/userinfo`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      })
      if (userRes.ok) setUserInfo(await userRes.json())
    } catch (err: any) {
      setError(err.message || "Refresh failed")
    } finally {
      setRefreshing(false)
    }
  }

  function signOut() {
    setUserInfo(null)
    window.location.href = "/"
  }

  /* ─── Loading ─── */
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: "#09090b", color: "#fafafa", fontFamily: FONT }}>
        <nav style={{
          display: "flex", alignItems: "center", padding: "16px 32px",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
        }}>
          <AppLogo />
        </nav>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          height: "calc(100vh - 60px)",
        }}>
          <div style={{ textAlign: "center", animation: "fadeIn 0.4s ease" }}>
            <div style={{
              width: 28, height: 28,
              border: "2px solid #1e1e22", borderTopColor: "#52525b",
              borderRadius: "50%", animation: "spin 0.7s linear infinite",
              margin: "0 auto",
            }} />
            <p style={{ color: "#52525b", fontSize: 13, marginTop: 20, letterSpacing: "0.02em" }}>
              Signing you in...
            </p>
          </div>
        </div>
      </div>
    )
  }

  /* ─── Error ─── */
  if (error) {
    return (
      <div style={{ minHeight: "100vh", background: "#09090b", color: "#fafafa", fontFamily: FONT }}>
        <nav style={{
          display: "flex", alignItems: "center", padding: "16px 32px",
          borderBottom: "1px solid rgba(255,255,255,0.04)",
        }}>
          <AppLogo />
        </nav>
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "center",
          height: "calc(100vh - 60px)",
        }}>
          <div style={{
            maxWidth: 400, textAlign: "center", padding: 32,
            animation: "fadeInUp 0.5s ease",
          }}>
            <div style={{
              width: 56, height: 56,
              background: "rgba(239, 68, 68, 0.08)",
              borderRadius: 16, border: "1px solid rgba(239, 68, 68, 0.15)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 20px",
              color: "#f87171", fontSize: 22, fontWeight: 700,
            }}>!</div>
            <h1 style={{
              fontSize: 20, fontWeight: 700, margin: "0 0 8px",
              letterSpacing: "-0.02em",
            }}>Authentication Failed</h1>
            <p style={{
              color: "#71717a", margin: "0 0 28px", fontSize: 14, lineHeight: 1.7,
            }}>{error}</p>
            <a href="/" style={{
              display: "inline-block", padding: "11px 28px",
              fontSize: 13, fontWeight: 600,
              background: "#fafafa", color: "#09090b",
              borderRadius: 10, textDecoration: "none",
            }}>Try Again</a>
          </div>
        </div>
      </div>
    )
  }

  /* ─── Helpers ─── */
  const displayName = userInfo?.name || userInfo?.email?.split("@")[0] || "NS Member"
  const initials = displayName[0]?.toUpperCase() || "N"

  function fmtDate(iso?: string | null) {
    if (!iso) return null
    return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" })
  }

  function fmtMonthYear(iso?: string | null) {
    if (!iso) return null
    return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short" })
  }

  const hasRoles = userInfo?.roles && userInfo.roles.length > 0
  const hasBadges = userInfo?.public_badges && userInfo.public_badges.length > 0
  const roleCount = userInfo?.roles?.length || 0
  const badgeCount = userInfo?.public_badges?.length || 0

  /* ─── Profile view ─── */
  function renderProfile() {
    return (
      <div style={{ animation: "fadeInUp 0.35s ease" }}>
        {/* Welcome */}
        <div style={{
          display: "flex", alignItems: "center", gap: 16,
          marginBottom: 24,
        }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16,
            overflow: "hidden", flexShrink: 0,
            background: userInfo?.picture ? "#18181b" : "linear-gradient(135deg, #f59e0b, #d97706)",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 16px rgba(0,0,0,0.3)",
          }}>
            {userInfo?.picture ? (
              <img src={userInfo.picture} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            ) : (
              <span style={{ fontSize: 22, fontWeight: 700, color: "#09090b" }}>{initials}</span>
            )}
          </div>
          <div>
            <h1 style={{
              fontSize: 22, fontWeight: 800, margin: 0,
              letterSpacing: "-0.03em", lineHeight: 1.2,
            }}>
              Welcome, {displayName}!
            </h1>
            <p style={{ fontSize: 14, color: "#52525b", margin: "2px 0 0" }}>
              Your NS profile is connected to StudyTracker
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
          gap: 8, marginBottom: 14,
        }}>
          <div style={{
            background: "#111114", borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.06)",
            padding: "14px 16px", textAlign: "center",
          }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fafafa", letterSpacing: "-0.02em" }}>
              {fmtMonthYear(userInfo?.discord_joined_at) || "—"}
            </div>
            <div style={{
              fontSize: 10, color: "#52525b", fontWeight: 600, marginTop: 3,
              textTransform: "uppercase" as const, letterSpacing: "0.06em",
            }}>Member since</div>
          </div>
          <div style={{
            background: "#111114", borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.06)",
            padding: "14px 16px", textAlign: "center",
          }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fafafa" }}>{roleCount}</div>
            <div style={{
              fontSize: 10, color: "#52525b", fontWeight: 600, marginTop: 3,
              textTransform: "uppercase" as const, letterSpacing: "0.06em",
            }}>{roleCount === 1 ? "Role" : "Roles"}</div>
          </div>
          <div style={{
            background: "#111114", borderRadius: 12,
            border: "1px solid rgba(255,255,255,0.06)",
            padding: "14px 16px", textAlign: "center",
          }}>
            <div style={{ fontSize: 18, fontWeight: 800, color: "#fafafa" }}>{badgeCount}</div>
            <div style={{
              fontSize: 10, color: "#52525b", fontWeight: 600, marginTop: 3,
              textTransform: "uppercase" as const, letterSpacing: "0.06em",
            }}>{badgeCount === 1 ? "Badge" : "Badges"}</div>
          </div>
        </div>

        {/* Profile details card */}
        <div style={{
          background: "#111114", borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.06)",
          padding: "20px", marginBottom: 10,
        }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: "#52525b",
            textTransform: "uppercase" as const, letterSpacing: "0.08em",
            marginBottom: 16,
          }}>Profile</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {userInfo?.discord_username && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "#71717a" }}>Username</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#e4e4e7" }}>@{userInfo.discord_username}</span>
              </div>
            )}
            {userInfo?.email && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "#71717a" }}>Email</span>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 14, fontWeight: 500, color: "#e4e4e7" }}>{userInfo.email}</span>
                  {userInfo.email_verified && (
                    <div style={{
                      width: 16, height: 16, borderRadius: "50%",
                      background: "rgba(52,211,153,0.15)",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      color: "#34d399",
                    }}>{ico.check}</div>
                  )}
                </div>
              </div>
            )}
            {userInfo?.discord_joined_at && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "#71717a" }}>Discord member since</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#e4e4e7" }}>{fmtDate(userInfo.discord_joined_at)}</span>
              </div>
            )}
            {userInfo?.date_joined && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "#71717a" }}>NS OAuth since</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#e4e4e7" }}>{fmtDate(userInfo.date_joined)}</span>
              </div>
            )}
            {userInfo?.boosting_since && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ fontSize: 13, color: "#71717a" }}>Server boost</span>
                <span style={{ fontSize: 14, fontWeight: 600, color: "#f9a8d4" }}>
                  Since {fmtDate(userInfo.boosting_since)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Badges */}
        {hasBadges && (
          <div style={{
            background: "#111114", borderRadius: 16,
            border: "1px solid rgba(255,255,255,0.06)",
            padding: "20px", marginBottom: 10,
          }}>
            <div style={{
              fontSize: 11, fontWeight: 700, color: "#52525b",
              textTransform: "uppercase" as const, letterSpacing: "0.08em",
              marginBottom: 12,
            }}>Badges</div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {userInfo!.public_badges!.map((badge) => (
                <span key={badge} style={{
                  display: "inline-flex", alignItems: "center", gap: 5,
                  padding: "5px 12px", borderRadius: 8,
                  background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.15)",
                  color: "#fbbf24", fontSize: 12, fontWeight: 600,
                }}>
                  {ico.award} {badge}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Roles */}
        <div style={{
          background: "#111114", borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.06)",
          padding: "20px",
        }}>
          <div style={{
            fontSize: 11, fontWeight: 700, color: "#52525b",
            textTransform: "uppercase" as const, letterSpacing: "0.08em",
            marginBottom: 12,
          }}>Roles</div>
          {hasRoles ? (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {userInfo!.roles!.map((role) => {
                const name = typeof role === "string" ? role : role.name
                return (
                  <span key={typeof role === "string" ? role : role.id} style={{
                    display: "inline-flex", alignItems: "center", gap: 5,
                    padding: "5px 12px", borderRadius: 8,
                    background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.15)",
                    color: "#a5b4fc", fontSize: 13, fontWeight: 500,
                  }}>
                    {ico.shield} {name}
                  </span>
                )
              })}
            </div>
          ) : (
            <p style={{ fontSize: 13, color: "#3f3f46", fontStyle: "italic" }}>No roles assigned</p>
          )}
        </div>
      </div>
    )
  }

  /* ─── Developer view ─── */
  function renderDeveloper() {
    return (
      <div style={{ animation: "fadeInUp 0.35s ease" }}>
        <DevCard title="Identity">
          <DevRow label="sub" value={userInfo?.sub} mono scope="openid" source="system" />
        </DevCard>

        <DevCard title="Email">
          <DevRow label="email" value={userInfo?.email} scope="email" source="discord oauth" />
          <DevRow label="email_verified" value={userInfo?.email_verified !== undefined ? String(userInfo?.email_verified) : null} scope="email" source="discord oauth" />
        </DevCard>

        <DevCard title="Profile">
          <DevRow label="name" value={userInfo?.name} scope="profile" source="discord api" />
          <DevRow label="discord_username" value={userInfo?.discord_username} scope="profile" source="discord api" />
          <DevRow label="picture" value={userInfo?.picture} mono scope="profile" source="discord api" />
          <DevRow label="banner_url" value={userInfo?.banner_url} mono scope="profile" source="discord api" />
          <div style={{ padding: "10px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <span style={{
                fontSize: 11, fontWeight: 600, color: "#71717a",
                textTransform: "uppercase" as const, letterSpacing: "0.06em",
              }}>accent_color</span>
              <ScopeTag label="profile" />
              <SourceTag label="discord api" />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {userInfo?.accent_color ? (
                <>
                  <div style={{
                    width: 16, height: 16, borderRadius: 4,
                    background: userInfo.accent_color,
                    border: "1px solid rgba(255,255,255,0.1)",
                  }} />
                  <span style={{ fontSize: 13, color: "#e4e4e7", fontFamily: "monospace" }}>
                    {userInfo.accent_color}
                  </span>
                </>
              ) : (
                <span style={{ fontSize: 13, color: "#3f3f46", fontStyle: "italic" }}>—</span>
              )}
            </div>
          </div>
          <div style={{ padding: "10px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <span style={{
                fontSize: 11, fontWeight: 600, color: "#71717a",
                textTransform: "uppercase" as const, letterSpacing: "0.06em",
              }}>public_badges</span>
              <ScopeTag label="profile" />
              <SourceTag label="discord api" />
            </div>
            {hasBadges ? (
              <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                {userInfo!.public_badges!.map((b) => (
                  <span key={b} style={{
                    padding: "3px 8px", borderRadius: 5, fontSize: 12,
                    background: "rgba(251,191,36,0.1)", color: "#fbbf24", fontWeight: 500,
                  }}>{b}</span>
                ))}
              </div>
            ) : (
              <span style={{ fontSize: 13, color: "#3f3f46", fontStyle: "italic" }}>—</span>
            )}
          </div>
        </DevCard>

        <DevCard title="Roles">
          <div style={{ padding: "10px 0" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
              <span style={{
                fontSize: 11, fontWeight: 600, color: "#71717a",
                textTransform: "uppercase" as const, letterSpacing: "0.06em",
              }}>roles</span>
              <ScopeTag label="roles" />
              <SourceTag label="discord api" />
            </div>
            {hasRoles ? (
              <pre style={{
                fontSize: 12, color: "#a1a1aa", fontFamily: "monospace",
                margin: 0, whiteSpace: "pre-wrap" as const,
              }}>{JSON.stringify(userInfo?.roles, null, 2)}</pre>
            ) : (
              <span style={{ fontSize: 13, color: "#3f3f46", fontStyle: "italic" }}>—</span>
            )}
          </div>
        </DevCard>

        <DevCard title="Membership">
          <DevRow label="date_joined" value={userInfo?.date_joined} mono scope="date_joined" source="system" />
          <DevRow label="discord_joined_at" value={userInfo?.discord_joined_at} mono scope="date_joined" source="discord api" />
          <DevRow label="boosting_since" value={userInfo?.boosting_since} mono scope="date_joined" source="discord api" />
        </DevCard>
      </div>
    )
  }

  /* ─── Main render ─── */
  return (
    <div style={{ minHeight: "100vh", background: "#09090b", color: "#fafafa", fontFamily: FONT }}>
      {/* App header */}
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 32px",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
        background: "rgba(9,9,11,0.85)",
        backdropFilter: "blur(12px)",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <AppLogo />

        {/* Tabs */}
        <div style={{
          display: "flex", gap: 2,
          background: "rgba(255,255,255,0.03)", padding: 3, borderRadius: 9,
          border: "1px solid rgba(255,255,255,0.05)",
        }}>
          {(["profile", "developer"] as const).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: "6px 16px", fontSize: 12, fontWeight: 600,
                border: "none", borderRadius: 7, cursor: "pointer",
                transition: "all 0.2s ease",
                display: "flex", alignItems: "center", gap: 5,
                background: tab === t ? "rgba(255,255,255,0.07)" : "transparent",
                color: tab === t ? "#fafafa" : "#52525b",
                fontFamily: FONT,
              }}
            >
              {t === "profile" ? ico.userIcon : ico.code}
              {t === "profile" ? "Profile" : "Developer"}
            </button>
          ))}
        </div>

        {/* User + sign out */}
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {userInfo?.picture && (
            <img src={userInfo.picture} alt="" style={{
              width: 28, height: 28, borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.1)",
            }} />
          )}
          <button
            onClick={signOut}
            style={{
              padding: "6px 12px", fontSize: 12, fontWeight: 600,
              background: "transparent", color: "#52525b",
              border: "1px solid rgba(255,255,255,0.08)", borderRadius: 7,
              cursor: "pointer", transition: "all 0.15s", fontFamily: FONT,
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.15)"
              e.currentTarget.style.color = "#a1a1aa"
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.borderColor = "rgba(255,255,255,0.08)"
              e.currentTarget.style.color = "#52525b"
            }}
          >Sign out</button>
        </div>
      </nav>

      {/* Content */}
      <div style={{
        maxWidth: 560, width: "100%", margin: "0 auto",
        padding: "28px 16px 48px",
        animation: "fadeInUp 0.4s ease",
      }}>
        {tab === "profile" ? renderProfile() : renderDeveloper()}

        {/* Refresh token */}
        {refreshToken && (
          <div style={{
            marginTop: 10,
            background: "#111114", borderRadius: 14,
            border: "1px solid rgba(255,255,255,0.06)",
            padding: "16px 20px",
          }}>
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              marginBottom: 10,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ color: "#6366f1" }}>{ico.refresh}</span>
                <span style={{
                  fontSize: 11, fontWeight: 700, color: "#52525b",
                  textTransform: "uppercase" as const, letterSpacing: "0.08em",
                }}>Refresh Token</span>
              </div>
              <button
                onClick={handleRefresh}
                disabled={refreshing}
                style={{
                  padding: "6px 14px", fontSize: 12, fontWeight: 600,
                  background: "rgba(99,102,241,0.12)", color: "#a5b4fc",
                  border: "1px solid rgba(99,102,241,0.2)", borderRadius: 8,
                  cursor: refreshing ? "not-allowed" : "pointer",
                  opacity: refreshing ? 0.5 : 1,
                  fontFamily: FONT,
                }}
              >{refreshing ? "Refreshing..." : "Rotate"}</button>
            </div>
            <div style={{
              fontSize: 11, fontFamily: "'SF Mono', 'Fira Code', monospace",
              color: "#52525b", wordBreak: "break-all" as const,
              padding: "8px 10px", background: "rgba(0,0,0,0.3)", borderRadius: 8,
            }}>
              {refreshToken.slice(0, 24)}...{refreshToken.slice(-8)}
            </div>
          </div>
        )}

        {/* Raw JSON */}
        <details style={{
          marginTop: 10, background: "#111114", borderRadius: 14,
          border: "1px solid rgba(255,255,255,0.06)", overflow: "hidden",
        }}>
          <summary style={{
            padding: "13px 20px", fontSize: 12, fontWeight: 600,
            color: "#3f3f46", cursor: "pointer",
            userSelect: "none" as const,
            display: "flex", alignItems: "center", gap: 6,
          }}>
            {ico.code}
            <span>Raw /oauth/userinfo</span>
          </summary>
          <pre style={{
            padding: "0 20px 16px", margin: 0,
            fontSize: 11, lineHeight: 1.6, color: "#71717a",
            fontFamily: "'SF Mono', 'Fira Code', monospace",
            overflowX: "auto" as const,
            whiteSpace: "pre-wrap" as const,
            wordBreak: "break-all" as const,
          }}>
            {JSON.stringify(userInfo, null, 2)}
          </pre>
        </details>

        {/* Footer */}
        <div style={{
          textAlign: "center", marginTop: 32,
          fontSize: 11, color: "#27272a", letterSpacing: "0.02em",
        }}>
          Powered by NS OAuth
        </div>
      </div>
    </div>
  )
}
