import { Link } from "react-router-dom"
import { ChevronRight } from "lucide-react"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { formatRelativeTime } from "@/lib/utils"
import type { OAuthApp } from "@/lib/api"

export function AppCard({ app }: { app: OAuthApp }) {
  return (
    <Link to={`/apps/${app.id}`}>
      <Card className="hover:border-muted-foreground/50 hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 cursor-pointer group">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex-1 min-w-0">
              <CardTitle className="text-lg">{app.name}</CardTitle>
              {app.description && (
                <CardDescription className="line-clamp-2 mt-1">{app.description}</CardDescription>
              )}
            </div>
            <ChevronRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-1" />
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-2">
            <div className="text-sm text-muted-foreground font-mono">
              {app.client_id.slice(0, 8)}...
            </div>
            <div className="flex items-center justify-between gap-2">
              {app.scopes.length > 0 ? (
                <div className="flex gap-1 flex-wrap">
                  {app.scopes.map((scope) => (
                    <Badge key={scope} variant="secondary" className="text-[10px]">{scope}</Badge>
                  ))}
                </div>
              ) : (
                <div />
              )}
              <span className="text-xs text-muted-foreground shrink-0">
                {formatRelativeTime(app.created_at)}
              </span>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}
