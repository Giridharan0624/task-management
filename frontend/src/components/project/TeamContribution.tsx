'use client'

import { Card } from '@/components/ui/Card'
import { Progress } from '@/components/ui/Progress'
import { Avatar } from '@/components/ui/AvatarUpload'
import { EmptyState } from '@/components/ui/EmptyState'
import { formatDuration } from '@/lib/utils/formatDuration'
import type { ProjectStatus } from '@/lib/api/projectApi'

interface TeamContributionProps {
  status: ProjectStatus
}

const ROLE_LABELS: Record<string, string> = {
  PROJECT_MANAGER: 'PM',
  TEAM_LEAD: 'Lead',
  ADMIN: 'Admin',
  MEMBER: 'Member',
}

export function TeamContribution({ status }: TeamContributionProps) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="border-b border-border px-5 py-3">
        <h3 className="text-sm font-bold text-foreground">Team contribution</h3>
      </div>
      {status.memberProgress.length === 0 ? (
        <div className="p-4">
          <EmptyState
            title="No members yet"
            description="Invite teammates to the project to track their contribution here."
            className="border-0 py-6"
          />
        </div>
      ) : (
        <ul className="divide-y divide-border/60">
          {status.memberProgress.map((m) => (
            <li
              key={m.userId}
              className="flex items-center gap-4 px-5 py-3.5 transition-colors hover:bg-muted/30"
            >
              <Avatar name={m.name} size="md" />
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex items-center gap-2">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {m.name}
                  </p>
                  <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">
                    {ROLE_LABELS[m.projectRole] || m.projectRole}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Progress
                    value={m.completionPercent}
                    className="h-1.5 max-w-[200px] flex-1"
                  />
                  <span className="text-[10px] font-bold tabular-nums text-primary">
                    {m.completionPercent}%
                  </span>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-xs font-semibold tabular-nums text-foreground">
                  {m.doneTasks}/{m.totalTasks}
                </p>
                <p className="text-[10px] text-muted-foreground">tasks done</p>
              </div>
              {m.trackedHours > 0 && (
                <div className="shrink-0 text-right">
                  <p className="text-xs font-semibold tabular-nums text-foreground">
                    {formatDuration(m.trackedHours)}
                  </p>
                  <p className="text-[10px] text-muted-foreground">tracked</p>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
