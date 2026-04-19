'use client'

import { Input } from '@/components/ui/Input'
import { cn } from '@/lib/utils'

interface ColorFieldProps {
  label: string
  value: string
  onChange: (hex: string) => void
  hint?: string
}

/**
 * Color picker + hex input pair. The native `<input type="color">` only
 * accepts 6-char hex; we surface a text field so users can paste any
 * value, but normalize before dispatching.
 */
export function ColorField({ label, value, onChange, hint }: ColorFieldProps) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-semibold text-foreground">
        {label}
      </label>
      <div className="flex items-stretch gap-2">
        <label
          className={cn(
            'group relative h-10 w-14 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-input transition-all',
            'hover:border-border/80'
          )}
          style={{ backgroundColor: value }}
          aria-label={`${label} swatch`}
        >
          <input
            type="color"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
          />
        </label>
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="font-mono uppercase"
          placeholder="#000000"
        />
      </div>
      {hint && <p className="mt-1 text-[11px] text-muted-foreground">{hint}</p>}
    </div>
  )
}
