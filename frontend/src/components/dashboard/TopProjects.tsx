'use client'

import Link from 'next/link'
import { ArrowUpRight, FolderKanban } from 'lucide-react'
import { Card } from '@/components/ui/Card'
import { Progress } from '@/components/ui/Progress'
import { EmptyState } from '@/components/ui/EmptyState'
import { useProjects } from '@/lib/hooks/useProjects'
import { cn } from '@/lib/utils'

// Project category → identity color. Used for the thin vertical accent
// rule on the left of each row (matches the ProjectHeader convention).
const DOMAIN_RULE: Record<string, string> = {
  DEVELOPMENT: 'bg-indigo-500',
  DESIGNING: 'bg-violet-500',
  MANAGEMENT: 'bg-amber-500',
  RESEARCH: 'bg-teal-500',
}

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
    <Card className="flex flex-col overflow-hidden p-0 shadow-none">
      <div className="flex items-baseline justify-between border-b border-border/60 px-5 py-3">
        <h3 className="text-sm font-medium text-foreground">
          Active projects
        </h3>
        <Link
          href="/projects"
          className="group inline-flex items-center gap-1 text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground transition-colors hover:text-foreground"
        >
          View all
          <ArrowUpRight
            className="h-3 w-3 transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            strokeWidth={1.8}
          />
        </Link>
      </div>

      {sorted.length === 0 ? (
        <div className="p-4">
          <EmptyState
            icon={<FolderKanban strokeWidth={1.4} />}
            title="No projects yet"
            description="Create your first project to see activity here."
            action={
              <Link
                href="/projects"
                className="text-xs font-medium text-foreground/80 hover:text-foreground"
              >
                Create project →
              </Link>
            }
            className="border-0 py-6"
          />
        </div>
      ) : (
        <ul className="divide-y divide-border/50">
          {sorted.map((p) => {
            const total = p.taskCount ?? 0
            const done = p.doneCount ?? 0
            const pct = total > 0 ? Math.round((done / total) * 100) : 0
            const remaining = total - done
            const domain = (p.domain || 'DEVELOPMENT').toUpperCase()
            const ruleColor = DOMAIN_RULE[domain] ?? DOMAIN_RULE.DEVELOPMENT
            const pctColor =
              pct >= 100
                ? 'text-emerald-700'
                : pct >= 50
                  ? 'text-foreground'
                  : 'text-muted-foreground'
            return (
              <li key={p.projectId}>
                <Link
                  href={`/projects/${p.projectId}`}
                  className="group flex items-stretch gap-4 py-3.5 pl-5 pr-5 transition-colors hover:bg-muted/30"
                >
                  {/* Domain accent rule — same convention as ProjectHeader */}
                  <span
                    aria-hidden
                    className={cn('w-[3px] shrink-0 rounded-full', ruleColor)}
                  />
                  <span className="flex w-7 shrink-0 items-center justify-center self-center text-sm font-medium uppercase text-muted-foreground">
                    {p.name.charAt(0)}
                  </span>
                  <div className="min-w-0 flex-1 self-center">
                    <p className="truncate text-sm font-medium text-foreground transition-colors group-hover:underline group-hover:underline-offset-4">
                      {p.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {remaining > 0
                        ? `${remaining} task${remaining === 1 ? '' : 's'} remaining`
                        : 'All tasks done'}
                    </p>
                  </div>
                  <div className="flex w-32 shrink-0 flex-col gap-1.5 self-center">
                    <div className="flex items-baseline justify-between">
                      <span className="text-[10px] font-medium tabular-nums text-muted-foreground">
                        {done}/{total}
                      </span>
                      <span
                        className={cn(
                          'text-xs font-medium tabular-nums',
                          pctColor,
                        )}
                      >
                        {pct}%
                      </span>
                    </div>
                    <Progress value={pct} className="h-[2px]" />
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
