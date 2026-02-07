import { Link } from "react-router-dom"
import { Shield } from "lucide-react"

export function Header() {
  return (
    <header className="border-b border-border">
      <div className="container mx-auto flex h-14 items-center px-4">
        <Link to="/" className="flex items-center gap-2 font-semibold">
          <Shield className="h-5 w-5" />
          <span>ns.com</span>
        </Link>
      </div>
    </header>
  )
}
