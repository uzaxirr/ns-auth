import { Link } from "react-router-dom"
import { LogOut, Settings, BookOpen } from "lucide-react"
import { API_BASE } from "@/lib/api"
import type { UserMe } from "@/lib/api"

export function Header({ user }: { user: UserMe | null }) {
  async function handleLogout() {
    await fetch(`${API_BASE}/auth/logout`, {
      method: "POST",
      credentials: "include",
    })
    window.location.href = "/"
  }

  return (
    <header className="border-b border-border">
      <div className="container mx-auto flex h-14 items-center justify-between px-4">
        <div className="flex items-center gap-4">
          <Link to="/" className="flex items-center gap-2 font-semibold text-foreground">
            OAuth
          </Link>
          <Link
            to="/docs"
            className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <BookOpen className="h-3.5 w-3.5" />
            Docs
          </Link>
        </div>
        {user && (
          <div className="flex items-center gap-3">
            {user.is_admin && (
              <Link
                to="/admin/scopes"
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                <Settings className="h-3.5 w-3.5" />
                Admin
              </Link>
            )}
            <span className="text-sm text-muted-foreground">
              {user.email}
            </span>
            <button
              onClick={handleLogout}
              className="text-muted-foreground hover:text-foreground transition-colors"
              title="Logout"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        )}
      </div>
    </header>
  )
}
