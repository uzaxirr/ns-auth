import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { ArrowLeft, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ConfirmDialog } from "@/components/ui/dialog"
import { CredentialDisplay } from "@/components/apps/CredentialDisplay"
import { ApiPlayground } from "@/components/apps/ApiPlayground"
import { api, API_BASE } from "@/lib/api"
import type { OAuthApp } from "@/lib/api"

export function AppDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [app, setApp] = useState<OAuthApp | null>(null)
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)

  useEffect(() => {
    if (id) {
      api.getApp(id).then(setApp).catch(() => navigate("/")).finally(() => setLoading(false))
    }
  }, [id, navigate])

  const confirmDelete = async () => {
    if (!app) return
    setDeleting(true)
    try {
      await api.deleteApp(app.id)
      toast.success("Application deleted")
      navigate("/")
    } catch {
      toast.error("Failed to delete application")
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto space-y-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-9 w-9 rounded-md" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-7 w-[200px]" />
            <Skeleton className="h-4 w-[300px]" />
          </div>
        </div>
        <Card>
          <CardHeader>
            <Skeleton className="h-5 w-[120px]" />
            <Skeleton className="h-4 w-[280px]" />
          </CardHeader>
          <CardContent><Skeleton className="h-9 w-full" /></CardContent>
        </Card>
        <Card>
          <CardHeader><Skeleton className="h-5 w-[100px]" /></CardHeader>
          <CardContent><Skeleton className="h-24 w-full" /></CardContent>
        </Card>
      </div>
    )
  }

  if (!app) return <div className="text-muted-foreground">App not found</div>

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold">{app.name}</h1>
          {app.description && (
            <p className="text-muted-foreground">{app.description}</p>
          )}
        </div>
        <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog(true)} disabled={deleting}>
          <Trash2 className="mr-2 h-4 w-4" />
          Delete
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Credentials</CardTitle>
          <CardDescription>Use these to authenticate with the OAuth token endpoint</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <CredentialDisplay label="Client ID" value={app.client_id} />
          <div className="text-sm text-muted-foreground">
            Client secret was shown only at creation time.
          </div>
        </CardContent>
      </Card>

      {app.redirect_uris.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Redirect URIs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {app.redirect_uris.map((uri) => (
                <div key={uri} className="text-sm font-mono text-muted-foreground">{uri}</div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {app.scopes.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Scopes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex gap-2 flex-wrap">
              {app.scopes.map((scope) => (
                <Badge key={scope} variant="secondary">{scope}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      <ApiPlayground clientId={app.client_id} scopes={app.scopes} />

      <Card>
        <CardHeader>
          <CardTitle>cURL Example</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="rounded-md bg-secondary p-4 text-xs font-mono whitespace-pre-wrap break-all">
{`curl -X POST ${API_BASE}/oauth/token \\
  -d "grant_type=client_credentials" \\
  -d "client_id=${app.client_id}" \\
  -d "client_secret=YOUR_SECRET"`}
          </pre>
        </CardContent>
      </Card>

      <ConfirmDialog
        open={showDeleteDialog}
        onOpenChange={setShowDeleteDialog}
        title="Delete application"
        description={`This will permanently delete "${app.name}" and revoke all associated tokens. This action cannot be undone.`}
        confirmLabel="Delete Application"
        variant="destructive"
        onConfirm={confirmDelete}
        loading={deleting}
      />
    </div>
  )
}
