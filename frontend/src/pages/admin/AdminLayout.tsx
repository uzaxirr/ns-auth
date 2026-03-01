import { useEffect, useState } from "react"
import { Link, Outlet, useLocation, Navigate } from "react-router-dom"
import { Settings, Shield, Database } from "lucide-react"
import { Header } from "@/components/layout/Header"
import { API_BASE, api } from "@/lib/api"
import type { UserMe } from "@/lib/api"
import { cn } from "@/lib/utils"

const NAV_ITEMS = [
  { path: "/admin/scopes", label: "Scopes", icon: Shield },
  { path: "/admin/claims", label: "Claims", icon: Database },
]

export function AdminLayout() {
  const [user, setUser] = useState<UserMe | null>(null)
  const [loading, setLoading] = useState(true)
  const location = useLocation()

  useEffect(() => {
    api.getMe().then((me) => {
      setUser(me)
      setLoading(false)
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

  if (!user?.is_admin) {
    return <Navigate to="/" replace />
  }

  return (
    <div className="min-h-screen">
      <Header user={user} />
      <div className="container mx-auto px-4 py-8">
        <div className="flex items-center gap-2 mb-6">
          <Settings className="h-5 w-5 text-muted-foreground" />
          <h1 className="text-2xl font-bold">Admin</h1>
        </div>

        <div className="flex gap-8">
          {/* Sidebar nav */}
          <nav className="w-48 shrink-0">
            <ul className="space-y-1">
              {NAV_ITEMS.map((item) => {
                const isActive = location.pathname === item.path
                return (
                  <li key={item.path}>
                    <Link
                      to={item.path}
                      className={cn(
                        "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                        isActive
                          ? "bg-secondary text-foreground"
                          : "text-muted-foreground hover:bg-secondary/50 hover:text-foreground"
                      )}
                    >
                      <item.icon className="h-4 w-4" />
                      {item.label}
                    </Link>
                  </li>
                )
              })}
            </ul>
          </nav>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <Outlet />
          </div>
        </div>
      </div>
    </div>
  )
}
