'use client'

import { useState, useMemo } from 'react'
import { useActivityReport, useSummary, useGenerateSummary } from '@/lib/hooks/useActivity'
import { useUsers } from '@/lib/hooks/useUsers'
import { Spinner } from '@/components/ui/Spinner'
import { FilterSelect } from '@/components/ui/FilterSelect'
import { formatDuration } from '@/lib/utils/formatDuration'
import { ScreenshotGallery } from './ScreenshotGallery'
import type { UserActivity, DailySummary } from '@/lib/api/activityApi'
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts'

const COLORS = [
  '#6366f1', '#8b5cf6', '#a78bfa', '#c084fc',
  '#34d399', '#2dd4bf', '#38bdf8', '#f97316',
  '#f472b6', '#fb7185', '#facc15', '#818cf8',
]

export function ActivityReport() {
  const [date, setDate] = useState(() => {
    const d = new Date()
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })
  const [selectedUser, setSelectedUser] = useState('')

  const { data: activities, isLoading } = useActivityReport(date, date)
  const { data: users } = useUsers()

  const filteredActivities = useMemo(() => {
    if (!activities) return []
    if (selectedUser) return activities.filter(a => a.userId === selectedUser)
    return activities
  }, [activities, selectedUser])

  const userOptions = useMemo(() => {
    return (users ?? []).map(u => ({ value: u.userId, label: u.name }))
  }, [users])

  // Navigate dates
  function toLocalDateStr(d: Date) {
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }
  const prevDate = () => {
    const d = new Date(date + 'T12:00:00') // Noon avoids DST/timezone edge cases
    d.setDate(d.getDate() - 1)
    setDate(toLocalDateStr(d))
  }
  const nextDate = () => {
    const d = new Date(date + 'T12:00:00')
    d.setDate(d.getDate() + 1)
    setDate(toLocalDateStr(d))
  }
  const today = toLocalDateStr(new Date())
  const dateLabel = new Date(date + 'T00:00:00').toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'short', year: 'numeric',
  })

  return (
    <div className="space-y-5">
      {/* Controls */}
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          <button onClick={prevDate} className="px-2 py-1 rounded-lg border border-border/80 dark:border-gray-700 text-muted-foreground dark:text-muted-foreground/50 hover:bg-muted/40 dark:hover:bg-gray-800 text-sm">←</button>
          <span className="text-sm font-medium text-foreground/85 dark:text-gray-200">{dateLabel}</span>
          <button onClick={nextDate} disabled={date >= today} className="px-2 py-1 rounded-lg border border-border/80 dark:border-gray-700 text-muted-foreground dark:text-muted-foreground/50 hover:bg-muted/40 dark:hover:bg-gray-800 text-sm disabled:opacity-30">→</button>
        </div>
        <FilterSelect
          value={selectedUser}
          onChange={setSelectedUser}
          options={[{ value: '', label: 'All Members' }, ...userOptions]}
          placeholder="Filter by member"
          className="w-48"
        />
      </div>

      {isLoading && (
        <div className="flex justify-center py-12"><Spinner /></div>
      )}

      {!isLoading && filteredActivities.length === 0 && (
        <div className="text-center py-12 text-muted-foreground/70 dark:text-muted-foreground text-sm">
          No activity data for this date
        </div>
      )}

      {/* User cards */}
      {filteredActivities.map(activity => {
        const userInfo = (users ?? []).find(u => u.userId === activity.userId)
        return <ActivityCard key={activity.userId} activity={activity} date={date} userInfo={userInfo} />
      })}
    </div>
  )
}

/* ═══ Per-user activity card ═══ */
function ActivityCard({ activity, date, userInfo }: { activity: UserActivity; date: string; userInfo?: any }) {
  const { data: summary } = useSummary(activity.userId, date)
  const generateMutation = useGenerateSummary()

  const scorePercent = Math.round(activity.activityScore * 100)

  // Total keyboard + mouse from all buckets
  const totalKeyboard = useMemo(() => activity.buckets.reduce((s, b) => s + (b.keyboardCount || 0), 0), [activity.buckets])
  const totalMouse = useMemo(() => activity.buckets.reduce((s, b) => s + (b.mouseCount || 0), 0), [activity.buckets])

  // App usage for charts
  const appData = useMemo(() => {
    return Object.entries(activity.appUsage)
      .map(([name, seconds]) => ({ name, hours: Math.round(seconds / 36) / 100 }))
      .sort((a, b) => b.hours - a.hours)
      .slice(0, 8)
  }, [activity.appUsage])

  const handleGenerate = () => {
    generateMutation.mutate({ userId: activity.userId, date })
  }

  const [expanded, setExpanded] = useState(false)

  return (
    <div className="rounded-2xl border border-border dark:border-gray-800 bg-card dark:bg-[var(--color-surface)] shadow-sm overflow-hidden">
      {/* Header — click to expand/collapse */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-muted/30 dark:hover:bg-gray-800/30 transition-colors text-left"
      >
        <div className="flex items-center gap-3">
          <svg className={`w-4 h-4 text-muted-foreground/70 transition-transform flex-shrink-0 ${expanded ? 'rotate-90' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
          {userInfo?.avatarUrl ? (
            <img src={userInfo.avatarUrl} alt={activity.userName} className="w-9 h-9 rounded-xl object-cover flex-shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center flex-shrink-0">
              <span className="text-white text-sm font-bold">{(activity.userName || '?').charAt(0).toUpperCase()}</span>
            </div>
          )}
          <div>
            <p className="text-[14px] font-bold text-foreground dark:text-gray-100">{activity.userName || 'User'}</p>
            <p className="text-[11px] text-muted-foreground/70">
              {userInfo?.employeeId && <span className="font-medium text-indigo-600 dark:text-indigo-400">{userInfo.employeeId}</span>}
              {userInfo?.employeeId && ' · '}
              {activity.userEmail}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <StatBadge label="Active" value={formatDuration(activity.totalActiveMinutes / 60)} color="emerald" />
          <StatBadge label="Idle" value={formatDuration(activity.totalIdleMinutes / 60)} color="amber" />
          <StatBadge label="Score" value={`${scorePercent}%`} color={scorePercent >= 70 ? 'emerald' : scorePercent >= 40 ? 'amber' : 'red'} />
          <StatBadge label="Keyboard" value={totalKeyboard.toLocaleString()} color="indigo" />
          <StatBadge label="Mouse" value={totalMouse.toLocaleString()} color="indigo" />
          <StatBadge label="Buckets" value={String(activity.bucketCount)} color="indigo" />
        </div>
      </button>

      {!expanded && <div className="h-0" />}

      {/* Expandable content */}
      {expanded && appData.length > 0 && (
        <div className="px-5 py-4 grid grid-cols-2 gap-4 border-b border-border/50 dark:border-gray-800 stagger-up">
          {/* Bar chart — hours by app */}
          <div>
            <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest mb-2">App Usage (hours)</p>
            <ResponsiveContainer width="100%" height={Math.max(160, appData.length * 36)}>
              <BarChart data={appData} layout="vertical" margin={{ left: 10, right: 10, top: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,0,0,0.05)" />
                <XAxis type="number" tick={{ fontSize: 10 }} />
                <YAxis dataKey="name" type="category" tick={{ fontSize: 10 }} width={110} />
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} />
                <Bar dataKey="hours" radius={[0, 4, 4, 0]}>
                  {appData.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Pie chart — active vs idle */}
          <div>
            <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest mb-2">Active vs Idle</p>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={[
                    { name: 'Active', value: Math.round(activity.totalActiveMinutes) },
                    { name: 'Idle', value: Math.round(activity.totalIdleMinutes) },
                  ]}
                  cx="50%" cy="50%"
                  innerRadius={35} outerRadius={60}
                  paddingAngle={4}
                  dataKey="value"
                >
                  <Cell fill="#34d399" />
                  <Cell fill="#fbbf24" />
                </Pie>
                <Tooltip contentStyle={{ fontSize: 11, borderRadius: 8 }} formatter={(v) => `${v}m`} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex justify-center gap-4 text-[10px] -mt-2">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-400" /> Active {Math.round(activity.totalActiveMinutes)}m</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-400" /> Idle {Math.round(activity.totalIdleMinutes)}m</span>
            </div>
          </div>
        </div>
      )}

      {/* Screenshots timeline */}
      {expanded && activity.screenshots && activity.screenshots.length > 0 && (
        <ScreenshotGallery screenshots={activity.screenshots} />
      )}

      {/* AI Summary */}
      {expanded && <div className="px-5 py-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-[10px] font-bold text-muted-foreground/70 uppercase tracking-widest">AI Work Summary</p>
          <button
            onClick={handleGenerate}
            disabled={generateMutation.isPending}
            className="text-[11px] font-medium text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 disabled:opacity-50"
          >
            {generateMutation.isPending ? 'Generating...' : summary ? 'Regenerate' : 'Generate Summary'}
          </button>
        </div>

        {summary ? (
          <SummaryDisplay summary={summary} />
        ) : (
          <p className="text-[12px] text-muted-foreground/70 italic">
            {generateMutation.isPending
              ? 'AI is analyzing activity data...'
              : 'Click "Generate Summary" to get an AI analysis of this work session.'}
          </p>
        )}

        {generateMutation.error && (
          <p className="text-[11px] text-red-500 mt-2">
            {generateMutation.error instanceof Error ? generateMutation.error.message : 'Failed to generate summary'}
          </p>
        )}
      </div>}
    </div>
  )
}

/* ═══ AI Summary display ═══ */
function SummaryDisplay({ summary }: { summary: DailySummary }) {
  return (
    <div className="space-y-3">
      <p className="text-[13px] text-foreground/85 dark:text-gray-200 leading-relaxed">{summary.summary}</p>

      {summary.keyActivities.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {summary.keyActivities.map((a, i) => (
            <span key={i} className="px-2 py-0.5 rounded-full bg-indigo-50 dark:bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 text-[10px] font-medium">
              {a}
            </span>
          ))}
        </div>
      )}

      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] text-muted-foreground/70">Productivity:</span>
          <div className="flex gap-0.5">
            {Array.from({ length: 10 }).map((_, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-sm ${
                  i < summary.productivityScore
                    ? summary.productivityScore >= 7
                      ? 'bg-emerald-500'
                      : summary.productivityScore >= 4
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                    : 'bg-muted dark:bg-gray-700'
                }`}
              />
            ))}
          </div>
          <span className="text-[11px] font-bold text-foreground/85 dark:text-gray-200">{summary.productivityScore}/10</span>
        </div>

        <span className="text-[10px] text-muted-foreground/70">
          Generated {new Date(summary.generatedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
        </span>
      </div>

      {summary.concerns.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {summary.concerns.map((c, i) => (
            <span key={i} className="px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-500/10 text-amber-700 dark:text-amber-300 text-[10px] font-medium">
              ⚠ {c}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}

/* ScreenshotGallery lives in ./ScreenshotGallery.tsx — shared with
   the /dev/screenshots sample harness so both consumers get the same
   prev/next + timestamp-overlay behaviour from one code path. */

/* ═══ Stat badge ═══ */
function StatBadge({ label, value, color }: { label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300',
    amber: 'bg-amber-50 text-amber-700 dark:bg-amber-500/10 dark:text-amber-300',
    red: 'bg-red-50 text-red-700 dark:bg-red-500/10 dark:text-red-300',
    indigo: 'bg-indigo-50 text-indigo-700 dark:bg-indigo-500/10 dark:text-indigo-300',
  }

  return (
    <div className="text-center">
      <p className={`text-[13px] font-bold tabular-nums ${colors[color]?.split(' ').filter(c => c.startsWith('text-')).join(' ') || 'text-foreground/85'}`}>{value}</p>
      <p className="text-[9px] text-muted-foreground/70 uppercase tracking-wider">{label}</p>
    </div>
  )
}
