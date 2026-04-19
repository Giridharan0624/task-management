'use client'

import { useAuth } from '@/lib/auth/AuthProvider'
import { AttendanceButton } from '@/components/attendance/AttendanceButton'
import { BirthdayBanner } from '@/components/ui/BirthdayBanner'
import { TodayHero } from '@/components/dashboard/TodayHero'
import { TeamPulseStrip } from '@/components/dashboard/TeamPulseStrip'
import { WhoIsWorking } from '@/components/dashboard/WhoIsWorking'
import { TopProjects } from '@/components/dashboard/TopProjects'
import { QuickActions } from '@/components/dashboard/QuickActions'
import { MemberDashboard } from './MemberDashboard'

export default function DashboardPage() {
  const { user } = useAuth()

  if (!user) return null

  const role = user.systemRole

  // Members keep their existing action-first view.
  if (role === 'MEMBER') {
    return <MemberDashboard user={user} />
  }

  // ADMIN and OWNER get the redesigned 5-section layout.
  const dashboardRole: 'OWNER' | 'ADMIN' = role === 'OWNER' ? 'OWNER' : 'ADMIN'

  return (
    <div className="flex w-full max-w-6xl flex-col gap-5 animate-fade-in">
      {/* 1. Today hero — greeting + action CTAs */}
      <TodayHero userName={user.name} role={dashboardRole} />

      {/* ADMIN only: personal timer (OWNER doesn't clock in) */}
      {dashboardRole === 'ADMIN' && <AttendanceButton />}

      {/* 2. Team pulse strip */}
      <TeamPulseStrip role={dashboardRole} />

      {/* 3 + 4. Live attendance + top projects (side-by-side on lg) */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 stagger-up">
        <WhoIsWorking />
        <TopProjects />
      </div>

      {/* 5. Quick actions */}
      <QuickActions role={dashboardRole} />

      {/* Birthday banner — lowest priority, stays at bottom */}
      <BirthdayBanner />
    </div>
  )
}
