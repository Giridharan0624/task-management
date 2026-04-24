import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * Compact "← Back to Settings" chip placed above each settings
 * sub-page's `<PageHeader>`. The chip itself slides left a touch on
 * hover and the arrow nudges further so the back gesture is felt, not
 * just seen.
 *
 * Target route is `/settings/organization` because the `/settings`
 * route has no index page — only sub-routes (organization, roles,
 * pipelines, plan, audit, webhooks, transfer-ownership, delete-
 * workspace). `organization` is the canonical settings landing.
 */
export function BackToSettings({ className }: { className?: string }) {
  return (
    <Link
      href="/settings/organization"
      className={cn(
        'group inline-flex w-fit items-center gap-1.5 rounded-lg border border-border/60 bg-card px-2.5 py-1.5 text-xs font-semibold text-muted-foreground transition-all hover:-translate-x-0.5 hover:border-foreground/20 hover:bg-muted hover:text-foreground',
        className,
      )}
    >
      <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-0.5" />
      Back to Settings
    </Link>
  )
}
