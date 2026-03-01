import { useEffect } from "react"
import { useSearchParams } from "react-router-dom"
import { API_BASE } from "@/lib/api"

export function LoginPage() {
  const [searchParams] = useSearchParams()
  const error = searchParams.get("error")

  useEffect(() => {
    // If there's an error param, don't redirect — show the error
    if (error) return

    // Build the "next" URL: back to /oauth/authorize so auto-approve logic runs
    const authorizeParams = new URLSearchParams()
    searchParams.forEach((value, key) => {
      authorizeParams.set(key, value)
    })
    const nextUrl = `${API_BASE}/oauth/authorize?${authorizeParams.toString()}`

    // Redirect to backend Discord OAuth2 endpoint
    window.location.href = `${API_BASE}/auth/discord?next=${encodeURIComponent(nextUrl)}`
  }, [error, searchParams])

  if (error === "not_ns_member") {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <div className="text-4xl mb-4">🚫</div>
          <h1 className="text-xl font-semibold text-foreground mb-2">
            Not a Network School Member
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            Your Discord account is not a member of the Network School server.
            You need to join the NS Discord to sign in.
          </p>
          <a
            href="https://discord.gg/networkschool"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-block px-4 py-2 bg-[#5865F2] text-white rounded-lg text-sm font-medium hover:bg-[#4752C4] transition-colors mb-3"
          >
            Join Network School Discord
          </a>
          <br />
          <button
            onClick={() => {
              const retryParams = new URLSearchParams(searchParams)
              retryParams.delete("error")
              window.location.href = `${window.location.pathname}?${retryParams.toString()}`
            }}
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="text-center max-w-md">
          <h1 className="text-xl font-semibold text-foreground mb-2">
            Login Failed
          </h1>
          <p className="text-sm text-muted-foreground mb-6">
            Something went wrong during sign in ({error}).
          </p>
          <button
            onClick={() => {
              const retryParams = new URLSearchParams(searchParams)
              retryParams.delete("error")
              window.location.href = `${window.location.pathname}?${retryParams.toString()}`
            }}
            className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Try again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="text-center">
        <div className="w-8 h-8 border-2 border-border border-t-foreground rounded-full animate-spin mx-auto mb-4" />
        <p className="text-sm text-muted-foreground">Redirecting to Discord...</p>
      </div>
    </div>
  )
}
