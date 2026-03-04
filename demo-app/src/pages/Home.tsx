import { OAUTH_SERVER, CLIENT_ID, REDIRECT_URI, SCOPES } from "../config"
import { generatePKCE } from "../pkce"

const FONT = "'Outfit', system-ui, -apple-system, sans-serif"
const MONO = "'SF Mono', 'Fira Code', 'Consolas', monospace"

/* NS "+" cross logo */
function NSLogo({ size = 16, color = "#09090b" }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill={color} stroke="none">
      <path d="M11 4h2v16h-2zM4 11h16v2H4z" />
    </svg>
  )
}

export function Home() {
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

    window.location.href = `${OAUTH_SERVER}/oauth/authorize?${params}`
  }

  return (
    <div style={{ minHeight: "100vh", background: "#09090b", color: "#fafafa", fontFamily: FONT }}>
      {/* Nav */}
      <nav style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "14px 32px", maxWidth: 1080, margin: "0 auto",
        borderBottom: "1px solid rgba(255,255,255,0.04)",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{
            width: 30, height: 30, borderRadius: 7,
            background: "#fafafa",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            <NSLogo size={16} color="#09090b" />
          </div>
          <span style={{ fontSize: 15, fontWeight: 700, letterSpacing: "-0.02em" }}>StudyTracker</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
          <span style={{ fontSize: 13, color: "#3f3f46" }}>Features</span>
          <span style={{ fontSize: 13, color: "#3f3f46" }}>Leaderboard</span>
          <span style={{ fontSize: 13, color: "#3f3f46" }}>About</span>
          <button
            onClick={handleSignIn}
            style={{
              padding: "7px 16px", fontSize: 13, fontWeight: 600,
              background: "#fafafa", color: "#09090b",
              border: "none", borderRadius: 7,
              cursor: "pointer", fontFamily: FONT,
            }}
          >Sign in</button>
        </div>
      </nav>

      {/* Hero + App preview layout */}
      <div style={{
        maxWidth: 1080, margin: "0 auto", padding: "60px 32px 0",
        display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center",
      }}>
        {/* Left: Text */}
        <div style={{ animation: "fadeInUp 0.5s ease" }}>
          <div style={{
            display: "inline-flex", alignItems: "center", gap: 6,
            padding: "4px 12px", borderRadius: 6,
            background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)",
            fontSize: 12, fontWeight: 500, color: "#71717a",
            marginBottom: 20,
          }}>
            <NSLogo size={10} color="#71717a" />
            Built for Network School
          </div>

          <h1 style={{
            fontSize: 44, fontWeight: 800, lineHeight: 1.08,
            letterSpacing: "-0.04em", margin: "0 0 16px",
          }}>
            Track what you learn, together.
          </h1>

          <p style={{
            fontSize: 16, lineHeight: 1.7, color: "#71717a",
            margin: "0 0 32px", maxWidth: 420,
          }}>
            Log study sessions, track streaks, compare progress with your cohort,
            and stay accountable. Exclusively for NS members.
          </p>

          <button
            onClick={handleSignIn}
            style={{
              display: "inline-flex", alignItems: "center", gap: 10,
              padding: "14px 28px", fontSize: 15, fontWeight: 700,
              background: "#fafafa", color: "#09090b",
              border: "none", borderRadius: 10,
              cursor: "pointer", fontFamily: FONT,
              boxShadow: "0 4px 20px rgba(255,255,255,0.06)",
              transition: "all 0.2s ease",
            }}
            onMouseOver={(e) => {
              e.currentTarget.style.transform = "translateY(-1px)"
              e.currentTarget.style.boxShadow = "0 8px 30px rgba(255,255,255,0.1)"
            }}
            onMouseOut={(e) => {
              e.currentTarget.style.transform = "translateY(0)"
              e.currentTarget.style.boxShadow = "0 4px 20px rgba(255,255,255,0.06)"
            }}
          >
            <div style={{
              width: 20, height: 20, borderRadius: 5,
              background: "#09090b",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <NSLogo size={12} color="#fafafa" />
            </div>
            Sign in with Network School
          </button>

          <p style={{
            fontSize: 12, color: "#3f3f46", marginTop: 12,
          }}>
            Requires NS Discord membership
          </p>
        </div>

        {/* Right: Mock app preview */}
        <div style={{
          background: "#111114", borderRadius: 16,
          border: "1px solid rgba(255,255,255,0.06)",
          overflow: "hidden",
          animation: "fadeInUp 0.5s ease 0.15s both",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}>
          {/* Mock top bar */}
          <div style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 16px",
            borderBottom: "1px solid rgba(255,255,255,0.04)",
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{
                width: 24, height: 24, borderRadius: "50%",
                background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
              }} />
              <span style={{ fontSize: 13, fontWeight: 600 }}>alice</span>
              <span style={{
                fontSize: 10, fontWeight: 600, padding: "2px 6px",
                borderRadius: 4, background: "rgba(52,211,153,0.12)",
                color: "#34d399",
              }}>Cohort 5</span>
            </div>
            <div style={{ display: "flex", gap: 6 }}>
              <span style={{
                fontSize: 11, fontWeight: 600, padding: "3px 8px",
                borderRadius: 5, background: "rgba(255,255,255,0.04)",
                color: "#52525b",
              }}>7-day streak</span>
            </div>
          </div>

          {/* Mock study log */}
          <div style={{ padding: 16 }}>
            <div style={{
              fontSize: 10, fontWeight: 700, color: "#3f3f46",
              textTransform: "uppercase" as const, letterSpacing: "0.1em",
              marginBottom: 10,
            }}>This week</div>

            {[
              { day: "Today", topic: "Solidity — ERC-721 standard", hrs: "2.5h", streak: true },
              { day: "Yesterday", topic: "Rust — ownership & borrowing", hrs: "1.8h", streak: true },
              { day: "Mon", topic: "ZK Proofs — Groth16 intro", hrs: "3.0h", streak: true },
              { day: "Sun", topic: "React Server Components", hrs: "2.0h", streak: true },
            ].map((entry, i) => (
              <div key={i} style={{
                display: "flex", alignItems: "center", justifyContent: "space-between",
                padding: "10px 12px", borderRadius: 8,
                background: i === 0 ? "rgba(255,255,255,0.03)" : "transparent",
                marginBottom: 2,
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{
                    width: 6, height: 6, borderRadius: "50%",
                    background: entry.streak ? "#34d399" : "#27272a",
                  }} />
                  <div>
                    <div style={{ fontSize: 13, fontWeight: 500 }}>{entry.topic}</div>
                    <div style={{ fontSize: 11, color: "#3f3f46" }}>{entry.day}</div>
                  </div>
                </div>
                <span style={{
                  fontSize: 12, fontWeight: 600, color: "#52525b",
                  fontFamily: MONO,
                }}>{entry.hrs}</span>
              </div>
            ))}

            {/* Mock stats bar */}
            <div style={{
              display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
              gap: 8, marginTop: 14, paddingTop: 14,
              borderTop: "1px solid rgba(255,255,255,0.04)",
            }}>
              {[
                { label: "This week", value: "9.3h" },
                { label: "Streak", value: "7 days" },
                { label: "Cohort rank", value: "#4" },
              ].map((s, i) => (
                <div key={i} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: "-0.02em" }}>{s.value}</div>
                  <div style={{
                    fontSize: 10, color: "#3f3f46", fontWeight: 600,
                    textTransform: "uppercase" as const, letterSpacing: "0.06em",
                    marginTop: 2,
                  }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom section — social proof */}
      <div style={{
        maxWidth: 1080, margin: "0 auto", padding: "60px 32px 40px",
        display: "flex", justifyContent: "center", gap: 40,
        animation: "fadeIn 0.6s ease 0.4s both",
      }}>
        {[
          { num: "120+", label: "NS members" },
          { num: "2,400+", label: "Sessions logged" },
          { num: "45", label: "Day top streak" },
        ].map((s, i) => (
          <div key={i} style={{ textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 800, letterSpacing: "-0.03em" }}>{s.num}</div>
            <div style={{ fontSize: 12, color: "#3f3f46", fontWeight: 500, marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <footer style={{
        textAlign: "center", padding: "20px 24px",
        borderTop: "1px solid rgba(255,255,255,0.04)",
        fontSize: 12, color: "#27272a",
      }}>
        Powered by NS OAuth &middot; Built by an NS member
      </footer>
    </div>
  )
}
