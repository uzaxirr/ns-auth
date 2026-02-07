import { useEffect, useState } from "react"
import { useSearchParams } from "react-router-dom"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { API_BASE } from "@/lib/api"
import { Shield } from "lucide-react"

interface AppInfo {
  app_name: string
  app_icon_url: string | null
  app_description: string | null
  privacy_policy_url: string | null
  scopes: Array<{ name: string; description: string; claims: string[] }>
}

export function ConsentPage() {
  const [searchParams] = useSearchParams()
  const [appInfo, setAppInfo] = useState<AppInfo | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const clientId = searchParams.get("client_id") || ""
  const redirectUri = searchParams.get("redirect_uri") || ""
  const scope = searchParams.get("scope") || "openid"
  const state = searchParams.get("state") || ""
  const codeChallenge = searchParams.get("code_challenge") || ""
  const codeChallengeMethod = searchParams.get("code_challenge_method") || ""

  useEffect(() => {
    fetch(`${API_BASE}/oauth/authorize/info?client_id=${clientId}&scope=${encodeURIComponent(scope)}`)
      .then((r) => r.json())
      .then((data) => {
        setAppInfo(data)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [clientId, scope])

  async function handleConsent(approved: boolean) {
    setSubmitting(true)
    const form = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope,
      state,
      code_challenge: codeChallenge,
      code_challenge_method: codeChallengeMethod,
      approved: approved ? "true" : "false",
    })

    // POST to consent endpoint — it returns JSON with redirect_to
    const resp = await fetch(`${API_BASE}/oauth/authorize/consent`, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      credentials: "include",
      body: form,
    })

    const data = await resp.json()
    if (data.redirect_to) {
      window.location.href = data.redirect_to
    } else {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <p className="text-muted-foreground">Loading...</p>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          {appInfo?.app_icon_url ? (
            <img
              src={appInfo.app_icon_url}
              alt={appInfo.app_name}
              className="w-16 h-16 rounded-xl mx-auto mb-3"
            />
          ) : (
            <Shield className="w-12 h-12 mx-auto mb-3 text-muted-foreground" />
          )}
          <CardTitle className="text-lg">
            {appInfo?.app_name || "Unknown App"} wants to access your account
          </CardTitle>
          {appInfo?.app_description && (
            <p className="text-sm text-muted-foreground mt-1">
              {appInfo.app_description}
            </p>
          )}
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <p className="text-sm font-medium mb-3">This will allow access to:</p>
            <div className="space-y-2">
              {appInfo?.scopes.map((s) => (
                <div
                  key={s.name}
                  className="flex items-start gap-3 p-3 rounded-lg bg-secondary/50"
                >
                  <Badge variant="outline" className="mt-0.5 shrink-0 font-mono text-xs">
                    {s.name}
                  </Badge>
                  <span className="text-sm text-muted-foreground">
                    {s.description}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex gap-3">
            <Button
              variant="outline"
              className="flex-1"
              onClick={() => handleConsent(false)}
              disabled={submitting}
            >
              Deny
            </Button>
            <Button
              className="flex-1"
              onClick={() => handleConsent(true)}
              disabled={submitting}
            >
              Allow
            </Button>
          </div>

          {appInfo?.privacy_policy_url && (
            <p className="text-xs text-center text-muted-foreground">
              <a
                href={appInfo.privacy_policy_url}
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                Privacy Policy
              </a>
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
