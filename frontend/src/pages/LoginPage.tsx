import { useEffect, useRef } from "react"
import { useSearchParams, useNavigate } from "react-router-dom"
import { usePrivy } from "@privy-io/react-auth"
import { API_BASE } from "@/lib/api"

export function LoginPage() {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { login, ready, authenticated, getAccessToken } = usePrivy()
  const triggered = useRef(false)

  // Auto-trigger Privy login modal as soon as SDK is ready
  useEffect(() => {
    if (ready && !authenticated && !triggered.current) {
      triggered.current = true
      login()
    }
  }, [ready, authenticated])

  // Once authenticated, exchange Privy token for session and go to consent
  useEffect(() => {
    if (authenticated) {
      handlePrivyLogin()
    }
  }, [authenticated])

  async function handlePrivyLogin() {
    try {
      const privyToken = await getAccessToken()
      if (!privyToken) return

      const resp = await fetch(`${API_BASE}/auth/login/privy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ privy_token: privyToken }),
      })

      if (resp.ok) {
        const consentParams = searchParams.toString()
        navigate(`/consent?${consentParams}`)
      }
    } catch (err) {
      console.error("Login failed:", err)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-white/20 border-t-white rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-zinc-400">Connecting to Network School...</p>
      </div>
    </div>
  )
}
