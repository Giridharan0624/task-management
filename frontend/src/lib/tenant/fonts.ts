/**
 * Curated catalog of professional fonts a workspace owner can pick from.
 *
 * The list is **deliberately short** — only typefaces that are widely
 * proven on SaaS dashboards (Linear, Stripe, Vercel, Notion-adjacent).
 * Adding more fonts here makes the picker feel like Google Fonts; the
 * point is the opposite — every option here is a safe default that
 * keeps the workspace looking clean and corporate.
 *
 * Loading model: when a tenant picks a non-default font, the active
 * font's stylesheet `<link>` is injected into <head> on demand. The
 * <body>'s `font-family` is updated via the `--font-tenant` CSS
 * variable. Default font (Outfit) is loaded by `next/font` in the root
 * layout and ships in the base bundle; everything else is lazy.
 */

export interface ProfessionalFont {
  /** Stable id stored in OrgSettings.fontFamily. */
  id: string
  /** Display label shown in the settings picker. */
  name: string
  /** One-line tagline shown under the name on the picker tile. */
  description: string
  /** CSS family name (matches the Google Fonts `family` value). */
  cssName: string
  /** URL-encoded family + weights for the Google Fonts CSS endpoint.
   *  Example: `Inter:wght@300;400;500;600;700`. */
  googleQuery: string
}

export const DEFAULT_FONT_ID = 'outfit'

export const PROFESSIONAL_FONTS: ProfessionalFont[] = [
  {
    id: 'outfit',
    name: 'Outfit',
    description: 'App default · Modern geometric sans, friendly UI feel.',
    cssName: 'Outfit',
    googleQuery: 'Outfit:wght@300;400;500;600;700;800',
  },
  {
    id: 'inter',
    name: 'Inter',
    description: 'Industry standard · Highly legible at any size.',
    cssName: 'Inter',
    googleQuery: 'Inter:wght@300;400;500;600;700',
  },
  {
    id: 'manrope',
    name: 'Manrope',
    description: 'Clean and friendly · Popular SaaS pick.',
    cssName: 'Manrope',
    googleQuery: 'Manrope:wght@300;400;500;600;700;800',
  },
  {
    id: 'jakarta',
    name: 'Plus Jakarta Sans',
    description: 'Distinctive and confident · Holds its own at large sizes.',
    cssName: 'Plus Jakarta Sans',
    googleQuery: 'Plus+Jakarta+Sans:wght@300;400;500;600;700;800',
  },
  {
    id: 'lexend',
    name: 'Lexend',
    description: 'Designed for readability · Calm, low-density.',
    cssName: 'Lexend',
    googleQuery: 'Lexend:wght@300;400;500;600;700',
  },
  {
    id: 'dm-sans',
    name: 'DM Sans',
    description: 'Compact geometric · Tight tracking, modern feel.',
    cssName: 'DM Sans',
    googleQuery: 'DM+Sans:wght@300;400;500;600;700',
  },
  {
    id: 'ibm-plex',
    name: 'IBM Plex Sans',
    description: 'Corporate but warm · Pairs well with technical content.',
    cssName: 'IBM Plex Sans',
    googleQuery: 'IBM+Plex+Sans:wght@300;400;500;600;700',
  },
]

export function findFont(id: string | null | undefined): ProfessionalFont {
  if (!id) return PROFESSIONAL_FONTS[0]
  return (
    PROFESSIONAL_FONTS.find((f) => f.id === id) ?? PROFESSIONAL_FONTS[0]
  )
}

const LINK_ID = 'tenant-font-link'
const FALLBACK_STACK = `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`

/**
 * Apply a tenant's chosen font to the document. Idempotent — re-applying
 * the same id is a no-op. Falls back to the default (Outfit, already in
 * the base bundle) when id is null/empty/unknown.
 */
export function applyTenantFont(fontId: string | null | undefined): void {
  if (typeof document === 'undefined') return
  const font = findFont(fontId)
  const root = document.documentElement

  // Track the currently-applied font so we don't reload the stylesheet
  // every time TenantProvider hydrates.
  if (root.dataset.tenantFont === font.id) return
  root.dataset.tenantFont = font.id

  // The default font (Outfit) ships with the Next.js bundle via
  // next/font, so no <link> needs to be injected. Just clear any
  // previously-injected link and reset the CSS variable.
  if (font.id === DEFAULT_FONT_ID) {
    document.getElementById(LINK_ID)?.remove()
    root.style.removeProperty('--font-tenant')
    return
  }

  // Inject (or update) the Google Fonts stylesheet for the active font.
  // `display=swap` keeps text readable while the font loads.
  const href = `https://fonts.googleapis.com/css2?family=${font.googleQuery}&display=swap`
  let link = document.getElementById(LINK_ID) as HTMLLinkElement | null
  if (!link) {
    link = document.createElement('link')
    link.id = LINK_ID
    link.rel = 'stylesheet'
    document.head.appendChild(link)
  }
  if (link.href !== href) link.href = href

  // Apply via CSS variable. `globals.css` reads
  // `var(--font-tenant, var(--font-outfit), system-ui, ...)`, so a
  // missing variable transparently falls back to Outfit.
  root.style.setProperty(
    '--font-tenant',
    `"${font.cssName}", ${FALLBACK_STACK}`,
  )
}
