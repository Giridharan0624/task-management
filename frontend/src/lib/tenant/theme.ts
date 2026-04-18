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

/** Apply tenant theme colors to the root element by setting the CSS
 * variables Tailwind reads. Invalid colors are silently ignored so the
 * defaults from globals.css stay in place. */
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
