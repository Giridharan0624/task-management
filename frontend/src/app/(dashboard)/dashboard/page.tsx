'use client'

import { useAuth } from '@/lib/auth/AuthProvider'
import { AttendanceButton } from '@/components/attendance/AttendanceButton'
import { BirthdayBanner } from '@/components/ui/BirthdayBanner'
import { TodayHero } from '@/components/dashboard/TodayHero'
import { TeamPulseStrip } from '@/components/dashboard/TeamPulseStrip'
import { WhoIsWorking } from '@/components/dashboard/WhoIsWorking'
import { OnLeaveToday } from '@/components/dashboard/OnLeaveToday'
import { TopProjects } from '@/components/dashboard/TopProjects'
import { QuickActions } from '@/components/dashboard/QuickActions'
import { SetupChecklist } from '@/components/dashboard/SetupChecklist'
import { PlanLimitBanner } from '@/components/tenant/PlanLimitBanner'
import { MemberDashboard } from './MemberDashboard'

export default function DashboardPage() {
  const { user } = useAuth()

  if (!user) return null

  const role = user.systemRole

  // Members get the same shell as admin/owner with role-scoped content —
  // TodayHero, TeamPulseStrip, QuickActions all accept role='MEMBER' and
  // render member-appropriate prompts/metrics/actions. Member-specific
  // pieces (daily-update submission, top-5 task list) live below the shell.
  if (role === 'MEMBER') {
    return <MemberDashboard user={user} />
  }

  const dashboardRole: 'OWNER' | 'ADMIN' = role === 'OWNER' ? 'OWNER' : 'ADMIN'

  return (
    <div className="flex w-full max-w-6xl flex-col gap-5 animate-fade-in stagger-up">
      {/* Plan-limit banner — OWNER-only; self-hides when well below caps. */}
      <PlanLimitBanner />

      {/* First-run checklist — hides itself when all steps done or dismissed.
          Owner-only: members/admins don't have permission for every step. */}
      {dashboardRole === 'OWNER' && <SetupChecklist />}

      {/* 1. Today hero — greeting + action CTAs */}
      <TodayHero userName={user.name} role={dashboardRole} />

      {/* ADMIN only: personal timer (OWNER doesn't clock in) */}
      {dashboardRole === 'ADMIN' && <AttendanceButton />}

      {/* 2. Team pulse strip */}
      <TeamPulseStrip role={dashboardRole} />

      {/* 3. Attendance row — who's in vs who's out today. */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 stagger-rise">
        <WhoIsWorking />
        <OnLeaveToday />
      </div>

      {/* 4. Top projects — full width so long project names don't truncate. */}
      <TopProjects />

      {/* 5. Quick actions */}
      <QuickActions role={dashboardRole} />

      {/* Birthday banner — lowest priority, stays at bottom */}
      <BirthdayBanner />
    </div>
  )
}
