import { useEffect, useState, useRef } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { ArrowLeft, Trash2, Pencil, Save, X, ExternalLink, Upload, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { UriListInput } from "@/components/ui/uri-list-input"
import { ScopeSelector } from "@/components/ui/scope-selector"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { ConfirmDialog } from "@/components/ui/dialog"
import { CredentialDisplay } from "@/components/apps/CredentialDisplay"
import { ApiPlayground } from "@/components/apps/ApiPlayground"
import { api, API_BASE } from "@/lib/api"
import type { OAuthApp, ScopeDefinition } from "@/lib/api"

export function AppDetail() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [app, setApp] = useState<OAuthApp | null>(null)
  const [availableScopes, setAvailableScopes] = useState<ScopeDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [editing, setEditing] = useState(false)
  const [saving, setSaving] = useState(false)

  // Edit form state
  const [editName, setEditName] = useState("")
  const [editDescription, setEditDescription] = useState("")
  const [editRedirectUris, setEditRedirectUris] = useState<string[]>([])
  const [editScopes, setEditScopes] = useState<string[]>([])
  const [editPrivacyPolicyUrl, setEditPrivacyPolicyUrl] = useState("")
  const [uploadingIcon, setUploadingIcon] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    api.getScopes().then(setAvailableScopes).catch(() => {})
  }, [])

  useEffect(() => {
    if (id) {
      api.getApp(id).then(setApp).catch(() => navigate("/")).finally(() => setLoading(false))
    }
  }, [id, navigate])

  const startEditing = () => {
    if (!app) return
    setEditName(app.name)
    setEditDescription(app.description || "")
    setEditRedirectUris(app.redirect_uris.length > 0 ? [...app.redirect_uris] : [""])
    setEditScopes([...app.scopes])
    setEditPrivacyPolicyUrl(app.privacy_policy_url || "")
    setEditing(true)
  }

  const cancelEditing = () => {
    setEditing(false)
  }

  const handleIconUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!app || !e.target.files?.[0]) return
    setUploadingIcon(true)
    try {
      const updated = await api.uploadAppIcon(app.id, e.target.files[0])
      setApp(updated)
      toast.success("Icon updated")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Icon upload failed")
    } finally {
      setUploadingIcon(false)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  const handleIconDelete = async () => {
    if (!app) return
    setUploadingIcon(true)
    try {
      const updated = await api.deleteAppIcon(app.id)
      setApp(updated)
      toast.success("Icon removed")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to remove icon")
    } finally {
      setUploadingIcon(false)
    }
  }

  const saveChanges = async () => {
    if (!app) return
    setSaving(true)
    try {
      const uris = editRedirectUris.filter(u => u.trim() !== "")
      if (uris.length === 0) {
        toast.error("At least one redirect URI is required")
        setSaving(false)
        return
      }
      const updated = await api.updateApp(app.id, {
        name: editName,
        description: editDescription || undefined,
        redirect_uris: uris,
        scopes: editScopes,
        privacy_policy_url: editPrivacyPolicyUrl || undefined,
      })
      setApp(updated)
      setEditing(false)
      toast.success("Application updated")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to update")
    } finally {
      setSaving(false)
    }
  }

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
        <div className="flex-1 flex items-center gap-3">
          {app.icon_url && (
            <img src={app.icon_url.startsWith("/") ? `${API_BASE}${app.icon_url}` : app.icon_url} alt="" className="h-10 w-10 rounded-lg object-cover" />
          )}
          <div>
            <h1 className="text-2xl font-bold">{app.name}</h1>
            {app.description && (
              <p className="text-muted-foreground">{app.description}</p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          {!editing && (
            <Button variant="outline" size="sm" onClick={startEditing}>
              <Pencil className="mr-2 h-4 w-4" />
              Edit
            </Button>
          )}
          <Button variant="destructive" size="sm" onClick={() => setShowDeleteDialog(true)} disabled={deleting}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      {editing ? (
        <Card>
          <CardHeader>
            <CardTitle>Edit Application</CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input value={editName} onChange={(e) => setEditName(e.target.value)} />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Redirect URIs</label>
              <UriListInput
                values={editRedirectUris}
                onChange={setEditRedirectUris}
              />
              <p className="text-xs text-muted-foreground">Allowed callback URLs for OAuth redirects</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Scopes</label>
              <ScopeSelector
                available={availableScopes}
                selected={editScopes}
                onChange={setEditScopes}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Icon</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
                onChange={handleIconUpload}
                className="hidden"
              />
              {app.icon_url ? (
                <div className="flex items-center gap-3">
                  <img src={`${API_BASE}${app.icon_url}`} alt="" className="h-12 w-12 rounded-lg object-cover border border-border" />
                  <div className="flex gap-2">
                    <Button type="button" variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploadingIcon}>
                      {uploadingIcon ? <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" /> : null}
                      Change
                    </Button>
                    <Button type="button" variant="ghost" size="sm" onClick={handleIconDelete} disabled={uploadingIcon}>
                      <X className="mr-1 h-3.5 w-3.5" />
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingIcon}
                  className="flex items-center gap-2 rounded-md border border-dashed border-input px-4 py-3 text-sm text-muted-foreground hover:border-ring hover:text-foreground transition-colors w-full"
                >
                  {uploadingIcon ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                  Upload an icon (png, jpg, gif, webp, svg — max 2 MB)
                </button>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Privacy Policy URL</label>
              <Input
                placeholder="https://example.com/privacy"
                value={editPrivacyPolicyUrl}
                onChange={(e) => setEditPrivacyPolicyUrl(e.target.value)}
              />
            </div>

            <div className="flex gap-2">
              <Button onClick={saveChanges} disabled={saving || !editName}>
                <Save className="mr-2 h-4 w-4" />
                {saving ? "Saving..." : "Save Changes"}
              </Button>
              <Button variant="ghost" onClick={cancelEditing} disabled={saving}>
                <X className="mr-2 h-4 w-4" />
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
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

          <Card>
            <CardHeader>
              <CardTitle>Redirect URIs</CardTitle>
            </CardHeader>
            <CardContent>
              {app.redirect_uris.length > 0 ? (
                <div className="space-y-1">
                  {app.redirect_uris.map((uri) => (
                    <div key={uri} className="text-sm font-mono text-muted-foreground">{uri}</div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No redirect URIs configured</p>
              )}
            </CardContent>
          </Card>

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

          {(app.icon_url || app.privacy_policy_url) && (
            <Card>
              <CardHeader>
                <CardTitle>App Info</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {app.icon_url && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Icon</label>
                    <div className="mt-1 flex items-center gap-3">
                      <img src={app.icon_url.startsWith("/") ? `${API_BASE}${app.icon_url}` : app.icon_url} alt="" className="h-12 w-12 rounded-lg object-cover border border-border" />
                    </div>
                  </div>
                )}
                {app.privacy_policy_url && (
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Privacy Policy</label>
                    <div className="mt-1">
                      <a
                        href={app.privacy_policy_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-400 hover:underline inline-flex items-center gap-1"
                      >
                        {app.privacy_policy_url}
                        <ExternalLink className="h-3 w-3" />
                      </a>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </>
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
