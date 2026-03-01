import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Plus, Pencil, Trash2, Lock, RotateCcw, Loader2, X, Upload } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { MultiSelect } from "@/components/ui/multi-select"
import { ScopeIcon } from "@/components/ui/scope-icon"
import { LUCIDE_ICON_MAP } from "@/components/ui/scope-selector"
import { api } from "@/lib/api"
import type { ScopeDefinition, ScopeCreate, ScopeUpdate, ClaimDefinition } from "@/lib/api"
import { cn } from "@/lib/utils"

const ICON_OPTIONS = Object.keys(LUCIDE_ICON_MAP)

function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean
  onClose: () => void
  title: string
  children: React.ReactNode
}) {
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", handleKey)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", handleKey)
      document.body.style.overflow = ""
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div
        ref={overlayRef}
        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />
      <div className="relative z-50 w-full max-w-lg rounded-xl border border-border bg-card p-6 shadow-2xl animate-in fade-in-0 zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            onClick={onClose}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>,
    document.body
  )
}

function ScopeForm({
  initial,
  claimDefinitions,
  availableRoles,
  onSave,
  onCancel,
}: {
  initial?: ScopeDefinition
  claimDefinitions: ClaimDefinition[]
  availableRoles: string[]
  onSave: (data: ScopeCreate | ScopeUpdate) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name || "")
  const [description, setDescription] = useState(initial?.description || "")
  const [claims, setClaims] = useState<string[]>(initial?.claims || [])
  const [roles, setRoles] = useState<string[]>(initial?.required_roles || [])
  const [icon, setIcon] = useState(initial?.icon || "Key")
  const [sortOrder, setSortOrder] = useState(initial?.sort_order ?? 0)
  const [saving, setSaving] = useState(false)

  const isUploadedIcon = icon.startsWith("/uploads/")

  const claimOptions = claimDefinitions
    .filter((c) => c.is_active)
    .map((c) => ({ value: c.name, label: c.label }))

  const roleOptions = availableRoles.map((r) => ({ value: r, label: r }))

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      await onSave({ name, description, claims, required_roles: roles, icon, sort_order: sortOrder })
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="text-sm font-medium">Name</label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. builder_activity"
          required
          disabled={!!initial?.is_system}
        />
      </div>
      <div>
        <label className="text-sm font-medium">Description</label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Human-readable description"
          required
        />
      </div>
      <div>
        <label className="text-sm font-medium">Claims</label>
        <MultiSelect
          options={claimOptions}
          selected={claims}
          onChange={setClaims}
          placeholder="Select claims..."
        />
      </div>
      <div>
        <label className="text-sm font-medium">Required Roles (empty = no restriction)</label>
        <MultiSelect
          options={roleOptions}
          selected={roles}
          onChange={setRoles}
          placeholder="Select roles..."
        />
      </div>
      <div className="flex gap-4">
        <div className="flex-1">
          <label className="text-sm font-medium">Icon</label>
          {isUploadedIcon ? (
            <div className="flex items-center gap-2 mt-1">
              <ScopeIcon icon={icon} className="h-6 w-6" />
              <span className="text-xs text-muted-foreground truncate flex-1">Custom icon</span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIcon("Key")}
              >
                Clear
              </Button>
            </div>
          ) : (
            <select
              value={icon}
              onChange={(e) => setIcon(e.target.value)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
            >
              {ICON_OPTIONS.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          )}
        </div>
        <div className="w-24">
          <label className="text-sm font-medium">Sort Order</label>
          <Input
            type="number"
            value={sortOrder}
            onChange={(e) => setSortOrder(parseInt(e.target.value) || 0)}
          />
        </div>
      </div>
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {initial ? "Update" : "Create"}
        </Button>
      </div>
    </form>
  )
}

export function ScopeManagement() {
  const [scopes, setScopes] = useState<ScopeDefinition[]>([])
  const [claimDefs, setClaimDefs] = useState<ClaimDefinition[]>([])
  const [availableRoles, setAvailableRoles] = useState<string[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ScopeDefinition | undefined>()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [uploadingScopeId, setUploadingScopeId] = useState<string | null>(null)

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const [s, c, r] = await Promise.all([
        api.listAdminScopes(),
        api.listAdminClaims(),
        api.getAvailableRoles().catch(() => [] as string[]),
      ])
      setScopes(s)
      setClaimDefs(c)
      setAvailableRoles(r)
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  function openCreate() {
    setEditing(undefined)
    setDialogOpen(true)
  }

  function openEdit(scope: ScopeDefinition) {
    setEditing(scope)
    setDialogOpen(true)
  }

  async function handleSave(data: ScopeCreate | ScopeUpdate) {
    try {
      if (editing) {
        await api.updateScope(editing.id, data as ScopeUpdate)
        toast.success("Scope updated")
      } else {
        await api.createScope(data as ScopeCreate)
        toast.success("Scope created")
      }
      setDialogOpen(false)
      await loadData()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  async function handleDeactivate(scope: ScopeDefinition) {
    try {
      await api.deactivateScope(scope.id)
      toast.success(`Scope "${scope.name}" deactivated`)
      await loadData()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  async function handleReactivate(scope: ScopeDefinition) {
    try {
      await api.updateScope(scope.id, { is_active: true })
      toast.success(`Scope "${scope.name}" reactivated`)
      await loadData()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  function startIconUpload(scopeId: string) {
    setUploadingScopeId(scopeId)
    fileInputRef.current?.click()
  }

  async function handleIconUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file || !uploadingScopeId) return
    try {
      await api.uploadScopeIcon(uploadingScopeId, file)
      toast.success("Icon uploaded")
      await loadData()
    } catch (err: any) {
      toast.error(err.message)
    } finally {
      setUploadingScopeId(null)
      if (fileInputRef.current) fileInputRef.current.value = ""
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Scope Definitions</h2>
          <p className="text-sm text-muted-foreground">
            Manage OAuth scopes and the claims they expose
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New Scope
        </Button>
      </div>

      {/* Hidden file input for icon upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/gif,image/webp,image/svg+xml"
        className="hidden"
        onChange={handleIconUpload}
      />

      <div className="space-y-3">
        {scopes.map((scope) => (
          <Card
            key={scope.id}
            className={cn(!scope.is_active && "opacity-60")}
          >
            <CardContent className="flex items-center gap-4 py-4">
              {/* Icon */}
              <button
                type="button"
                onClick={() => startIconUpload(scope.id)}
                title="Click to upload custom icon"
                className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-secondary hover:bg-secondary/80 transition-colors group relative"
              >
                <ScopeIcon icon={scope.icon} className="h-5 w-5 text-muted-foreground" />
                <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Upload className="h-3.5 w-3.5 text-white" />
                </div>
              </button>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium">
                    {scope.name}
                  </span>
                  {scope.is_system && (
                    <Badge variant="secondary" className="text-[10px]">
                      <Lock className="h-2.5 w-2.5 mr-0.5" />
                      system
                    </Badge>
                  )}
                  {!scope.is_active && (
                    <Badge variant="secondary" className="text-[10px] bg-red-500/10 text-red-500">
                      inactive
                    </Badge>
                  )}
                  {scope.required_roles.length > 0 && (
                    <Badge variant="secondary" className="text-[10px]">
                      role-gated
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {scope.description}
                </p>
                {scope.claims.length > 0 && (
                  <div className="flex gap-1 mt-1.5 flex-wrap">
                    {scope.claims.map((c) => (
                      <span
                        key={c}
                        className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground"
                      >
                        {c}
                      </span>
                    ))}
                  </div>
                )}
                {scope.required_roles.length > 0 && (
                  <div className="flex gap-1 mt-1 flex-wrap">
                    <span className="text-[10px] text-muted-foreground">Requires:</span>
                    {scope.required_roles.map((r) => (
                      <span
                        key={r}
                        className="rounded bg-yellow-500/10 px-1.5 py-0.5 text-[10px] font-mono text-yellow-600"
                      >
                        {r}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEdit(scope)}
                  title="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                {!scope.is_system && (
                  scope.is_active ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDeactivate(scope)}
                      title="Deactivate"
                      className="text-red-500 hover:text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleReactivate(scope)}
                      title="Reactivate"
                      className="text-green-500 hover:text-green-600"
                    >
                      <RotateCcw className="h-4 w-4" />
                    </Button>
                  )
                )}
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Modal
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editing ? "Edit Scope" : "Create Scope"}
      >
        <ScopeForm
          initial={editing}
          claimDefinitions={claimDefs}
          availableRoles={availableRoles}
          onSave={handleSave}
          onCancel={() => setDialogOpen(false)}
        />
      </Modal>
    </div>
  )
}
