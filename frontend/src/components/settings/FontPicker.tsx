'use client'

import { useEffect, useMemo } from 'react'
import { Check, Type } from 'lucide-react'

import {
  DEFAULT_FONT_ID,
  PROFESSIONAL_FONTS,
  type ProfessionalFont,
} from '@/lib/tenant/fonts'
import { cn } from '@/lib/utils'

interface FontPickerProps {
  /** Stored font id (or null/empty for app default). */
  value: string | null | undefined
  /** Pass `null` when the user picks the default; otherwise the new id. */
  onChange: (next: string | null) => void
}

/**
 * Curated tenant-font picker. Renders one tile per professional font;
 * each tile previews the typeface live (the tile's name + alphabet
 * sample render in the font itself) so the owner can see the choice
 * before committing.
 *
 * The component lazy-injects each font's stylesheet on mount so the
 * preview text actually paints in the right typeface, not in the app
 * default. Cleans up on unmount to avoid leaking <link>s into the
 * document head.
 */
export function FontPicker({ value, onChange }: FontPickerProps) {
  const activeId = value ?? DEFAULT_FONT_ID

  // Inject stylesheet links for every previewed font so each tile
  // can render in its own typeface. Default (Outfit) ships with
  // next/font in the root layout, so we skip it here.
  useEffect(() => {
    const links: HTMLLinkElement[] = []
    for (const font of PROFESSIONAL_FONTS) {
      if (font.id === DEFAULT_FONT_ID) continue
      const id = `font-preview-${font.id}`
      if (document.getElementById(id)) continue
      const link = document.createElement('link')
      link.id = id
      link.rel = 'stylesheet'
      link.href = `https://fonts.googleapis.com/css2?family=${font.googleQuery}&display=swap`
      document.head.appendChild(link)
      links.push(link)
    }
    return () => {
      // Leave the active font's link in place if the user navigates
      // away — TenantProvider's applyTenantFont may want to reuse it.
      // Only clean preview-only links the picker added.
      for (const link of links) {
        if (link.id !== 'tenant-font-link') link.remove()
      }
    }
  }, [])

  const tiles = useMemo(() => PROFESSIONAL_FONTS, [])

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <Type className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Pick a typeface for your workspace. Members see the change on
          their next page load.
        </p>
      </div>
      <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
        {tiles.map((font) => (
          <FontTile
            key={font.id}
            font={font}
            active={activeId === font.id}
            onSelect={() =>
              onChange(font.id === DEFAULT_FONT_ID ? null : font.id)
            }
          />
        ))}
      </ul>
    </div>
  )
}

interface FontTileProps {
  font: ProfessionalFont
  active: boolean
  onSelect: () => void
}

function FontTile({ font, active, onSelect }: FontTileProps) {
  // The preview's font-family is set inline so the tile renders in
  // the actual typeface, regardless of the surrounding cascade.
  const previewStyle: React.CSSProperties = {
    fontFamily: `"${font.cssName}", system-ui, sans-serif`,
  }

  return (
    <li>
      <button
        type="button"
        onClick={onSelect}
        aria-pressed={active}
        className={cn(
          'group relative flex w-full flex-col gap-2 rounded-xl border bg-card p-4 text-left transition-all',
          active
            ? 'border-primary ring-1 ring-inset ring-primary/40'
            : 'border-border hover:-translate-y-0.5 hover:border-foreground/20 hover:shadow-sm',
        )}
      >
        {active && (
          <span className="absolute right-3 top-3 inline-flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
            <Check className="h-3 w-3" strokeWidth={3} />
          </span>
        )}
        <div className="flex items-baseline gap-2">
          <span
            className="text-lg font-bold tracking-tight text-foreground"
            style={previewStyle}
          >
            {font.name}
          </span>
          {font.id === 'outfit' && (
            <span className="rounded-md bg-muted px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
              Default
            </span>
          )}
        </div>
        <p className="text-[12px] leading-snug text-muted-foreground">
          {font.description}
        </p>
        <p
          className="text-base text-foreground/80"
          style={previewStyle}
        >
          The quick brown fox jumps over the lazy dog
        </p>
        <p
          className="font-mono text-[11px] text-muted-foreground/70"
          style={previewStyle}
        >
          0 1 2 3 4 5 6 7 8 9 · A a B b
        </p>
      </button>
    </li>
  )
}
