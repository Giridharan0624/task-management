'use client'

import { useEffect, useMemo } from 'react'
import { Check } from 'lucide-react'

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
    <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
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
          'group relative flex w-full flex-col gap-2.5 rounded-lg border bg-card p-4 text-left transition-colors',
          active
            ? 'border-foreground/40 shadow-[inset_0_2px_0_0_rgb(var(--color-primary))]'
            : 'border-border/70 hover:border-foreground/30 hover:bg-muted/20',
        )}
      >
        <div className="flex items-baseline justify-between gap-2">
          <span
            className="text-lg font-medium tracking-tight text-foreground"
            style={previewStyle}
          >
            {font.name}
          </span>
          {active ? (
            <span className="inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-foreground">
              <Check className="h-3 w-3" strokeWidth={2} />
              Active
            </span>
          ) : (
            font.id === 'outfit' && (
              <span className="text-[10px] font-medium uppercase tracking-[0.16em] text-muted-foreground/70">
                Default
              </span>
            )
          )}
        </div>
        <p className="text-[12px] leading-snug text-muted-foreground">
          {font.description}
        </p>
        <p
          className="text-base leading-snug text-foreground/85"
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
