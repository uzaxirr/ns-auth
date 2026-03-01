import { useEffect, useState } from "react"
import { Outlet } from "react-router-dom"
import { Header } from "./Header"
import { API_BASE, api } from "@/lib/api"
import type { UserMe } from "@/lib/api"

export function Layout() {
  const [user, setUser] = useState<UserMe | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.getMe().then((me) => {
      if (me) {
        setUser(me)
        setLoading(false)
      } else {
        // Not authenticated — redirect to Discord login, come back to current page
        const next = encodeURIComponent(window.location.href)
        window.location.href = `${API_BASE}/auth/discord?next=${next}`
      }
    })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-border border-t-foreground rounded-full animate-spin mx-auto mb-4" />
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen">
      <Header user={user} />
      <main className="container mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
