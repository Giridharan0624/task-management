import type { Metadata } from 'next'
import { SettingsNav } from '@/components/settings/SettingsNav'

export const metadata: Metadata = {
  title: 'Settings',
}

/**
 * Unified Settings shell. Wraps every /settings/* sub-route with a
 * persistent left-rail nav so admins can move between General, Roles,
 * Pipelines, Plan, Audit, Webhooks, and the danger zone (Transfer /
 * Delete) without bouncing back to a hub page.
 *
 * Pre-Session-9 organization settings had Tabs for some surfaces
 * (Branding/Features/Locale/Leave) and link cards for the rest
 * (Roles/Pipelines/Plan/Audit/Webhooks/Transfer/Delete). Mixed
 * paradigm — admins couldn't predict where to click. This layout
 * collapses everything into one IA: every settings surface is a
 * left-nav entry; `/settings/organization` keeps its inner tabs for
 * the General sub-areas.
 */
export default function SettingsLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-6 lg:flex-row lg:gap-8">
      <SettingsNav />
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  )
}
