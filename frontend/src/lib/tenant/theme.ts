import { getTheme, type ThemeId, type ThemePalette } from './themes'

/** Convert a hex color (#rgb, #rrggbb, or #rrggbbaa) into the
 * `"R G B"` triplet string Tailwind's `rgb(var(--color) / <alpha-value>)`
 * format expects.
 *
 * Returns null if the input is malformed, so callers can fall back to
 * the CSS defaults.
 */
export function hexToRgbTriplet(hex: string | null | undefined): string | null {
  if (!hex) return null
  if (!hex.startsWith('#')) return null
  let h = hex.slice(1)
  // #rgb -> expand to #rrggbb
  if (h.length === 3) {
    h = h.split('').map((c) => c + c).join('')
  } else if (h.length === 8) {
    // #rrggbbaa — drop alpha; Tailwind controls alpha via <alpha-value>
    h = h.slice(0, 6)
  } else if (h.length !== 6) {
    return null
  }
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) return null
  return `${r} ${g} ${b}`
}

/** Given an RGB triplet like "99 102 241", return "white" or "black"
 * for the best contrast against it — used for `--color-primary-fg`. */
export function contrastingFg(triplet: string): string {
  const parts = triplet.split(/\s+/).map(Number)
  if (parts.length !== 3 || parts.some(Number.isNaN)) return '255 255 255'
  const [r, g, b] = parts
  // Perceived luminance (sRGB, gamma ~2.2 approximation)
  const lum = 0.299 * r + 0.587 * g + 0.114 * b
  return lum > 186 ? '0 0 0' : '255 255 255'
}

/** Apply tenant brand colors (primary + accent only) to the root
 * element. Used by the legacy code path where the OWNER customised
 * colors via the Branding tab without picking a curated theme.
 * Invalid colors are silently ignored so the defaults from globals.css
 * stay in place. */
export function applyTenantTheme(
  primaryColor: string | null | undefined,
  accentColor: string | null | undefined,
): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement

  const primary = hexToRgbTriplet(primaryColor)
  if (primary) {
    root.style.setProperty('--color-primary', primary)
    root.style.setProperty('--color-primary-fg', contrastingFg(primary))
  }

  const accent = hexToRgbTriplet(accentColor)
  if (accent) {
    root.style.setProperty('--color-accent', accent)
    root.style.setProperty('--color-accent-fg', contrastingFg(accent))
  }
}

/** CSS variable mapping: ThemePalette key → CSS custom property name.
 * Centralised so adding a new variable is a one-line change.
 *
 * `dataviz` is intentionally absent — it's an array, not a scalar, so
 * it's handled separately below and unrolled into 8 individual
 * `--chart-1` … `--chart-8` properties. */
const VAR_MAP: Record<Exclude<keyof ThemePalette, 'dataviz'>, string> = {
  background: '--background',
  foreground: '--foreground',
  card: '--card',
  cardForeground: '--card-foreground',
  popover: '--popover',
  popoverForeground: '--popover-foreground',
  secondary: '--secondary',
  secondaryForeground: '--secondary-foreground',
  muted: '--muted',
  mutedForeground: '--muted-foreground',
  border: '--border',
  input: '--input',
  ring: '--ring',
  primary: '--color-primary',
  primaryFg: '--color-primary-fg',
  accent: '--color-accent',
  accentFg: '--color-accent-fg',
  sidebarBackground: '--sidebar-background',
  sidebarForeground: '--sidebar-foreground',
  sidebarHover: '--sidebar-hover',
  sidebarActive: '--sidebar-active',
  sidebarBorder: '--sidebar-border',
  sidebarMuted: '--sidebar-muted',
}

/** Apply a curated theme preset (one of the 5 in themes.ts) to the
 * root element. Picks the light-vs-dark half based on whether the
 * `<html>` element currently carries the `dark` class — so the call
 * stays in sync with the per-user `ThemeProvider` toggle.
 *
 * Idempotent: safe to call on every render / hydration / mode flip.
 * No-op on the server. */
export function applyThemePreset(themeId: ThemeId | string | null | undefined): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement
  const theme = getTheme(themeId)
  const isDark = root.classList.contains('dark')
  const palette = isDark ? theme.dark : theme.light

  for (const key of Object.keys(VAR_MAP) as (keyof typeof VAR_MAP)[]) {
    root.style.setProperty(VAR_MAP[key], palette[key])
  }
  // Unroll the dataviz array into individual `--chart-1` ...
  // `--chart-8` custom properties so chart code can pick up colors
  // by index without having to import the theme catalog.
  for (let i = 0; i < palette.dataviz.length; i++) {
    root.style.setProperty(`--chart-${i + 1}`, palette.dataviz[i])
  }
  // Stamp the active theme on the root so debug tooling (and any
  // future per-theme selectors) can branch on data-theme.
  root.setAttribute('data-theme', theme.id)
}
