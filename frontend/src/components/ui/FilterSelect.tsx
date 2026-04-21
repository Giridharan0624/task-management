'use client'

import * as React from 'react'
import * as SelectPrimitive from '@radix-ui/react-select'
import { Check, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FilterSelectProps {
  value: string
  onChange: (value: string) => void
  options: { value: string; label: string }[]
  className?: string
  placeholder?: string
  active?: boolean
}

export function FilterSelect({
  value,
  onChange,
  options,
  className,
  placeholder,
  active,
}: FilterSelectProps) {
  // Radix Select crashes if any <Item /> gets value="" — it reserves the
  // empty string for "clear selection / show placeholder". Drop any such
  // options defensively and warn in dev so the caller notices.
  const safeOptions = options.filter((o) => o.value !== '')
  if (process.env.NODE_ENV !== 'production' && safeOptions.length !== options.length) {
    // eslint-disable-next-line no-console
    console.warn(
      '[FilterSelect] Dropped options with empty-string `value`. ' +
        'Use a sentinel like "ALL" for catch-all entries.'
    )
  }

  return (
    <SelectPrimitive.Root value={value} onValueChange={onChange}>
      <SelectPrimitive.Trigger
        className={cn(
          'inline-flex items-center justify-between gap-1.5 rounded-lg border px-2.5 py-1.5 text-[11px] font-medium transition-all',
          'focus:outline-none focus-visible:ring-2 focus-visible:ring-ring/30',
          active
            ? 'border-primary/40 bg-primary/10 text-primary'
            : 'border-border bg-card text-muted-foreground hover:border-border/70 hover:text-foreground',
          className
        )}
      >
        <SelectPrimitive.Value placeholder={placeholder ?? 'Select'} />
        <SelectPrimitive.Icon asChild>
          <ChevronDown
            className={cn(
              'h-3 w-3 shrink-0 transition-transform',
              active ? 'text-primary' : 'text-muted-foreground'
            )}
          />
        </SelectPrimitive.Icon>
      </SelectPrimitive.Trigger>

      <SelectPrimitive.Portal>
        <SelectPrimitive.Content
          position="popper"
          sideOffset={4}
          className={cn(
            'relative z-[10000] min-w-[10rem] overflow-hidden rounded-xl border border-border bg-popover text-popover-foreground shadow-elevated',
            'data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95'
          )}
        >
          <SelectPrimitive.Viewport className="p-1">
            {safeOptions.map((opt) => (
              <SelectPrimitive.Item
                key={opt.value}
                value={opt.value}
                className="relative flex w-full cursor-pointer select-none items-center rounded-lg py-1.5 pl-7 pr-3 text-xs text-foreground outline-none transition-colors focus:bg-muted data-[state=checked]:bg-primary/10 data-[state=checked]:text-primary data-[state=checked]:font-semibold"
              >
                <span className="absolute left-2 flex h-3 w-3 items-center justify-center">
                  <SelectPrimitive.ItemIndicator>
                    <Check className="h-3 w-3" />
                  </SelectPrimitive.ItemIndicator>
                </span>
                <SelectPrimitive.ItemText>{opt.label}</SelectPrimitive.ItemText>
              </SelectPrimitive.Item>
            ))}
          </SelectPrimitive.Viewport>
        </SelectPrimitive.Content>
      </SelectPrimitive.Portal>
    </SelectPrimitive.Root>
  )
}
