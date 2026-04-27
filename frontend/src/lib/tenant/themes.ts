/**
 * Curated theme presets — five opinionated palettes, each tuned to a
 * different industry and mood rather than being five tinted variants of
 * the same look. Picking a theme should change the *feel* of the app,
 * not just its accent color.
 *
 *   Aurora   · default modern SaaS, indigo + mint
 *   Atelier  · editorial paper, ink-on-cream with a clay accent
 *   Meridian · finance + law, deep navy + champagne gold
 *   Cypress  · operations + wellness, olive + bronze on warm sage
 *   Velour   · premium boutique, burgundy + dusty rose on bone
 *
 * Each theme is a complete pair: a light half mirroring the default
 * `:root { ... }` block in globals.css, and a dark half mirroring the
 * `.dark { ... }` block. When the workspace OWNER selects a theme via
 * Settings → Theme, every member's app re-themes; the per-user
 * `ThemeProvider` light/dark toggle picks which half is applied.
 *
 * Format note: HSL values are stored as `"H S% L%"` strings so they
 * can be assigned directly to CSS custom properties Tailwind reads
 * via `hsl(var(--background))`. RGB triplets are stored as `"R G B"`
 * for the legacy `rgb(var(--color-primary) / <alpha-value>)` slots.
 *
 * Adding a theme: add an entry here AND add the same id string to the
 * `_ALLOWED_THEMES` whitelist in
 * `backend/src/contexts/org/handlers/update_settings.py` — that's the
 * canonical wire-format check.
 */

export type ThemeId = 'aurora' | 'atelier' | 'meridian' | 'cypress' | 'velour'

export interface ThemePalette {
  // Shadcn semantic tokens (HSL `"H S% L%"` form)
  background: string
  foreground: string
  card: string
  cardForeground: string
  popover: string
  popoverForeground: string
  secondary: string
  secondaryForeground: string
  muted: string
  mutedForeground: string
  border: string
  input: string
  ring: string

  // Per-tenant brand RGB triplets (`"R G B"` form, no parens)
  primary: string
  primaryFg: string
  accent: string
  accentFg: string

  // Sidebar tokens
  sidebarBackground: string
  sidebarForeground: string
  sidebarHover: string
  sidebarActive: string
  sidebarBorder: string
  sidebarMuted: string

  // Dataviz palette — 8 colors used by charts (bar/pie/area), per-app
  // category dots, and theme markers. Stored as raw hex so SVG/recharts
  // consume them directly without going through `hsl()` / `rgb()` wrappers.
  // Order matters: index 0 is the highest-rank / most-prominent slot
  // (e.g. the top app in App Usage). Tuned per theme so a Velour
  // workspace doesn't have indigo+mint bars in its burgundy chrome.
  dataviz: [string, string, string, string, string, string, string, string]
}

export interface Theme {
  id: ThemeId
  name: string
  description: string
  /** Display swatches for the picker — purely cosmetic, not applied. */
  preview: { primary: string; accent: string; surface: string }
  light: ThemePalette
  dark: ThemePalette
}

// ───────────────────────────────────────────────────────────────────
// 1 · AURORA — modern SaaS, fresh indigo + mint, default for new orgs
// ───────────────────────────────────────────────────────────────────

const AURORA: Theme = {
  id: 'aurora',
  name: 'Aurora',
  description:
    'Crisp indigo + mint. The default — modern SaaS, fits any team.',
  preview: { primary: '#5B5BF1', accent: '#14C088', surface: '#F7F8FB' },
  light: {
    background: '232 32% 98%',
    foreground: '232 38% 12%',
    card: '0 0% 100%',
    cardForeground: '232 38% 12%',
    popover: '0 0% 100%',
    popoverForeground: '232 38% 12%',
    secondary: '232 22% 96%',
    secondaryForeground: '232 24% 22%',
    muted: '232 18% 95%',
    mutedForeground: '232 12% 45%',
    border: '232 16% 91%',
    input: '232 16% 91%',
    ring: '241 83% 65%',
    primary: '91 91 241',
    primaryFg: '255 255 255',
    accent: '20 192 136',
    accentFg: '5 41 28',
    sidebarBackground: '0 0% 100%',
    sidebarForeground: '232 38% 12%',
    sidebarHover: '232 32% 97%',
    sidebarActive: '241 80% 96%',
    sidebarBorder: '232 16% 92%',
    sidebarMuted: '232 12% 52%',
    // Aurora dataviz — bright modern SaaS palette spanning the cool
    // half of the wheel with warm pops for variety.
    dataviz: [
      '#5B5BF1', // indigo (primary)
      '#14C088', // mint (accent)
      '#0EA5E9', // sky
      '#8B5CF6', // violet
      '#F59E0B', // amber
      '#EC4899', // pink
      '#14B8A6', // teal
      '#F43F5E', // rose
    ],
  },
  // Aurora dark — "late night office": cool inky blue with crisp
  // mint accents. Deeper background than v2, sharper card edges, and
  // a 4-tier elevation ladder (bg → sidebar → card → popover) so the
  // surface stack reads at a glance.
  dark: {
    background: '230 32% 5%',
    foreground: '232 22% 96%',
    card: '230 26% 9%',
    cardForeground: '232 22% 96%',
    popover: '230 24% 12%',
    popoverForeground: '232 22% 96%',
    secondary: '230 22% 14%',
    secondaryForeground: '232 18% 90%',
    muted: '230 18% 18%',
    mutedForeground: '232 14% 65%',
    border: '230 22% 22%',
    input: '230 22% 22%',
    ring: '241 90% 72%',
    primary: '149 149 255',
    primaryFg: '18 18 48',
    accent: '64 224 168',
    accentFg: '4 36 24',
    sidebarBackground: '230 32% 7%',
    sidebarForeground: '232 22% 92%',
    sidebarHover: '230 22% 12%',
    sidebarActive: '241 56% 22%',
    sidebarBorder: '230 22% 14%',
    sidebarMuted: '232 14% 60%',
    // Aurora dark dataviz — same hues as light, brightened for dark
    // surfaces (lower saturation drift, higher luminance) so the bars
    // glow against the inky background.
    dataviz: [
      '#8B8BFB', // indigo
      '#34D399', // mint
      '#38BDF8', // sky
      '#A78BFA', // violet
      '#FBBF24', // amber
      '#F472B6', // pink
      '#2DD4BF', // teal
      '#FB7185', // rose
    ],
  },
}

// ───────────────────────────────────────────────────────────────────
// 2 · ATELIER — editorial paper, ink-on-cream with a single clay accent
// ───────────────────────────────────────────────────────────────────

const ATELIER: Theme = {
  id: 'atelier',
  name: 'Atelier',
  description:
    'Ink on cream paper. Editorial — for studios, publishers, design teams.',
  preview: { primary: '#0F0F0F', accent: '#B85534', surface: '#F4EFE6' },
  light: {
    background: '34 30% 94%',
    foreground: '0 0% 8%',
    card: '34 38% 97%',
    cardForeground: '0 0% 8%',
    popover: '34 38% 97%',
    popoverForeground: '0 0% 8%',
    secondary: '34 22% 91%',
    secondaryForeground: '0 0% 14%',
    muted: '34 18% 88%',
    mutedForeground: '20 10% 38%',
    border: '34 16% 84%',
    input: '34 16% 84%',
    ring: '0 0% 18%',
    primary: '15 15 15',
    primaryFg: '244 239 230',
    accent: '184 85 52',
    accentFg: '255 247 240',
    sidebarBackground: '34 36% 96%',
    sidebarForeground: '0 0% 8%',
    sidebarHover: '34 28% 92%',
    sidebarActive: '20 30% 88%',
    sidebarBorder: '34 16% 87%',
    sidebarMuted: '20 10% 42%',
    // Atelier dataviz — earthy editorial: clay primary, ochre, navy
    // ink, brick, sage, dusty rose. Reads like a printed pie chart in
    // a Sunday magazine — desaturated, characterful, anti-rainbow.
    dataviz: [
      '#B85534', // clay (accent)
      '#6B7A4E', // olive
      '#C19A3F', // ochre
      '#2D4060', // ink navy
      '#9B4A3A', // brick
      '#7A8C5C', // sage
      '#3F3F3F', // charcoal
      '#B5817A', // dusty rose
    ],
  },
  // Atelier dark — "darkroom": near-pure black with warm cream
  // foreground (the inverse of the light cream-on-ink relationship).
  // Tiny warm hue in the H slot keeps neutrals from going dead-grey.
  // Primary is a near-white cream — the workspace literally inverts:
  // black surface, cream "ink." Clay accent gets brightened so it
  // glows against the pure-black backdrop.
  dark: {
    background: '30 8% 4%',
    foreground: '34 22% 94%',
    card: '30 8% 8%',
    cardForeground: '34 22% 94%',
    popover: '30 8% 11%',
    popoverForeground: '34 22% 94%',
    secondary: '30 8% 13%',
    secondaryForeground: '34 18% 88%',
    muted: '30 8% 16%',
    mutedForeground: '34 14% 64%',
    border: '30 8% 20%',
    input: '30 8% 20%',
    ring: '34 22% 80%',
    primary: '250 244 234',
    primaryFg: '15 15 12',
    accent: '226 134 92',
    accentFg: '36 14 4',
    sidebarBackground: '30 8% 6%',
    sidebarForeground: '34 22% 92%',
    sidebarHover: '30 8% 12%',
    sidebarActive: '30 8% 16%',
    sidebarBorder: '30 8% 13%',
    sidebarMuted: '34 14% 60%',
    // Atelier dark dataviz — darkroom variant: slightly warmer +
    // brighter so the earthy hues read against near-pure-black.
    dataviz: [
      '#E07A50', // clay
      '#9CB07A', // olive
      '#E2BE5E', // ochre
      '#5C7AA8', // ink navy
      '#C97256', // brick
      '#A8BC82', // sage
      '#8C8C8C', // graphite
      '#D4A8A0', // dusty rose
    ],
  },
}

// ───────────────────────────────────────────────────────────────────
// 3 · MERIDIAN — finance + law, deep navy + champagne gold
// ───────────────────────────────────────────────────────────────────

const MERIDIAN: Theme = {
  id: 'meridian',
  name: 'Meridian',
  description:
    'Deep navy + champagne. Finance, law, professional services.',
  preview: { primary: '#1E3A8A', accent: '#A47E3B', surface: '#F4F6FB' },
  light: {
    background: '220 32% 97%',
    foreground: '224 50% 12%',
    card: '0 0% 100%',
    cardForeground: '224 50% 12%',
    popover: '0 0% 100%',
    popoverForeground: '224 50% 12%',
    secondary: '220 24% 95%',
    secondaryForeground: '224 38% 22%',
    muted: '220 22% 94%',
    mutedForeground: '220 14% 44%',
    border: '220 18% 90%',
    input: '220 18% 90%',
    ring: '226 76% 36%',
    primary: '30 58 138',
    primaryFg: '244 246 251',
    accent: '164 126 59',
    accentFg: '255 247 232',
    // Sidebar matches the surface in light mode — a dark-navy rail
    // looked striking in mockups but clashed with notification badges
    // (red), Sign Out (red), and the active-item pill all stacked on
    // the same panel. Cohesion wins over showpiece.
    sidebarBackground: '0 0% 100%',
    sidebarForeground: '224 50% 12%',
    sidebarHover: '220 32% 97%',
    sidebarActive: '226 70% 95%',
    sidebarBorder: '220 18% 91%',
    sidebarMuted: '220 14% 52%',
    // Meridian dataviz — financial: deep navy + champagne anchored,
    // with cool greys + slate accents. Reads like a Bloomberg ticker
    // chart, not a startup dashboard. No bright greens or pinks.
    dataviz: [
      '#1E3A8A', // deep navy (primary)
      '#A47E3B', // champagne (accent)
      '#475569', // slate
      '#0E7490', // teal
      '#92400E', // deep gold
      '#831843', // burgundy
      '#64748B', // blue-grey
      '#7C3AED', // royal violet
    ],
  },
  // Meridian dark — "trading floor at midnight": deep navy with
  // champagne ticker accents. Background is a true midnight blue
  // (50% saturation, 5% lightness), card layers step up cleanly so
  // every panel reads as elevated material. Champagne accent is
  // brightened to pop like a brass nameplate.
  dark: {
    background: '224 48% 5%',
    foreground: '220 24% 96%',
    card: '224 38% 9%',
    cardForeground: '220 24% 96%',
    popover: '224 36% 12%',
    popoverForeground: '220 24% 96%',
    secondary: '224 30% 14%',
    secondaryForeground: '220 18% 90%',
    muted: '224 26% 17%',
    mutedForeground: '220 14% 66%',
    border: '224 26% 22%',
    input: '224 26% 22%',
    ring: '226 76% 65%',
    primary: '162 188 248',
    primaryFg: '14 24 56',
    accent: '224 184 110',
    accentFg: '38 28 8',
    sidebarBackground: '224 44% 6%',
    sidebarForeground: '220 22% 92%',
    sidebarHover: '224 30% 12%',
    sidebarActive: '226 60% 22%',
    sidebarBorder: '224 30% 14%',
    sidebarMuted: '220 18% 60%',
    // Meridian dark dataviz — midnight: brightened navy/champagne
    // with brass + slate accents that hold against deep midnight.
    dataviz: [
      '#A2BCF8', // navy (primary, brightened)
      '#E0B86E', // champagne (accent, brightened)
      '#94A3B8', // slate
      '#22D3EE', // teal
      '#FBBF24', // gold
      '#F472B6', // burgundy → rose for dark contrast
      '#CBD5E1', // pale slate
      '#A78BFA', // violet
    ],
  },
}

// ───────────────────────────────────────────────────────────────────
// 4 · CYPRESS — operations + wellness, olive green + bronze on sage
// ───────────────────────────────────────────────────────────────────

const CYPRESS: Theme = {
  id: 'cypress',
  name: 'Cypress',
  description:
    'Olive + bronze on sage. Operations, wellness, sustainable brands.',
  preview: { primary: '#3F6B3F', accent: '#A8723F', surface: '#F1F2EB' },
  light: {
    background: '80 18% 95%',
    foreground: '120 22% 11%',
    card: '60 28% 98%',
    cardForeground: '120 22% 11%',
    popover: '60 28% 98%',
    popoverForeground: '120 22% 11%',
    secondary: '80 14% 92%',
    secondaryForeground: '120 18% 18%',
    muted: '80 12% 90%',
    mutedForeground: '95 10% 40%',
    border: '80 12% 86%',
    input: '80 12% 86%',
    ring: '120 32% 32%',
    primary: '63 107 63',
    primaryFg: '244 248 240',
    accent: '168 114 63',
    accentFg: '255 247 232',
    sidebarBackground: '60 28% 98%',
    sidebarForeground: '120 22% 11%',
    sidebarHover: '80 18% 94%',
    sidebarActive: '120 30% 92%',
    sidebarBorder: '80 12% 88%',
    sidebarMuted: '95 10% 44%',
    // Cypress dataviz — natural/wellness: forest greens, bronze,
    // terracotta, olive. Earth tones with a single mustard pop.
    // Looks like a botanical illustration legend.
    dataviz: [
      '#3F6B3F', // forest (primary)
      '#A8723F', // bronze (accent)
      '#7A8C5C', // sage
      '#B85534', // terracotta
      '#B8860B', // mustard
      '#5C7A5C', // muted sage
      '#B87333', // copper
      '#6B7A4E', // olive
    ],
  },
  // Cypress dark — "forest at night": green-tinged charcoal with
  // mossy sage primary and warm bronze accent. Background hue shifts
  // slightly off the light-mode olive into deeper forest territory.
  // Sage primary is brightened so it reads as moonlit leaf rather
  // than dead lichen.
  dark: {
    background: '130 22% 4%',
    foreground: '80 18% 94%',
    card: '130 16% 8%',
    cardForeground: '80 18% 94%',
    popover: '130 14% 11%',
    popoverForeground: '80 18% 94%',
    secondary: '130 12% 13%',
    secondaryForeground: '80 14% 88%',
    muted: '130 10% 16%',
    mutedForeground: '80 10% 62%',
    border: '130 12% 21%',
    input: '130 12% 21%',
    ring: '120 44% 55%',
    primary: '142 204 142',
    primaryFg: '12 32 12',
    accent: '224 162 102',
    accentFg: '38 22 8',
    sidebarBackground: '130 20% 6%',
    sidebarForeground: '80 18% 92%',
    sidebarHover: '130 12% 12%',
    sidebarActive: '120 30% 18%',
    sidebarBorder: '130 12% 14%',
    sidebarMuted: '80 10% 58%',
    // Cypress dark dataviz — moonlit forest: brightened sage +
    // bronze with bone/copper highlights for contrast.
    dataviz: [
      '#86C886', // sage (primary, brightened)
      '#D89868', // bronze (accent, brightened)
      '#A8BC82', // sage
      '#E07A50', // terracotta (brightened)
      '#EAB308', // mustard
      '#94B59C', // moss
      '#E8A878', // copper
      '#A8B07A', // olive
    ],
  },
}

// ───────────────────────────────────────────────────────────────────
// 5 · VELOUR — boutique premium, burgundy + dusty rose on bone
// ───────────────────────────────────────────────────────────────────

const VELOUR: Theme = {
  id: 'velour',
  name: 'Velour',
  description:
    'Burgundy + dusty rose on bone. Boutique, luxury, consulting.',
  preview: { primary: '#7E1E2E', accent: '#C9788C', surface: '#F8F2EE' },
  light: {
    background: '20 30% 96%',
    foreground: '0 30% 14%',
    card: '24 36% 98%',
    cardForeground: '0 30% 14%',
    popover: '24 36% 98%',
    popoverForeground: '0 30% 14%',
    secondary: '20 24% 93%',
    secondaryForeground: '0 24% 22%',
    muted: '20 20% 91%',
    mutedForeground: '0 10% 42%',
    border: '20 16% 87%',
    input: '20 16% 87%',
    ring: '352 60% 30%',
    primary: '126 30 46',
    primaryFg: '255 247 240',
    accent: '201 120 140',
    accentFg: '46 12 24',
    // Sidebar follows the surface tone (bone) instead of a dark
    // burgundy rail — the rail looked beautiful in isolation but the
    // sidebar carries red notification badges + a destructive Sign Out
    // button that already use rose tones, and stacking those on top of
    // a deep wine surface read as a Christmas card. Bone-on-bone reads
    // as one cohesive surface.
    sidebarBackground: '24 36% 98%',
    sidebarForeground: '0 30% 14%',
    sidebarHover: '20 26% 94%',
    sidebarActive: '352 60% 95%',
    sidebarBorder: '20 16% 89%',
    sidebarMuted: '0 10% 50%',
    // Velour dataviz — boutique luxury: burgundy/rose anchored,
    // with plum, gold, mauve. Reads like a Hermès catalogue swatch
    // page — saturated jewel tones, no greens or blues.
    dataviz: [
      '#7E1E2E', // burgundy (primary)
      '#C9788C', // dusty rose (accent)
      '#5B3A64', // plum
      '#B8860B', // antique gold
      '#A0768B', // mauve
      '#5B0F1A', // oxblood
      '#D4A095', // peach pearl
      '#8B5A6B', // rosewood
    ],
  },
  // Velour dark — "velvet wine room": deep aubergine surface with
  // champagne-rose primary and powdery pink accent. Background hue
  // shifts to true purple-wine territory (350° → 345°) so it reads
  // as aubergine rather than oxblood. Primaries brightened to glow
  // like candlelight on velvet.
  dark: {
    background: '345 22% 5%',
    foreground: '22 22% 94%',
    card: '345 18% 9%',
    cardForeground: '22 22% 94%',
    popover: '345 16% 12%',
    popoverForeground: '22 22% 94%',
    secondary: '345 16% 14%',
    secondaryForeground: '22 18% 88%',
    muted: '345 14% 17%',
    mutedForeground: '22 12% 64%',
    border: '345 16% 22%',
    input: '345 16% 22%',
    ring: '350 70% 60%',
    primary: '244 152 172',
    primaryFg: '56 12 24',
    accent: '244 188 204',
    accentFg: '46 12 24',
    sidebarBackground: '345 22% 7%',
    sidebarForeground: '22 22% 92%',
    sidebarHover: '345 16% 13%',
    sidebarActive: '350 36% 22%',
    sidebarBorder: '345 16% 14%',
    sidebarMuted: '22 12% 60%',
    // Velour dark dataviz — candlelight on velvet: brightened rose +
    // champagne with mauve/plum supporting cast.
    dataviz: [
      '#F498AC', // rose (primary, brightened)
      '#F4BCD0', // champagne pink (accent, brightened)
      '#A88AB8', // light plum
      '#EAB308', // gold
      '#C8A1B8', // mauve
      '#E07A8A', // coral wine
      '#F0C8B8', // peach pearl
      '#C8A8B0', // rosewood
    ],
  },
}

export const THEMES: Theme[] = [AURORA, ATELIER, MERIDIAN, CYPRESS, VELOUR]

export const DEFAULT_THEME_ID: ThemeId = 'aurora'

export function getTheme(id: string | null | undefined): Theme {
  // Legacy ids from the v1 catalog map onto the closest replacement so
  // tenants who saved a theme during the early staging window don't see
  // a fallback to default — they get the spiritual successor.
  const aliased =
    id === 'slate'
      ? 'aurora'
      : id === 'graphite'
        ? 'atelier'
        : id === 'sapphire'
          ? 'meridian'
          : id === 'forest'
            ? 'cypress'
            : id === 'claret'
              ? 'velour'
              : id
  return THEMES.find((t) => t.id === aliased) ?? AURORA
}
