import { useEffect, useState } from "react"
import { Link } from "react-router-dom"
import { Plus, KeyRound } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Card, CardHeader, CardContent } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { AppCard } from "@/components/apps/AppCard"
import { api } from "@/lib/api"
import type { OAuthApp } from "@/lib/api"

function AppCardSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-[180px]" />
        <Skeleton className="h-4 w-[240px]" />
      </CardHeader>
      <CardContent>
        <div className="space-y-2">
          <Skeleton className="h-4 w-[140px]" />
          <div className="flex gap-1">
            <Skeleton className="h-5 w-12 rounded-md" />
            <Skeleton className="h-5 w-16 rounded-md" />
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

export function Dashboard() {
  const [apps, setApps] = useState<OAuthApp[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.listApps().then(setApps).finally(() => setLoading(false))
  }, [])

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-bold">OAuth Applications</h1>
            {!loading && apps.length > 0 && (
              <Badge variant="secondary">{apps.length}</Badge>
            )}
          </div>
          <p className="text-muted-foreground">Manage your OAuth applications and credentials</p>
        </div>
        <Link to="/apps/new">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Create App
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <AppCardSkeleton key={i} />
          ))}
        </div>
      ) : apps.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border py-16 px-8">
          <div className="rounded-full bg-muted p-4 mb-4">
            <KeyRound className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-semibold mb-1">No applications yet</h3>
          <p className="text-muted-foreground text-sm text-center max-w-sm mb-6">
            Create your first OAuth application to generate client credentials
            and start authenticating API requests.
          </p>
          <Link to="/apps/new">
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Application
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {apps.map((app) => (
            <AppCard key={app.id} app={app} />
          ))}
        </div>
      )}
    </div>
  )
}
