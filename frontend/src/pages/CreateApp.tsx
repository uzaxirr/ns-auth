import { useState } from "react"
import { useNavigate } from "react-router-dom"
import { toast } from "sonner"
import { AlertTriangle, Loader2, Copy, Check } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { TagInput } from "@/components/ui/tag-input"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert"
import { CredentialDisplay } from "@/components/apps/CredentialDisplay"
import { api } from "@/lib/api"
import type { OAuthAppCreated } from "@/lib/api"

export function CreateApp() {
  const navigate = useNavigate()
  const [name, setName] = useState("")
  const [description, setDescription] = useState("")
  const [scopes, setScopes] = useState<string[]>([])
  const [redirectUris, setRedirectUris] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [created, setCreated] = useState<OAuthAppCreated | null>(null)
  const [error, setError] = useState("")
  const [copiedBoth, setCopiedBoth] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError("")
    try {
      const app = await api.createApp({
        name,
        description: description || undefined,
        scopes,
        redirect_uris: redirectUris,
      })
      setCreated(app)
      toast.success("Application created")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create app")
    } finally {
      setLoading(false)
    }
  }

  const copyBoth = async () => {
    if (!created) return
    await navigator.clipboard.writeText(
      `Client ID: ${created.client_id}\nClient Secret: ${created.client_secret}`
    )
    setCopiedBoth(true)
    toast.success("Credentials copied to clipboard")
    setTimeout(() => setCopiedBoth(false), 2000)
  }

  if (created) {
    return (
      <div className="max-w-2xl mx-auto space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Application Created</h1>
          <p className="text-muted-foreground mt-1">{created.name} is ready to use</p>
        </div>

        <Alert variant="warning">
          <AlertTriangle className="h-5 w-5 shrink-0 mt-0.5" />
          <div>
            <AlertTitle>Save your client secret</AlertTitle>
            <AlertDescription>
              This is the only time the client secret will be displayed.
              Copy it now and store it securely — you will not be able to retrieve it later.
            </AlertDescription>
          </div>
        </Alert>

        <Card>
          <CardHeader>
            <CardTitle>Credentials</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <CredentialDisplay label="Client ID" value={created.client_id} />
            <CredentialDisplay label="Client Secret" value={created.client_secret} defaultVisible />
            <Button variant="outline" size="sm" onClick={copyBoth}>
              {copiedBoth ? (
                <><Check className="mr-2 h-3 w-3 text-emerald-400" />Copied!</>
              ) : (
                <><Copy className="mr-2 h-3 w-3" />Copy both credentials</>
              )}
            </Button>
          </CardContent>
        </Card>

        {(created.scopes.length > 0 || created.redirect_uris.length > 0) && (
          <Card>
            <CardContent className="pt-6 space-y-3">
              {created.scopes.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Scopes</label>
                  <div className="flex gap-1.5 flex-wrap mt-1">
                    {created.scopes.map((s) => (
                      <Badge key={s} variant="secondary">{s}</Badge>
                    ))}
                  </div>
                </div>
              )}
              {created.redirect_uris.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-muted-foreground">Redirect URIs</label>
                  {created.redirect_uris.map((uri) => (
                    <div key={uri} className="text-sm font-mono text-muted-foreground mt-1">{uri}</div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}

        <Button onClick={() => navigate(`/apps/${created.id}`)}>
          Go to App Details
        </Button>
      </div>
    )
  }

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Create Application</h1>
        <p className="text-muted-foreground">Register a new OAuth application</p>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-2">
              <label className="text-sm font-medium">Name</label>
              <Input
                required
                placeholder="My Application"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <p className="text-xs text-muted-foreground">Used to identify this application in the dashboard</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Description</label>
              <Textarea
                placeholder="What does this application do?"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Redirect URIs</label>
              <TagInput
                values={redirectUris}
                onChange={setRedirectUris}
                placeholder="https://example.com/callback"
                validate={(uri) => {
                  try {
                    new URL(uri)
                    return null
                  } catch {
                    return "Must be a valid URL"
                  }
                }}
              />
              <p className="text-xs text-muted-foreground">Allowed callback URLs. Press Enter to add.</p>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Scopes</label>
              <TagInput
                values={scopes}
                onChange={setScopes}
                placeholder="read write admin"
              />
              <p className="text-xs text-muted-foreground">Permissions this application can request. Press Enter to add.</p>
            </div>

            {error && (
              <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-red-400">
                {error}
              </div>
            )}

            <Button type="submit" disabled={loading || !name}>
              {loading ? (
                <><Loader2 className="mr-2 h-4 w-4 animate-spin" />Creating...</>
              ) : (
                "Create Application"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
