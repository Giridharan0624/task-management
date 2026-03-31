'use client'

import { useAuth } from '@/lib/auth/AuthProvider'
import { TimeReportCharts } from '@/components/reports/TimeReportCharts'

export default function ReportsPage() {
  const { user } = useAuth()

  const isPrivileged = user?.systemRole === 'OWNER' || user?.systemRole === 'CEO' || user?.systemRole === 'MD' || user?.systemRole === 'ADMIN'

  if (!isPrivileged) {
    return (
      <div className="flex items-center justify-center h-64">
        <p className="text-gray-400 text-sm">You don&apos;t have permission to view reports.</p>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto">
      <TimeReportCharts
        title="Time Reports"
        subtitle="Hours worked by team members across all projects"
      />
    </div>
  )
}
