import { Key } from "lucide-react"
import { LUCIDE_ICON_MAP } from "@/components/ui/scope-selector"
import { API_BASE } from "@/lib/api"
import { cn } from "@/lib/utils"

interface ScopeIconProps {
  icon: string | null | undefined
  className?: string
}

export function ScopeIcon({ icon, className = "h-5 w-5" }: ScopeIconProps) {
  if (icon && icon.startsWith("/uploads/")) {
    return (
      <img
        src={`${API_BASE}${icon}`}
        alt=""
        className={cn(className, "object-contain")}
      />
    )
  }

  const LucideIcon = (icon && LUCIDE_ICON_MAP[icon]) || Key
  return <LucideIcon className={className} />
}
