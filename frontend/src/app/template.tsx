import { PageTransition } from '@/components/ui/PageTransition'

/**
 * Root-level template runs on every navigation (distinct from layout,
 * which persists). Wrapping children in <PageTransition> means every
 * route change — public pages and authenticated pages alike — replays
 * the selected CSS page-enter animation. Respects prefers-reduced-motion.
 *
 * To try a different transition feel, swap PAGE_TRANSITION below:
 *   - 'rise'   fade + gentle upward translate (default; deliberate)
 *   - 'fade'   pure opacity — cleanest, least movement
 *   - 'slide'  horizontal sweep from the right (Linear-esque)
 *   - 'scale'  blooms from 96% → 100% (panel-materialising)
 *   - 'blur'   blur ramp + fade (premium / cinematic)
 */
const PAGE_TRANSITION = 'rise' as const

export default function Template({ children }: { children: React.ReactNode }) {
  return <PageTransition variant={PAGE_TRANSITION}>{children}</PageTransition>
}
