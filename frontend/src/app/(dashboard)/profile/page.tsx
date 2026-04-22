'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import {
  Pencil,
  Calendar,
  Briefcase,
  MapPin,
  Phone,
  GraduationCap,
  Sparkles,
  Heart,
  Sun,
  Moon,
  KeyRound,
  CheckCircle2,
  Globe2,
} from 'lucide-react'
import { useAuth } from '@/lib/auth/AuthProvider'
import { useTheme } from '@/lib/theme/ThemeProvider'
import {
  useUserTimezone,
  detectBrowserTimezone,
  COMMON_TIMEZONES,
} from '@/lib/hooks/useUserTimezone'
import { Select } from '@/components/ui/Select'
import { useMyTasks } from '@/lib/hooks/useUsers'
import { useLiveHours } from '@/lib/hooks/useLiveHours'
import { useProjects } from '@/lib/hooks/useProjects'
import { useMyDayOffs } from '@/lib/hooks/useDayOffs'
import { getProfile, updateProfile } from '@/lib/api/userApi'
import { useToast } from '@/components/ui/Toast'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { Progress } from '@/components/ui/Progress'
import { AvatarUpload } from '@/components/ui/AvatarUpload'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import {
  StatCardsGrid,
  type StatCardItem,
} from '@/components/ui/StatCardsGrid'
import { formatDuration } from '@/lib/utils/formatDuration'
import { ProfileEditDialog } from '@/components/profile/ProfileEditDialog'
import { ChangePasswordDialog } from '@/components/profile/ChangePasswordDialog'
import { DesktopAppCard } from '@/components/profile/DesktopAppCard'
import type { User } from '@/types/user'
import { cn } from '@/lib/utils'

const ROLE_PILL: Record<string, string> = {
  OWNER: 'bg-purple-100 text-purple-700 ring-1 ring-inset ring-purple-200',
  ADMIN: 'bg-red-100 text-red-700 ring-1 ring-inset ring-red-200',
  MEMBER: 'bg-blue-100 text-blue-700 ring-1 ring-inset ring-blue-200',
}

function fmtDate(iso?: string | null) {
  if (!iso) return '—'
  try {
    return new Date(iso + (iso.length <= 10 ? 'T00:00:00' : '')).toLocaleDateString(
      'en-US',
      { month: 'short', day: 'numeric', year: 'numeric' }
    )
  } catch {
    return '—'
  }
}

function getDayOffScore(approvedDates: { startDate: string; endDate: string }[]) {
  const now = new Date()
  const monthStart = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`
  const monthEnd = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-31`
  let daysOff = 0
  for (const d of approvedDates) {
    const start = d.startDate.slice(0, 10)
    const end = d.endDate.slice(0, 10)
    if (start > monthEnd || end < monthStart) continue
    const from = new Date(
      Math.max(new Date(start).getTime(), new Date(monthStart).getTime())
    )
    const to = new Date(
      Math.min(new Date(end).getTime(), new Date(monthEnd).getTime())
    )
    daysOff +=
      Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24)) + 1
  }
  return daysOff === 0 ? 100 : daysOff <= 2 ? 75 : daysOff <= 5 ? 50 : 25
}

export default function ProfilePage() {
  const { user, updateUser } = useAuth()
  const toast = useToast()
  const [profile, setProfile] = useState<User | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [pwOpen, setPwOpen] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    getProfile()
      .then(setProfile)
      .catch(() => {})
  }, [])

  const { data: myTasks } = useMyTasks()
  const { totalHours: liveTodayHours } = useLiveHours()
  const { data: projects } = useProjects()
  const { data: myDayOffs } = useMyDayOffs()

  if (!user) return null
  const dp = profile ?? user
  const isOwner = dp.systemRole === 'OWNER'

  const tasksDone = (myTasks ?? []).filter((t) => t.status === 'DONE').length
  const tasksActive = (myTasks ?? []).length - tasksDone
  const projectCount = (projects ?? []).length

  const approvedDayOffs = (myDayOffs ?? [])
    .filter((d) => d.status === 'APPROVED')
    .map((d) => ({ startDate: d.startDate, endDate: d.endDate }))
  const dayOffScore = getDayOffScore(approvedDayOffs)

  const completenessFields = [
    profile?.name,
    profile?.bio,
    profile?.phone,
    profile?.designation,
    profile?.location,
    profile?.dateOfBirth,
    profile?.collegeName,
    profile?.areaOfInterest,
    profile?.hobby,
    profile?.avatarUrl,
    profile?.skills && profile.skills.length > 0 ? 'yes' : null,
  ]
  const filledCount = completenessFields.filter(Boolean).length
  const completeness = Math.round(
    (filledCount / completenessFields.length) * 100
  )
  const missingInfo = !profile?.dateOfBirth

  const stats: StatCardItem[] = isOwner
    ? []
    : [
        {
          key: 'tasks-done',
          label: 'Tasks done',
          value: tasksDone,
          accent: 'text-emerald-700',
        },
        {
          key: 'active',
          label: 'Active',
          value: tasksActive,
          accent: 'text-blue-700',
        },
        {
          key: 'projects',
          label: 'Projects',
          value: projectCount,
          accent: 'text-indigo-700',
        },
        {
          key: 'today',
          label: 'Today',
          value: formatDuration(liveTodayHours),
          accent: 'text-cyan-700',
        },
      ]

  const handleSaveProfile = async (
    data: Parameters<typeof updateProfile>[0]
  ) => {
    setSaving(true)
    try {
      const updated = await updateProfile(data)
      setProfile(updated)
      if (data.name) updateUser({ name: data.name })
      setEditOpen(false)
      toast.success('Profile updated')
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : 'Failed to update profile'
      )
      throw err
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 animate-fade-in">
      <PageHeader
        title={isOwner ? 'Company Profile' : 'My Profile'}
        description={
          isOwner
            ? 'Manage your company details and preferences'
            : 'Your personal information and account settings'
        }
        actions={
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setEditOpen(true)}
            className="gap-1.5"
          >
            <Pencil className="h-3.5 w-3.5" />
            Edit profile
          </Button>
        }
      />

      {!isOwner && missingInfo && (
        <Alert variant="warning">
          <Sparkles className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between gap-4">
            <span>
              Your profile is incomplete. Add your personal details so the team
              can get to know you.
            </span>
            <Button
              size="sm"
              variant="primary"
              onClick={() => setEditOpen(true)}
            >
              Complete profile
            </Button>
          </AlertDescription>
        </Alert>
      )}

      <Card className="p-6">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
          <AvatarUpload
            currentUrl={profile?.avatarUrl}
            name={dp.name || dp.email}
            size="xl"
            onUpload={async (url) => {
              const updated = await updateProfile({ avatarUrl: url })
              setProfile(updated)
              toast.success('Avatar updated')
            }}
          />

          <div className="min-w-0 flex-1">
            <h2 className="truncate text-2xl font-bold tracking-tight text-foreground">
              {dp.name || dp.email}
            </h2>
            <p className="mt-0.5 flex items-center gap-2 truncate text-sm text-muted-foreground">
              {dp.email}
              <Link
                href="/profile/change-email"
                className="text-[11px] font-semibold text-primary hover:underline"
              >
                Change
              </Link>
              <span className="text-muted-foreground/50">·</span>
              <Link
                href="/profile/mfa"
                className="text-[11px] font-semibold text-primary hover:underline"
              >
                2FA
              </Link>
            </p>

            <div className="mt-2 flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  'inline-flex items-center rounded-md px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                  ROLE_PILL[dp.systemRole] || ROLE_PILL.MEMBER
                )}
              >
                {dp.systemRole}
              </span>
              {!isOwner && profile?.employeeId && (
                <span className="inline-flex items-center rounded-md bg-muted px-2 py-0.5 font-mono text-[10px] font-bold text-muted-foreground ring-1 ring-inset ring-border">
                  {profile.employeeId}
                </span>
              )}
              {dp.createdAt && (
                <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground">
                  <Calendar className="h-3 w-3" />
                  Joined {fmtDate(dp.createdAt)}
                </span>
              )}
            </div>

            {!isOwner && (
              <div className="mt-4">
                <div className="mb-1 flex items-center justify-between text-[11px]">
                  <span className="font-semibold uppercase tracking-widest text-muted-foreground">
                    Profile completeness
                  </span>
                  <span
                    className={cn(
                      'font-bold tabular-nums',
                      completeness >= 100
                        ? 'text-emerald-600'
                        : completeness >= 60
                          ? 'text-primary'
                          : 'text-amber-600'
                    )}
                  >
                    {filledCount}/{completenessFields.length} · {completeness}%
                  </span>
                </div>
                <Progress value={completeness} className="h-1.5" />
              </div>
            )}
          </div>

          {!isOwner && (
            <div
              className={cn(
                'hidden shrink-0 flex-col items-center justify-center rounded-xl border px-4 py-3 sm:flex',
                dayOffScore === 100
                  ? 'border-emerald-200 bg-emerald-50'
                  : dayOffScore >= 75
                    ? 'border-blue-200 bg-blue-50'
                    : dayOffScore >= 50
                      ? 'border-amber-200 bg-amber-50'
                      : 'border-red-200 bg-red-50'
              )}
            >
              <span
                className={cn(
                  'text-2xl font-bold tabular-nums',
                  dayOffScore === 100
                    ? 'text-emerald-700'
                    : dayOffScore >= 75
                      ? 'text-blue-700'
                      : dayOffScore >= 50
                        ? 'text-amber-700'
                        : 'text-red-700'
                )}
              >
                {dayOffScore}
              </span>
              <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                Day-off score
              </span>
            </div>
          )}
        </div>

        {profile?.bio && (
          <div className="mt-5 border-t border-border/60 pt-4">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              About
            </p>
            <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">
              {profile.bio}
            </p>
          </div>
        )}
      </Card>

      {!isOwner && stats.length > 0 && (
        <StatCardsGrid items={stats} columns={4} />
      )}

      {!isOwner && profile && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 stagger-up">
          <Card className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <Briefcase className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-bold text-foreground">
                Contact & work
              </h3>
            </div>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 stagger-up">
              <DetailField
                icon={<Phone className="h-3 w-3" />}
                label="Phone"
                value={profile.phone}
              />
              <DetailField
                icon={<Briefcase className="h-3 w-3" />}
                label="Designation"
                value={profile.designation}
              />
              <DetailField
                icon={<Briefcase className="h-3 w-3" />}
                label="Department"
                value={profile.department}
              />
              <DetailField
                icon={<MapPin className="h-3 w-3" />}
                label="Location"
                value={profile.location}
              />
            </dl>
          </Card>

          <Card className="p-5">
            <div className="mb-4 flex items-center gap-2">
              <GraduationCap className="h-4 w-4 text-muted-foreground" />
              <h3 className="text-sm font-bold text-foreground">Personal</h3>
            </div>
            <dl className="grid grid-cols-1 gap-4 sm:grid-cols-2 stagger-up">
              <DetailField
                icon={<Calendar className="h-3 w-3" />}
                label="Date of birth"
                value={profile.dateOfBirth ? fmtDate(profile.dateOfBirth) : undefined}
              />
              <DetailField
                icon={<GraduationCap className="h-3 w-3" />}
                label="College"
                value={profile.collegeName}
              />
              <DetailField
                icon={<Sparkles className="h-3 w-3" />}
                label="Area of interest"
                value={profile.areaOfInterest}
              />
              <DetailField
                icon={<Heart className="h-3 w-3" />}
                label="Hobby"
                value={profile.hobby}
              />
            </dl>
          </Card>
        </div>
      )}

      {!isOwner && profile?.skills && profile.skills.length > 0 && (
        <Card className="p-5">
          <h3 className="mb-3 text-sm font-bold text-foreground">Skills</h3>
          <div className="flex flex-wrap gap-1.5">
            {profile.skills.map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center rounded-lg bg-primary/10 px-2.5 py-1 text-xs font-semibold text-primary"
              >
                {skill}
              </span>
            ))}
          </div>
        </Card>
      )}

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 stagger-up">
        <ThemeCard />
        <SecurityCard onChangePassword={() => setPwOpen(true)} />
        <TimezoneCard />
      </div>

      <DesktopAppCard />

      {profile && (
        <ProfileEditDialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          profile={profile}
          isOwner={isOwner}
          onSave={handleSaveProfile}
          isSaving={saving}
        />
      )}

      <ChangePasswordDialog
        open={pwOpen}
        onClose={() => setPwOpen(false)}
      />
    </div>
  )
}

function DetailField({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode
  label: string
  value?: string | null
}) {
  return (
    <div>
      <dt className="mb-0.5 flex items-center gap-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
        {icon}
        {label}
      </dt>
      <dd className="text-sm font-medium text-foreground">
        {value || <span className="text-muted-foreground/60">—</span>}
      </dd>
    </div>
  )
}

function ThemeCard() {
  const { theme, setTheme } = useTheme()
  return (
    <Card className="p-5">
      <h3 className="mb-1 text-sm font-bold text-foreground">Appearance</h3>
      <p className="mb-4 text-xs text-muted-foreground">
        Choose your preferred appearance for this device.
      </p>
      <div className="inline-flex rounded-lg border border-border bg-card p-0.5">
        <ThemeButton
          active={theme === 'light'}
          onClick={() => setTheme('light')}
          icon={<Sun className="h-3.5 w-3.5" />}
          label="Light"
        />
        <ThemeButton
          active={theme === 'dark'}
          onClick={() => setTheme('dark')}
          icon={<Moon className="h-3.5 w-3.5" />}
          label="Dark"
        />
      </div>
    </Card>
  )
}

function TimezoneCard() {
  const { timezone, stored, setTimezone } = useUserTimezone()
  const browser = detectBrowserTimezone()

  // Make sure the currently-active tz is always in the dropdown even if
  // it's not in the common list — otherwise the Select renders blank.
  const options = COMMON_TIMEZONES.some((o) => o.value === timezone)
    ? COMMON_TIMEZONES
    : [{ value: timezone, label: timezone }, ...COMMON_TIMEZONES]

  return (
    <Card className="p-5">
      <div className="mb-1 flex items-center gap-1.5">
        <Globe2 className="h-3.5 w-3.5 text-muted-foreground" />
        <h3 className="text-sm font-bold text-foreground">Time zone</h3>
      </div>
      <p className="mb-4 text-xs text-muted-foreground">
        Used to render all absolute-time tooltips and scheduling dialogs for
        this device.
      </p>
      <Select
        value={timezone}
        onChange={(v) => setTimezone(v)}
        options={options}
      />
      <div className="mt-3 flex items-center justify-between text-[11px] text-muted-foreground">
        <span>
          Browser detected: <span className="font-mono">{browser}</span>
        </span>
        {stored && stored !== browser && (
          <button
            type="button"
            onClick={() => setTimezone(null)}
            className="text-primary hover:underline"
          >
            Reset to browser
          </button>
        )}
      </div>
    </Card>
  )
}

function ThemeButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold transition-all',
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground'
      )}
    >
      {icon}
      {label}
    </button>
  )
}

function SecurityCard({
  onChangePassword,
}: {
  onChangePassword: () => void
}) {
  return (
    <Card className="p-5">
      <h3 className="mb-1 text-sm font-bold text-foreground">Security</h3>
      <p className="mb-4 text-xs text-muted-foreground">
        Keep your account secure by changing your password regularly.
      </p>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <KeyRound className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-medium text-foreground">Password</span>
          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />
        </div>
        <Button variant="secondary" size="sm" onClick={onChangePassword}>
          Change password
        </Button>
      </div>
    </Card>
  )
}
