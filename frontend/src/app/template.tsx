import { PageTransition } from '@/components/ui/PageTransition'

/**
 * Root-level template runs on every navigation (distinct from layout,
 * which persists). Wrapping children in <PageTransition> means every
 * route change — public pages and authenticated pages alike — replays
 * the `.page-enter` CSS animation. Respects prefers-reduced-motion.
 */
export default function Template({ children }: { children: React.ReactNode }) {
  return <PageTransition>{children}</PageTransition>
}
