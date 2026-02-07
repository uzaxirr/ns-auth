import { Plus, Trash2 } from "lucide-react"
import { Input } from "./input"
import { Button } from "./button"

interface UriListInputProps {
  values: string[]
  onChange: (values: string[]) => void
  placeholder?: string
}

export function UriListInput({ values, onChange, placeholder = "https://example.com/callback" }: UriListInputProps) {
  const addRow = () => onChange([...values, ""])

  const removeRow = (index: number) => onChange(values.filter((_, i) => i !== index))

  const updateRow = (index: number, value: string) => {
    const next = [...values]
    next[index] = value
    onChange(next)
  }

  const isInvalid = (uri: string) => {
    if (!uri) return false
    try {
      new URL(uri)
      return false
    } catch {
      return true
    }
  }

  return (
    <div className="space-y-2">
      {values.map((uri, index) => (
        <div key={index} className="flex gap-2 items-start">
          <div className="flex-1">
            <Input
              value={uri}
              onChange={(e) => updateRow(index, e.target.value)}
              placeholder={placeholder}
              className={isInvalid(uri) ? "border-red-500/50 focus-visible:ring-red-500/30" : ""}
            />
            {isInvalid(uri) && (
              <p className="text-xs text-red-400 mt-1">Must be a valid URL</p>
            )}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="shrink-0 text-muted-foreground hover:text-red-400"
            onClick={() => removeRow(index)}
            disabled={values.length <= 1}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addRow}>
        <Plus className="mr-1.5 h-3.5 w-3.5" />
        Add URI
      </Button>
    </div>
  )
}
