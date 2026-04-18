'use client'

import Link from 'next/link'
import { ChevronRight, FolderKanban } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Progress } from '@/components/ui/Progress'
import { EmptyState } from '@/components/ui/EmptyState'
import { useProjects } from '@/lib/hooks/useProjects'
import { getProjectColor } from '@/lib/utils/projectColor'
import { cn } from '@/lib/utils'

export function TopProjects() {
  const { data: projects, isLoading } = useProjects()

  if (isLoading) return null

  const sorted = [...(projects ?? [])]
    .filter((p) => (p.taskCount ?? 0) > 0)
    .sort((a, b) => {
      // Rank by incomplete tasks (most active first)
      const aIncomplete = (a.taskCount ?? 0) - (a.doneCount ?? 0)
      const bIncomplete = (b.taskCount ?? 0) - (b.doneCount ?? 0)
      return bIncomplete - aIncomplete
    })
    .slice(0, 3)

  return (
    <Card className="flex flex-col">
      <div className="flex items-center justify-between border-b border-border px-5 py-3">
        <h3 className="text-sm font-bold text-foreground">Most active projects</h3>
        <Link
          href="/projects"
          className="flex items-center gap-0.5 text-xs font-semibold text-primary hover:text-primary/80"
        >
          View all
          <ChevronRight className="h-3 w-3" />
        </Link>
      </div>

      {sorted.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={<FolderKanban className="h-6 w-6 text-muted-foreground/70" strokeWidth={1.5} />}
            title="No projects yet"
            description="Create your first project to see activity here."
            action={
              <Link
                href="/projects"
                className="text-xs font-semibold text-primary hover:underline"
              >
                Create project →
              </Link>
            }
            className="border-0 py-6"
          />
        </div>
      ) : (
        <ul className="divide-y divide-border/60">
          {sorted.map((p) => {
            const total = p.taskCount ?? 0
            const done = p.doneCount ?? 0
            const pct = total > 0 ? Math.round((done / total) * 100) : 0
            const remaining = total - done
            return (
              <li key={p.projectId}>
                <Link
                  href={`/projects/${p.projectId}`}
                  className="group flex items-center gap-3 px-5 py-3.5 transition-colors hover:bg-muted/30"
                >
                  <div
                    className={cn(
                      'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br text-white shadow-sm',
                      getProjectColor(p.name)
                    )}
                  >
                    <span className="text-sm font-bold">
                      {p.name.charAt(0).toUpperCase()}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground transition-colors group-hover:text-primary">
                      {p.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {remaining > 0
                        ? `${remaining} task${remaining === 1 ? '' : 's'} remaining`
                        : 'All tasks done'}
                    </p>
                  </div>
                  <div className="flex w-28 shrink-0 flex-col gap-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                        {done}/{total}
                      </span>
                      <span
                        className={cn(
                          'text-xs font-bold tabular-nums',
                          pct >= 100
                            ? 'text-emerald-600'
                            : pct >= 50
                              ? 'text-primary'
                              : 'text-amber-600'
                        )}
                      >
                        {pct}%
                      </span>
                    </div>
                    <Progress value={pct} className="h-1.5" />
                  </div>
                </Link>
              </li>
            )
          })}
        </ul>
      )}
    </Card>
  )
}
