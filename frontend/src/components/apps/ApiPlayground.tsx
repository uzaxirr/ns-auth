import { useState, useEffect } from "react"
import { toast } from "sonner"
import {
  KeyRound,
  FileSearch,
  ShieldOff,
  ChevronDown,
  Copy,
  Check,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card"
import { ConfirmDialog } from "@/components/ui/dialog"
import { api } from "@/lib/api"
import type { IntrospectResponse, ScopeDefinition } from "@/lib/api"
import { decodeJWT, formatTimestamp, isTokenExpired } from "@/lib/jwt"
import type { DecodedJWT } from "@/lib/jwt"
import { cn } from "@/lib/utils"

interface ApiPlaygroundProps {
  clientId: string
  scopes?: string[]
}

// --- Sub-components ---

function StepHeader({
  number,
  icon: Icon,
  title,
  description,
  open,
  disabled,
  onClick,
  badge,
}: {
  number: number
  icon: React.ElementType
  title: string
  description: string
  open: boolean
  disabled: boolean
  onClick: () => void
  badge?: React.ReactNode
}) {
  return (
    <button
      className={cn(
        "flex w-full items-start gap-4 text-left p-4 rounded-lg transition-colors",
        disabled ? "opacity-40 cursor-not-allowed" : "hover:bg-secondary/50 cursor-pointer"
      )}
      onClick={onClick}
      disabled={disabled}
    >
      <div
        className={cn(
          "flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold",
          disabled
            ? "bg-muted text-muted-foreground"
            : "bg-primary text-primary-foreground"
        )}
      >
        {number}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{title}</span>
          {badge}
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">{description}</p>
      </div>
      <ChevronDown
        className={cn(
          "h-4 w-4 shrink-0 text-muted-foreground transition-transform mt-1",
          open && "rotate-180"
        )}
      />
    </button>
  )
}

function ClaimRow({ label, value, highlight }: { label: string; value: React.ReactNode; highlight?: string }) {
  return (
    <div className="flex justify-between items-start gap-4 py-1.5 text-sm">
      <span className={cn("font-mono shrink-0", highlight || "text-muted-foreground")}>{label}</span>
      <span className="text-right break-all font-mono">{value}</span>
    </div>
  )
}

function DecodedJwtView({ decoded }: { decoded: DecodedJWT }) {
  const { header, payload } = decoded
  const expired = isTokenExpired(payload)

  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="h-2 w-2 rounded-full bg-blue-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-blue-400">Header</span>
        </div>
        <div className="rounded-lg bg-blue-500/5 border border-blue-500/10 px-4 py-2 divide-y divide-border">
          {Object.entries(header).map(([k, v]) => (
            <ClaimRow key={k} label={k} value={String(v)} highlight="text-blue-400" />
          ))}
        </div>
      </div>

      {/* Payload */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="h-2 w-2 rounded-full bg-emerald-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-emerald-400">Payload</span>
        </div>
        <div className="rounded-lg bg-emerald-500/5 border border-emerald-500/10 px-4 py-2 divide-y divide-border">
          {Object.entries(payload).map(([k, v]) => {
            let rendered: React.ReactNode = String(v)

            if (k === "exp" || k === "iat") {
              rendered = (
                <span className="flex items-center gap-2">
                  <span>{formatTimestamp(v as number)}</span>
                  {k === "exp" && expired && (
                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0">Expired</Badge>
                  )}
                </span>
              )
            }
            if (k === "scope" && typeof v === "string" && v) {
              rendered = (
                <span className="flex gap-1 flex-wrap justify-end">
                  {v.split(" ").map((s) => (
                    <Badge key={s} variant="secondary" className="text-[10px]">{s}</Badge>
                  ))}
                </span>
              )
            }

            return <ClaimRow key={k} label={k} value={rendered} highlight="text-emerald-400" />
          })}
        </div>
      </div>

      {/* Signature */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <div className="h-2 w-2 rounded-full bg-orange-400" />
          <span className="text-xs font-semibold uppercase tracking-wider text-orange-400">Signature</span>
        </div>
        <div className="rounded-lg bg-orange-500/5 border border-orange-500/10 px-4 py-2">
          <p className="text-xs font-mono text-muted-foreground break-all">
            {decoded.signature.slice(0, 64)}...
          </p>
        </div>
      </div>
    </div>
  )
}

function IntrospectionView({
  data,
  loading,
  onIntrospect,
}: {
  data: IntrospectResponse | null
  loading: boolean
  onIntrospect: () => void
}) {
  return (
    <div className="space-y-3">
      <Button variant="outline" size="sm" onClick={onIntrospect} disabled={loading}>
        {loading ? <Loader2 className="mr-2 h-3 w-3 animate-spin" /> : null}
        {loading ? "Checking..." : "Verify with Server"}
      </Button>
      {data && (
        <div className="rounded-lg border border-border px-4 py-2 divide-y divide-border">
          {Object.entries(data).map(([k, v]) => {
            let rendered: React.ReactNode = String(v)
            if (k === "active") {
              rendered = v ? (
                <Badge className="bg-emerald-600 text-white text-[10px]">Active</Badge>
              ) : (
                <Badge variant="destructive" className="text-[10px]">Inactive</Badge>
              )
            }
            if ((k === "exp" || k === "iat") && typeof v === "number") {
              rendered = formatTimestamp(v)
            }
            return <ClaimRow key={k} label={k} value={rendered} />
          })}
        </div>
      )}
    </div>
  )
}

// --- Main Component ---

export function ApiPlayground({ clientId, scopes = [] }: ApiPlaygroundProps) {
  const [clientSecret, setClientSecret] = useState("")
  const [allScopes, setAllScopes] = useState<ScopeDefinition[]>([])
  const [selectedScopes, setSelectedScopes] = useState<string[]>([...scopes])
  const [token, setToken] = useState("")
  const [decoded, setDecoded] = useState<DecodedJWT | null>(null)
  const [activeStep, setActiveStep] = useState(1)
  const [introspection, setIntrospection] = useState<IntrospectResponse | null>(null)
  const [revoked, setRevoked] = useState(false)
  const [showRevokeDialog, setShowRevokeDialog] = useState(false)
  const [loading, setLoading] = useState<"token" | "introspect" | "revoke" | null>(null)
  const [error, setError] = useState("")
  const [inspectTab, setInspectTab] = useState<"decoded" | "introspect">("decoded")
  const [copied, setCopied] = useState(false)

  const hasToken = !!token

  // Fetch available scopes, filtered to app's allowed scopes
  useEffect(() => {
    api.getScopes().then((all) => {
      const filtered = scopes.length > 0
        ? all.filter((s) => scopes.includes(s.name))
        : all
      setAllScopes(filtered)
    }).catch(() => {})
  }, [scopes])

  const requestToken = async () => {
    setLoading("token")
    setError("")
    setToken("")
    setDecoded(null)
    setIntrospection(null)
    setRevoked(false)
    try {
      const scopeStr = selectedScopes.join(" ")
      const res = await api.getToken(clientId, clientSecret, scopeStr || undefined)
      if ("error" in res) {
        setError((res as unknown as { error_description: string }).error_description)
        return
      }
      setToken(res.access_token)
      setDecoded(decodeJWT(res.access_token))
      setActiveStep(2)
      toast.success("Access token issued")
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to get token")
    } finally {
      setLoading(null)
    }
  }

  const introspectToken = async () => {
    setLoading("introspect")
    try {
      const res = await api.introspectToken(token)
      setIntrospection(res)
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Introspection failed")
    } finally {
      setLoading(null)
    }
  }

  const revokeToken = async () => {
    setLoading("revoke")
    try {
      await api.revokeToken(token)
      setRevoked(true)
      setIntrospection(null)
      setShowRevokeDialog(false)
      toast.success("Token revoked successfully")
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Failed to revoke token")
    } finally {
      setLoading(null)
    }
  }

  const copyToken = async () => {
    await navigator.clipboard.writeText(token)
    setCopied(true)
    toast.success("Token copied to clipboard")
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>API Playground</CardTitle>
        <CardDescription>
          Test the OAuth 2.0 Client Credentials flow — request, inspect, and revoke tokens
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-1">
        {/* Step 1: Authenticate */}
        <div className="rounded-lg border border-border">
          <StepHeader
            number={1}
            icon={KeyRound}
            title="Authenticate"
            description="Request an access token using client credentials"
            open={activeStep === 1}
            disabled={false}
            onClick={() => setActiveStep(activeStep === 1 ? 0 : 1)}
          />
          {activeStep === 1 && (
            <div className="px-4 pb-4 space-y-3">
              <div className="space-y-1">
                <label className="text-xs font-medium text-muted-foreground">Client Secret</label>
                <Input
                  type="password"
                  placeholder="Paste your client secret"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                />
              </div>
              {allScopes.length > 0 && (
                <div className="space-y-1">
                  <label className="text-xs font-medium text-muted-foreground">Scopes</label>
                  <div className="rounded-md border border-input divide-y divide-border">
                    {allScopes.map((s) => {
                      const checked = selectedScopes.includes(s.name)
                      return (
                        <label
                          key={s.name}
                          className={cn(
                            "flex items-center gap-3 px-3 py-2 cursor-pointer transition-colors text-sm",
                            "hover:bg-secondary/50",
                            checked && "bg-secondary/30"
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => {
                              setSelectedScopes((prev) =>
                                prev.includes(s.name)
                                  ? prev.filter((x) => x !== s.name)
                                  : [...prev, s.name]
                              )
                            }}
                            className="h-3.5 w-3.5 rounded border-input accent-primary"
                          />
                          <span className="font-mono">{s.name}</span>
                          <span className="text-xs text-muted-foreground">{s.description}</span>
                        </label>
                      )
                    })}
                  </div>
                </div>
              )}
              {error && (
                <div className="rounded-md bg-destructive/10 border border-destructive/20 p-3 text-sm text-red-400">
                  {error}
                </div>
              )}
              <Button onClick={requestToken} disabled={loading === "token" || !clientSecret} size="sm">
                {loading === "token" ? (
                  <><Loader2 className="mr-2 h-3 w-3 animate-spin" />Requesting...</>
                ) : (
                  "Get Access Token"
                )}
              </Button>
            </div>
          )}
        </div>

        {/* Step 2: Inspect Token */}
        <div className="rounded-lg border border-border">
          <StepHeader
            number={2}
            icon={FileSearch}
            title="Inspect Token"
            description="Decode the JWT or verify it via server introspection"
            open={activeStep === 2}
            disabled={!hasToken}
            onClick={() => hasToken && setActiveStep(activeStep === 2 ? 0 : 2)}
            badge={revoked ? <Badge variant="destructive" className="text-[10px]">Revoked</Badge> : undefined}
          />
          {activeStep === 2 && hasToken && (
            <div className="px-4 pb-4 space-y-4">
              {/* Raw token with copy */}
              <div className="flex items-start gap-2">
                <pre className="flex-1 rounded-md bg-secondary p-3 text-[11px] font-mono break-all whitespace-pre-wrap max-h-20 overflow-auto">
                  {token}
                </pre>
                <Button variant="ghost" size="icon" className="shrink-0" onClick={copyToken}>
                  {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
                </Button>
              </div>

              {/* Tab switcher */}
              <div className="flex gap-1 rounded-lg bg-secondary p-1">
                <button
                  className={cn(
                    "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    inspectTab === "decoded" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setInspectTab("decoded")}
                >
                  Decoded JWT
                </button>
                <button
                  className={cn(
                    "flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-colors",
                    inspectTab === "introspect" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  )}
                  onClick={() => setInspectTab("introspect")}
                >
                  Server Introspection
                </button>
              </div>

              {inspectTab === "decoded" && decoded && <DecodedJwtView decoded={decoded} />}
              {inspectTab === "introspect" && (
                <IntrospectionView
                  data={introspection}
                  loading={loading === "introspect"}
                  onIntrospect={introspectToken}
                />
              )}
            </div>
          )}
        </div>

        {/* Step 3: Revoke */}
        <div className="rounded-lg border border-border">
          <StepHeader
            number={3}
            icon={ShieldOff}
            title="Revoke Token"
            description="Permanently invalidate this token"
            open={activeStep === 3}
            disabled={!hasToken || revoked}
            onClick={() => hasToken && !revoked && setActiveStep(activeStep === 3 ? 0 : 3)}
            badge={revoked ? <Badge variant="destructive" className="text-[10px]">Done</Badge> : undefined}
          />
          {activeStep === 3 && hasToken && !revoked && (
            <div className="px-4 pb-4">
              <p className="text-sm text-muted-foreground mb-3">
                Revoked tokens will fail introspection and cannot be used for API access. This cannot be undone.
              </p>
              <Button
                variant="destructive"
                size="sm"
                onClick={() => setShowRevokeDialog(true)}
                disabled={loading === "revoke"}
              >
                Revoke Token
              </Button>
            </div>
          )}
        </div>
      </CardContent>

      <ConfirmDialog
        open={showRevokeDialog}
        onOpenChange={setShowRevokeDialog}
        title="Revoke access token"
        description="This will permanently invalidate the token. Any API requests using this token will be rejected."
        confirmLabel="Revoke"
        variant="destructive"
        onConfirm={revokeToken}
        loading={loading === "revoke"}
      />
    </Card>
  )
}
