import { OAUTH_SERVER, CLIENT_ID, REDIRECT_URI, SCOPES } from "../config"
import { generatePKCE } from "../pkce"

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
    <div style={{
      minHeight: "100vh",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      background: "#09090b",
      color: "#fafafa",
      fontFamily: "system-ui, -apple-system, sans-serif",
    }}>
      <div style={{ maxWidth: 480, textAlign: "center", padding: 24 }}>
        <div style={{
          width: 64,
          height: 64,
          background: "#18181b",
          borderRadius: 16,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          margin: "0 auto 24px",
          fontSize: 28,
        }}>
          NS
        </div>
        <h1 style={{ fontSize: 28, fontWeight: 700, margin: "0 0 8px", letterSpacing: "-0.02em" }}>
          Demo Client App
        </h1>
        <p style={{ color: "#a1a1aa", margin: "0 0 32px", fontSize: 15, lineHeight: 1.6 }}>
          This app demonstrates the OAuth authorization code flow with the Network School identity provider.
        </p>
        <button
          onClick={handleSignIn}
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 10,
            padding: "14px 32px",
            fontSize: 15,
            fontWeight: 600,
            background: "#fafafa",
            color: "#09090b",
            border: "none",
            borderRadius: 10,
            cursor: "pointer",
            transition: "opacity 0.15s",
          }}
          onMouseOver={(e) => (e.currentTarget.style.opacity = "0.9")}
          onMouseOut={(e) => (e.currentTarget.style.opacity = "1")}
        >
          <img src="/ns-flag.svg" alt="" style={{ width: 20, height: 20 }} />
          Sign in with Network School
        </button>
      </div>
    </div>
  )
}
