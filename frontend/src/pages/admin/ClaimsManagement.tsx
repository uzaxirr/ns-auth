import { useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { Plus, Pencil, Power, PowerOff, Loader2, X } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { api } from "@/lib/api"
import type { ClaimDefinition, ClaimCreate, ClaimUpdate } from "@/lib/api"
import { cn } from "@/lib/utils"

const SOURCE_OPTIONS = ["model", "metadata", "computed"]

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

function ClaimForm({
  initial,
  onSave,
  onCancel,
}: {
  initial?: ClaimDefinition
  onSave: (data: ClaimCreate | ClaimUpdate) => Promise<void>
  onCancel: () => void
}) {
  const [name, setName] = useState(initial?.name || "")
  const [label, setLabel] = useState(initial?.label || "")
  const [description, setDescription] = useState(initial?.description || "")
  const [source, setSource] = useState(initial?.source || "model")
  const [saving, setSaving] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    try {
      if (initial) {
        await onSave({ label, description, source } as ClaimUpdate)
      } else {
        await onSave({ name, label, description, source } as ClaimCreate)
      }
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
          placeholder="e.g. twitter_handle"
          required
          disabled={!!initial}
        />
        {!initial && (
          <p className="text-xs text-muted-foreground mt-1">
            Unique identifier, cannot be changed later
          </p>
        )}
      </div>
      <div>
        <label className="text-sm font-medium">Label</label>
        <Input
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. Twitter Handle"
          required
        />
      </div>
      <div>
        <label className="text-sm font-medium">Description</label>
        <Input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="e.g. User's Twitter/X username"
        />
      </div>
      <div>
        <label className="text-sm font-medium">Source</label>
        <select
          value={source}
          onChange={(e) => setSource(e.target.value)}
          className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          {SOURCE_OPTIONS.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
        <p className="text-xs text-muted-foreground mt-1">
          model = User column, metadata = user_metadata JSON, computed = derived value
        </p>
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

export function ClaimsManagement() {
  const [claims, setClaims] = useState<ClaimDefinition[]>([])
  const [loading, setLoading] = useState(true)
  const [dialogOpen, setDialogOpen] = useState(false)
  const [editing, setEditing] = useState<ClaimDefinition | undefined>()

  useEffect(() => {
    loadData()
  }, [])

  async function loadData() {
    try {
      const c = await api.listAdminClaims()
      setClaims(c)
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

  function openEdit(claim: ClaimDefinition) {
    setEditing(claim)
    setDialogOpen(true)
  }

  async function handleSave(data: ClaimCreate | ClaimUpdate) {
    try {
      if (editing) {
        await api.updateClaim(editing.id, data as ClaimUpdate)
        toast.success("Claim updated")
      } else {
        await api.createClaim(data as ClaimCreate)
        toast.success("Claim created")
      }
      setDialogOpen(false)
      await loadData()
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  async function handleToggleActive(claim: ClaimDefinition) {
    try {
      if (claim.is_active) {
        await api.deactivateClaim(claim.id)
        toast.success(`Claim "${claim.name}" deactivated`)
      } else {
        await api.updateClaim(claim.id, { is_active: true })
        toast.success(`Claim "${claim.name}" reactivated`)
      }
      await loadData()
    } catch (err: any) {
      toast.error(err.message)
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
          <h2 className="text-xl font-semibold">Claim Definitions</h2>
          <p className="text-sm text-muted-foreground">
            Registry of all claims available to assign to scopes
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" />
          New Claim
        </Button>
      </div>

      <div className="space-y-2">
        {claims.map((claim) => (
          <Card
            key={claim.id}
            className={cn(!claim.is_active && "opacity-60")}
          >
            <CardContent className="flex items-center gap-4 py-3">
              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-sm font-medium">
                    {claim.name}
                  </span>
                  <Badge variant="secondary" className="text-[10px]">
                    {claim.source}
                  </Badge>
                  {!claim.is_active && (
                    <Badge variant="secondary" className="text-[10px] bg-red-500/10 text-red-500">
                      inactive
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {claim.label}
                  {claim.description && ` — ${claim.description}`}
                </p>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => openEdit(claim)}
                  title="Edit"
                >
                  <Pencil className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => handleToggleActive(claim)}
                  title={claim.is_active ? "Deactivate" : "Reactivate"}
                  className={claim.is_active ? "text-red-500 hover:text-red-600" : "text-green-500 hover:text-green-600"}
                >
                  {claim.is_active ? <PowerOff className="h-4 w-4" /> : <Power className="h-4 w-4" />}
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <Modal
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        title={editing ? "Edit Claim" : "Create Claim"}
      >
        <ClaimForm
          initial={editing}
          onSave={handleSave}
          onCancel={() => setDialogOpen(false)}
        />
      </Modal>
    </div>
  )
}
