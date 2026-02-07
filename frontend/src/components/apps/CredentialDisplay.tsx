import { useState } from "react"
import { toast } from "sonner"
import { Copy, Check, Eye, EyeOff } from "lucide-react"
import { Button } from "@/components/ui/button"

interface CredentialDisplayProps {
  label: string
  value: string
  secret?: boolean
  defaultVisible?: boolean
}

export function CredentialDisplay({ label, value, secret = false, defaultVisible }: CredentialDisplayProps) {
  const [copied, setCopied] = useState(false)
  const [visible, setVisible] = useState(defaultVisible ?? !secret)

  const copyToClipboard = async () => {
    await navigator.clipboard.writeText(value)
    setCopied(true)
    toast.success(`${label} copied to clipboard`)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-1">
      <label className="text-sm font-medium text-muted-foreground">{label}</label>
      <div className="flex items-center gap-2">
        <code className="flex-1 rounded-md bg-secondary px-3 py-2 text-sm font-mono break-all">
          {visible ? value : "\u2022".repeat(Math.min(value.length, 40))}
        </code>
        {secret && (
          <Button variant="ghost" size="icon" onClick={() => setVisible(!visible)}>
            {visible ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </Button>
        )}
        <Button variant="ghost" size="icon" onClick={copyToClipboard}>
          {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
        </Button>
      </div>
    </div>
  )
}
