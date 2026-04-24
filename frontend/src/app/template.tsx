import { PageTransition } from '@/components/ui/PageTransition'

/**
 * Root-level template runs on every navigation (distinct from layout,
 * which persists). Wrapping children in <PageTransition> means every
 * route change — public pages and authenticated pages alike — replays
 * the selected CSS page-enter animation. Respects prefers-reduced-motion.
 *
 * Variant must be `fade` (opacity only). Any variant that animates
 * `transform`, `filter`, or `perspective` (rise/slide/scale/blur)
 * creates a containing block on this wrapper — which makes the
 * landing page's `position: fixed` LandingHeader anchor to the
 * wrapper instead of the viewport, so the header scrolls with the
 * page. The spec says `transform: none` end-state should release the
 * containing block, but Chrome/WebKit keep the element on its own
 * compositor layer after the animation, so the breakage persists.
 * If you want movement back, render it inside individual sections via
 * the <Reveal> primitive instead of the page-level wrapper.
 */
const PAGE_TRANSITION = 'fade' as const

export default function Template({ children }: { children: React.ReactNode }) {
  return <PageTransition variant={PAGE_TRANSITION}>{children}</PageTransition>
}
