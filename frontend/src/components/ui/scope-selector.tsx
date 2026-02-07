import { useState } from "react"
import {
  User,
  Mail,
  GraduationCap,
  Activity,
  Share2,
  Wallet,
  RefreshCw,
  Fingerprint,
  ChevronDown,
} from "lucide-react"
import type { ScopeDefinition } from "@/lib/api"
import { cn } from "@/lib/utils"

const SCOPE_ICONS: Record<string, React.ElementType> = {
  openid: Fingerprint,
  profile: User,
  email: Mail,
  cohort: GraduationCap,
  activity: Activity,
  socials: Share2,
  wallet: Wallet,
  offline_access: RefreshCw,
}

interface ScopeSelectorProps {
  available: ScopeDefinition[]
  selected: string[]
  onChange: (scopes: string[]) => void
  disabled?: boolean
}

export function ScopeSelector({ available, selected, onChange, disabled }: ScopeSelectorProps) {
  const [expanded, setExpanded] = useState<string | null>(null)

  const toggle = (name: string) => {
    if (disabled) return
    if (selected.includes(name)) {
      onChange(selected.filter((s) => s !== name))
    } else {
      onChange([...selected, name])
    }
  }

  const allSelected = available.length > 0 && selected.length === available.length

  const toggleAll = () => {
    if (disabled) return
    onChange(allSelected ? [] : available.map((s) => s.name))
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground">
          {selected.length} of {available.length} selected
        </span>
        <button
          type="button"
          onClick={toggleAll}
          disabled={disabled}
          className={cn(
            "text-xs font-medium transition-colors",
            disabled ? "text-muted-foreground/50 cursor-not-allowed" : "text-muted-foreground hover:text-foreground"
          )}
        >
          {allSelected ? "Deselect all" : "Select all"}
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {available.map((scope) => {
          const checked = selected.includes(scope.name)
          const Icon = SCOPE_ICONS[scope.name]
          const isExpanded = expanded === scope.name
          return (
            <div
              key={scope.name}
              className={cn(
                "rounded-lg border transition-all",
                disabled
                  ? "opacity-50 cursor-not-allowed border-border"
                  : checked
                    ? "border-ring bg-secondary/60 ring-1 ring-ring"
                    : "border-border hover:border-muted-foreground/40 hover:bg-secondary/30"
              )}
            >
              <button
                type="button"
                onClick={() => toggle(scope.name)}
                disabled={disabled}
                className="flex items-start gap-3 px-3 py-3 text-left w-full"
              >
                <div
                  className={cn(
                    "mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors",
                    checked
                      ? "border-primary bg-primary text-primary-foreground"
                      : "border-muted-foreground/40"
                  )}
                >
                  {checked && (
                    <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                      <path d="M2 5L4.5 7.5L8 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    {Icon && <Icon className={cn("h-3.5 w-3.5", checked ? "text-foreground" : "text-muted-foreground")} />}
                    <span className={cn("font-mono text-sm", checked ? "text-foreground" : "text-muted-foreground")}>{scope.name}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground mt-0.5 leading-tight">{scope.description}</p>
                </div>
              </button>

              {scope.claims.length > 0 && (
                <>
                  <button
                    type="button"
                    onClick={() => setExpanded(isExpanded ? null : scope.name)}
                    className="flex items-center gap-1 px-3 pb-2 text-[11px] text-muted-foreground hover:text-foreground transition-colors w-full"
                  >
                    <ChevronDown className={cn("h-3 w-3 transition-transform", isExpanded && "rotate-180")} />
                    <span>{scope.claims.length} fields</span>
                  </button>
                  {isExpanded && (
                    <div className="px-3 pb-3 flex flex-wrap gap-1">
                      {scope.claims.map((claim) => (
                        <span
                          key={claim}
                          className="rounded bg-secondary px-1.5 py-0.5 text-[10px] font-mono text-muted-foreground"
                        >
                          {claim}
                        </span>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })}
      </div>

      {selected.length > 0 && (
        <div className="flex gap-1.5 flex-wrap pt-1">
          {selected.map((name) => (
            <span
              key={name}
              className="inline-flex items-center gap-1 rounded-md bg-secondary px-2 py-0.5 text-[11px] font-mono text-secondary-foreground"
            >
              {name}
              {!disabled && (
                <button
                  type="button"
                  onClick={() => toggle(name)}
                  className="ml-0.5 text-muted-foreground hover:text-foreground transition-colors"
                >
                  &times;
                </button>
              )}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
