import { useState, useRef, type KeyboardEvent } from "react"
import { X } from "lucide-react"
import { Badge } from "./badge"
import { cn } from "@/lib/utils"

interface TagInputProps {
  values: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  validate?: (value: string) => string | null
}

export function TagInput({ values, onChange, placeholder, validate }: TagInputProps) {
  const [input, setInput] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [focused, setFocused] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const addTag = (raw: string) => {
    const parts = raw.split(/[\s,]+/).filter(Boolean)
    if (parts.length === 0) return
    const newValues = [...values]
    for (const part of parts) {
      if (newValues.includes(part)) continue
      if (validate) {
        const err = validate(part)
        if (err) {
          setError(err)
          return
        }
      }
      newValues.push(part)
    }
    onChange(newValues)
    setInput("")
    setError(null)
  }

  const removeTag = (index: number) => {
    onChange(values.filter((_, i) => i !== index))
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault()
      addTag(input)
    } else if (e.key === "Backspace" && !input && values.length > 0) {
      removeTag(values.length - 1)
    } else {
      setError(null)
    }
  }

  return (
    <div>
      <div
        className={cn(
          "flex flex-wrap items-center gap-1.5 min-h-[36px] w-full rounded-md border bg-transparent px-3 py-1.5 text-sm transition-colors cursor-text",
          focused ? "border-ring ring-1 ring-ring" : "border-input",
          error && "border-red-500/50"
        )}
        onClick={() => inputRef.current?.focus()}
      >
        {values.map((value, index) => (
          <Badge key={value} variant="secondary" className="gap-1 pr-1 text-xs">
            {value}
            <button
              type="button"
              className="ml-0.5 rounded-sm hover:bg-muted-foreground/20 p-0.5"
              onClick={(e) => {
                e.stopPropagation()
                removeTag(index)
              }}
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
        <input
          ref={inputRef}
          type="text"
          className="flex-1 min-w-[120px] bg-transparent outline-none placeholder:text-muted-foreground py-0.5"
          placeholder={values.length === 0 ? placeholder : ""}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => setFocused(true)}
          onBlur={() => {
            setFocused(false)
            if (input.trim()) addTag(input)
          }}
        />
      </div>
      {error && (
        <p className="text-xs text-red-400 mt-1">{error}</p>
      )}
    </div>
  )
}
