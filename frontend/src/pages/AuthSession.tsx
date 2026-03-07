import { useEffect, useRef, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { API_BASE, setSessionToken } from "@/lib/api"

/**
 * Session relay page. The backend redirects here after Discord login with
 * ?code=<single-use-code>&next=<url>. We exchange the code for a session
 * token via POST /auth/session/exchange, store it, and redirect.
 */
export function AuthSession() {
  const [searchParams] = useSearchParams()
  const exchanged = useRef(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (exchanged.current) return
    exchanged.current = true

    const code = searchParams.get("code")
    const next = searchParams.get("next") || "/"

    if (!code) {
      window.location.href = next
      return
    }

    fetch(`${API_BASE}/auth/session/exchange`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ code }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || "Code exchange failed")
        }
        return res.json()
      })
      .then((data) => {
        if (data.token) {
          setSessionToken(data.token)
        }
        window.location.href = next
      })
      .catch((err) => {
        setError(err.message)
      })
  }, [searchParams])

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-sm text-red-500 mb-2">Sign-in failed: {error}</p>
          <a href="/" className="text-sm text-muted-foreground underline">
            Back to home
          </a>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-border border-t-foreground rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-muted-foreground">Signing in...</p>
      </div>
    </div>
  )
}
