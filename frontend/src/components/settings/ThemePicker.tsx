'use client'

import { Check, Eye } from 'lucide-react'
import { THEMES, getTheme, type Theme, type ThemeId } from '@/lib/tenant/themes'
import { cn } from '@/lib/utils'

interface ThemePickerProps {
  /** Currently-selected theme in the form (may be unsaved). */
  value: ThemeId | string
  /** The theme persisted on the server right now — used to label the
   *  "preview" vs "active" badges. */
  savedValue: ThemeId | string
  onChange: (next: ThemeId) => void
}

/**
 * 5-up theme preset picker. Each card renders a miniature preview
 * built from the theme's actual swatches — surface, sidebar, primary,
 * accent — so you see the *feel* of the theme without committing.
 *
 * Clicking a card ONLY updates local form state. The global app
 * appearance does not change until the user clicks **Save changes**;
 * only then does the parent settings page call `applyThemePreset` and
 * `orgsApi.updateSettings`. This avoids the surprise of the whole
 * workspace re-theming while a user is just browsing options.
 */
export function ThemePicker({ value, savedValue, onChange }: ThemePickerProps) {
  const dirty = value !== savedValue
  const previewTheme = getTheme(value)

  return (
    <div className="flex flex-col gap-5">
      <p className="max-w-prose text-sm text-muted-foreground">
        Pick a workspace-wide theme. Every member sees the palette you
        choose; their personal light/dark toggle controls which half is
        shown. The cards below show miniature previews — the workspace
        only re-themes when you click <strong className="font-medium text-foreground">Save changes</strong>.
      </p>

      {dirty && (
        <div
          role="status"
          className="flex items-start gap-2.5 rounded-md border border-amber-300/50 bg-amber-50 px-3 py-2.5 text-[12px] leading-relaxed text-amber-800 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-200"
        >
          <Eye
            className="mt-0.5 h-3.5 w-3.5 shrink-0"
            strokeWidth={1.8}
          />
          <span>
            <strong className="font-medium">{previewTheme.name}</strong>{' '}
            selected. Click <strong className="font-medium">Save changes</strong>{' '}
            below to apply it to your whole workspace.
          </span>
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {THEMES.map((theme) => (
          <ThemeCard
            key={theme.id}
            theme={theme}
            selected={theme.id === value}
            isSaved={theme.id === savedValue}
            onPick={() => onChange(theme.id)}
          />
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground">
        Tip: after saving, switch your personal light/dark mode
        (sun/moon icon in the sidebar) to preview both halves of the
        active theme.
      </p>
    </div>
  )
}

/* ─────────────────────────────────────────────────────────────────
 * Single theme card — header strip + miniature dashboard preview
 * + name/description footer. Self-contained so the parent grid
 * stays a flat map.
 * ───────────────────────────────────────────────────────────────── */

function ThemeCard({
  theme,
  selected,
  isSaved,
  onPick,
}: {
  theme: Theme
  /** True when this card is the current form selection (may be unsaved). */
  selected: boolean
  /** True when this card is what the workspace is *actually* using right
   *  now — drives the "Active" vs "Selected" badge labelling. */
  isSaved: boolean
  onPick: () => void
}) {
  // Resolve the swatch hexes once — the preview renders with these
  // directly so we don't have to round-trip through CSS variables.
  const { primary, accent, surface } = theme.preview

  return (
    <button
      type="button"
      onClick={onPick}
      aria-pressed={selected}
      className={cn(
        'group relative flex flex-col overflow-hidden rounded-xl border bg-card text-left transition-all',
        selected
          ? 'border-foreground/50 ring-2 ring-foreground/10'
          : 'border-border/70 hover:border-foreground/30',
      )}
    >
      {/* ── Miniature preview surface ───────────────────────────── */}
      <div
        className="relative aspect-[16/9] w-full overflow-hidden"
        style={{ backgroundColor: surface }}
      >
        {/* Faux sidebar — narrower rail with subtle separator. Matches
            surface tone (after the v3 themes refactor every theme uses
            a light sidebar in light mode and a dark one in dark mode,
            so a tinted rail is no longer accurate to the real app). */}
        <div
          className="absolute inset-y-0 left-0 w-[22%]"
          style={{
            backgroundColor: surface,
            borderRight: '1px solid rgba(0,0,0,0.07)',
          }}
        >
          <div className="flex h-full flex-col gap-1.5 p-2">
            <div
              className="h-1.5 w-2/3 rounded-full"
              style={{ backgroundColor: primary, opacity: 0.7 }}
            />
            <div
              className="h-1 w-1/2 rounded-full"
              style={{ backgroundColor: 'rgba(0,0,0,0.35)' }}
            />
            <div
              className="h-1 w-2/3 rounded-full"
              style={{ backgroundColor: 'rgba(0,0,0,0.22)' }}
            />
            <div
              className="mt-0.5 h-2 w-3/4 rounded-sm"
              style={{ backgroundColor: primary, opacity: 0.14 }}
            />
            <div
              className="h-1 w-1/2 rounded-full"
              style={{ backgroundColor: 'rgba(0,0,0,0.22)' }}
            />
          </div>
        </div>

        {/* Content area — title rule + 3 stat cells, slightly tighter */}
        <div className="absolute inset-y-0 left-[22%] right-0 flex flex-col gap-1.5 p-2">
          {/* Title line + button */}
          <div className="flex items-center justify-between gap-2 px-0.5">
            <div
              className="h-1.5 flex-1 rounded-full"
              style={{ backgroundColor: 'rgba(0,0,0,0.55)' }}
            />
            <span
              className="h-3 w-7 rounded-sm"
              style={{ backgroundColor: primary }}
            />
          </div>

          {/* Stat cells — three hairline cards with a tabular numeral
              accent in the second cell */}
          <div className="grid flex-1 grid-cols-3 gap-1">
            {[primary, accent, primary].map((c, i) => (
              <div
                key={i}
                className="flex flex-col justify-between rounded-sm bg-white/55 p-1"
                style={{
                  border: '1px solid rgba(0,0,0,0.06)',
                }}
              >
                <span
                  className="block h-0.5 w-2/3 rounded-full"
                  style={{ backgroundColor: 'rgba(0,0,0,0.4)' }}
                />
                <span
                  className="block h-1.5 w-3/4 rounded-sm"
                  style={{ backgroundColor: c, opacity: i === 1 ? 0.9 : 0.7 }}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Dataviz spectrum strip ─────────────────────────────────
          Eight-color cycle from the theme's chart palette, rendered
          as equal-width slivers. Tells you at a glance what charts
          and per-app dots look like under this theme — the strip is
          what makes Velour feel like burgundy *throughout*, not just
          on buttons. */}
      <div
        aria-hidden
        className="flex h-[5px] w-full"
      >
        {theme.light.dataviz.map((c, i) => (
          <span
            key={i}
            className="flex-1"
            style={{ backgroundColor: c }}
          />
        ))}
      </div>

      {/* ── Footer — name + description + active marker ────────── */}
      <div className="flex items-start justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground">{theme.name}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
            {theme.description}
          </p>
        </div>
        {selected && (
          <span
            className={cn(
              'inline-flex shrink-0 items-center gap-1 text-[10px] font-semibold uppercase tracking-[0.18em]',
              isSaved ? 'text-foreground' : 'text-amber-700 dark:text-amber-300',
            )}
          >
            {isSaved ? (
              <>
                <Check className="h-3 w-3" strokeWidth={2} />
                Active
              </>
            ) : (
              <>
                <Eye className="h-3 w-3" strokeWidth={2} />
                Selected
              </>
            )}
          </span>
        )}
      </div>
    </button>
  )
}
