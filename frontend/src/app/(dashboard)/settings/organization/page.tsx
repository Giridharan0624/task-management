'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  ChevronRight,
  CheckCircle2,
  ClipboardList,
  KanbanSquare,
  Key,
  RotateCcw,
  ShieldCheck,
  Sparkles,
  Trash2,
  Webhook,
} from 'lucide-react'

import { useAuth } from '@/lib/auth/AuthProvider'
import { useTenant } from '@/lib/tenant/TenantProvider'
import { applyTenantTheme } from '@/lib/tenant/theme'
import { orgsApi, type UpdateSettingsRequest } from '@/lib/api/orgsApi'
import { getProfile, updateProfile } from '@/lib/api/userApi'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { Card } from '@/components/ui/Card'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { useToast } from '@/components/ui/Toast'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/Tabs'
import { ColorField } from '@/components/settings/ColorField'
import { BrandingPreview } from '@/components/settings/BrandingPreview'
import { GlossaryPanel } from '@/components/settings/GlossaryPanel'
import { FeaturesPanel } from '@/components/settings/FeaturesPanel'
import { LocalePanel, type LocaleState } from '@/components/settings/LocalePanel'
import {
  LeaveTypesPanel,
  type LeaveType,
} from '@/components/settings/LeaveTypesPanel'

type Tab = 'branding' | 'terminology' | 'features' | 'locale' | 'leave'

interface BrandingState {
  displayName: string
  primaryColor: string
  accentColor: string
  /** Per-tenant prefix on generated employee IDs. Stored on the owner's
   *  user profile (not org settings), but edited here alongside the other
   *  workspace-identity fields because that's where owners expect it. */
  companyPrefix: string
}

const DEFAULT_LOCALE: LocaleState = {
  timezone: 'Asia/Kolkata',
  locale: 'en-IN',
  currency: 'INR',
  weekStartDay: 1,
  workingHoursStart: '09:00',
  workingHoursEnd: '18:00',
}

const DEFAULT_PRIMARY = '#4F46E5'
const DEFAULT_ACCENT = '#10B981'

function shallowEqual<T extends object>(a: T, b: T): boolean {
  const aKeys = Object.keys(a) as (keyof T)[]
  const bKeys = Object.keys(b) as (keyof T)[]
  if (aKeys.length !== bKeys.length) return false
  for (const k of aKeys) if (a[k] !== b[k]) return false
  return true
}

export default function OrgSettingsPage() {
  const { user } = useAuth()
  const { current, refreshCurrent } = useTenant()
  const router = useRouter()
  const toast = useToast()

  const [tab, setTab] = useState<Tab>('branding')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Per-tab form state — kept separate so we can detect dirty per tab
  const [branding, setBranding] = useState<BrandingState>({
    displayName: '',
    primaryColor: DEFAULT_PRIMARY,
    accentColor: DEFAULT_ACCENT,
    companyPrefix: 'NS',
  })
  const [terminology, setTerminology] = useState<Record<string, string>>({})
  const [features, setFeatures] = useState<Record<string, boolean>>({})
  const [locale, setLocale] = useState<LocaleState>(DEFAULT_LOCALE)
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])

  // Snapshot of last-saved values for dirty checks
  const [savedBranding, setSavedBranding] = useState<BrandingState>(branding)
  const [savedTerminology, setSavedTerminology] = useState<
    Record<string, string>
  >({})
  const [savedFeatures, setSavedFeatures] = useState<Record<string, boolean>>(
    {}
  )
  const [savedLocale, setSavedLocale] = useState<LocaleState>(DEFAULT_LOCALE)
  const [savedLeaveTypes, setSavedLeaveTypes] = useState<LeaveType[]>([])

  // Authz — only OWNER can see this page
  useEffect(() => {
    if (user && user.systemRole !== 'OWNER') {
      router.replace('/dashboard')
    }
  }, [user, router])

  // Hydrate the employee ID prefix from the owner's profile. It lives on
  // the user record rather than on org settings, so we fetch separately.
  useEffect(() => {
    let cancelled = false
    getProfile()
      .then((profile) => {
        if (cancelled) return
        const prefix = profile.companyPrefix || 'NS'
        setBranding((b) => ({ ...b, companyPrefix: prefix }))
        setSavedBranding((b) => ({ ...b, companyPrefix: prefix }))
      })
      .catch(() => {
        // Non-fatal — leave the default 'NS' in place.
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Hydrate form from TenantContext when settings arrive
  useEffect(() => {
    if (!current?.settings) {
      refreshCurrent()
      return
    }
    const s = current.settings
    const initialBranding: BrandingState = {
      displayName: s.displayName ?? '',
      primaryColor: s.primaryColor ?? DEFAULT_PRIMARY,
      accentColor: s.accentColor ?? DEFAULT_ACCENT,
      // companyPrefix is hydrated from the owner's user profile in the
      // effect below — preserve whatever value is already in state.
      companyPrefix: branding.companyPrefix,
    }
    const initialTerminology = s.terminology ?? {}
    const initialFeatures = s.features ?? {}
    const initialLocale: LocaleState = {
      timezone: s.timezone ?? DEFAULT_LOCALE.timezone,
      locale: s.locale ?? DEFAULT_LOCALE.locale,
      currency: s.currency ?? DEFAULT_LOCALE.currency,
      weekStartDay: s.weekStartDay ?? DEFAULT_LOCALE.weekStartDay,
      workingHoursStart:
        s.workingHoursStart ?? DEFAULT_LOCALE.workingHoursStart,
      workingHoursEnd: s.workingHoursEnd ?? DEFAULT_LOCALE.workingHoursEnd,
    }
    const initialLeaveTypes = s.leaveTypes ?? []
    setBranding(initialBranding)
    setTerminology(initialTerminology)
    setFeatures(initialFeatures)
    setLocale(initialLocale)
    setLeaveTypes(initialLeaveTypes)
    setSavedBranding(initialBranding)
    setSavedTerminology(initialTerminology)
    setSavedFeatures(initialFeatures)
    setSavedLocale(initialLocale)
    setSavedLeaveTypes(initialLeaveTypes)
  }, [current, refreshCurrent])

  // Dirty checks
  const brandingDirty = useMemo(
    () => !shallowEqual(branding, savedBranding),
    [branding, savedBranding]
  )
  const terminologyDirty = useMemo(
    () =>
      JSON.stringify(terminology) !== JSON.stringify(savedTerminology),
    [terminology, savedTerminology]
  )
  const featuresDirty = useMemo(
    () => JSON.stringify(features) !== JSON.stringify(savedFeatures),
    [features, savedFeatures]
  )
  const localeDirty = useMemo(
    () => !shallowEqual(locale, savedLocale),
    [locale, savedLocale]
  )
  const leaveTypesDirty = useMemo(
    () => JSON.stringify(leaveTypes) !== JSON.stringify(savedLeaveTypes),
    [leaveTypes, savedLeaveTypes]
  )

  const dirtyForTab =
    tab === 'branding'
      ? brandingDirty
      : tab === 'terminology'
        ? terminologyDirty
        : tab === 'features'
          ? featuresDirty
          : tab === 'locale'
            ? localeDirty
            : leaveTypesDirty

  const onSave = async () => {
    setSaving(true)
    setError(null)
    try {
      let payload: UpdateSettingsRequest = {}
      if (tab === 'branding') {
        payload = {
          displayName: branding.displayName,
          // Logo / favicon are intentionally omitted — feature removed from
          // the UI. Leaving them out of the payload preserves any legacy
          // values the backend may still hold for this tenant.
          primaryColor: branding.primaryColor,
          accentColor: branding.accentColor,
        }
        // Prefix lives on the owner's user profile. Only send a profile
        // update when the value actually changed, so we don't churn the
        // profile record on every branding save.
        if (branding.companyPrefix !== savedBranding.companyPrefix) {
          const normalized = branding.companyPrefix.trim().toUpperCase()
          if (normalized) {
            await updateProfile({ companyPrefix: normalized })
          }
        }
      } else if (tab === 'terminology') {
        payload = { terminology }
      } else if (tab === 'features') {
        payload = { features }
      } else if (tab === 'locale') {
        payload = {
          timezone: locale.timezone,
          locale: locale.locale,
          currency: locale.currency,
          weekStartDay: locale.weekStartDay,
          workingHoursStart: locale.workingHoursStart,
          workingHoursEnd: locale.workingHoursEnd,
        }
      } else {
        payload = { leaveTypes }
      }

      await orgsApi.updateSettings(payload)
      await refreshCurrent()

      // Sync the saved snapshot for the tab we just persisted
      if (tab === 'branding') setSavedBranding(branding)
      else if (tab === 'terminology') setSavedTerminology(terminology)
      else if (tab === 'features') setSavedFeatures(features)
      else if (tab === 'locale') setSavedLocale(locale)
      else setSavedLeaveTypes(leaveTypes)

      // Re-apply theme immediately when colors change
      if (payload.primaryColor || payload.accentColor) {
        applyTenantTheme(
          payload.primaryColor ?? branding.primaryColor,
          payload.accentColor ?? branding.accentColor
        )
      }
      toast.success('Settings saved')
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Failed to save'
      setError(msg)
      toast.error(msg)
    } finally {
      setSaving(false)
    }
  }

  const onDiscard = () => {
    if (tab === 'branding') setBranding(savedBranding)
    else if (tab === 'terminology') setTerminology(savedTerminology)
    else if (tab === 'features') setFeatures(savedFeatures)
    else if (tab === 'locale') setLocale(savedLocale)
    else setLeaveTypes(savedLeaveTypes)
    setError(null)
  }

  if (!user) return null
  if (user.systemRole !== 'OWNER') return null

  // Hold the form back until the tenant settings finish loading. Without
  // this, every controlled input renders empty for the first paint, and
  // browsers pop their autofill suggestion the moment a user focuses a
  // field — making it look like the saved data is missing when in fact
  // the API just hadn't responded yet.
  if (!current?.settings) {
    return (
      <div className="mx-auto flex h-64 w-full max-w-4xl items-center justify-center">
        <Spinner />
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 pb-24 animate-fade-in">
      <PageHeader
        title="Organization settings"
        description="These changes apply to everyone in your workspace."
      />

      {/* Admin areas — pages too rich for a single tab live behind these
          links. Add more entries here as new admin domains land
          (pipelines, plans, audit log, etc.). */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <AdminLink
          href="/settings/roles"
          icon={ShieldCheck}
          title="Roles & permissions"
          subtitle="Define who can do what."
        />
        <AdminLink
          href="/settings/pipelines"
          icon={KanbanSquare}
          title="Task pipelines"
          subtitle="Custom task workflows + colors."
        />
        <AdminLink
          href="/settings/plan"
          icon={Sparkles}
          title="Plan & usage"
          subtitle="Seats, projects, retention."
        />
        <AdminLink
          href="/settings/audit"
          icon={ClipboardList}
          title="Audit log"
          subtitle="Who changed what, when."
        />
        <AdminLink
          href="/settings/webhooks"
          icon={Webhook}
          title="Webhooks"
          subtitle="HMAC-signed event delivery to your endpoints."
        />
        <AdminLink
          href="/settings/transfer-ownership"
          icon={Key}
          title="Transfer ownership"
          subtitle="Hand off OWNER to another member."
          danger
        />
        <AdminLink
          href="/settings/delete-workspace"
          icon={Trash2}
          title="Delete workspace"
          subtitle="Schedule permanent deletion or export data."
          danger
        />
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as Tab)}>
        <TabsList>
          <TabsTrigger value="branding" className="gap-2">
            Branding
            {brandingDirty && <DirtyDot />}
          </TabsTrigger>
          <TabsTrigger value="terminology" className="gap-2">
            Terminology
            {terminologyDirty && <DirtyDot />}
          </TabsTrigger>
          <TabsTrigger value="features" className="gap-2">
            Features
            {featuresDirty && <DirtyDot />}
          </TabsTrigger>
          <TabsTrigger value="locale" className="gap-2">
            Locale
            {localeDirty && <DirtyDot />}
          </TabsTrigger>
          <TabsTrigger value="leave" className="gap-2">
            Leave types
            {leaveTypesDirty && <DirtyDot />}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="branding" className="mt-4">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Card className="space-y-5 p-5">
              <Input
                label="Display name"
                type="text"
                // autoComplete=off so Chrome doesn't pop a suggestion that
                // visually overrides the actual saved value.
                autoComplete="off"
                value={branding.displayName}
                onChange={(e) =>
                  setBranding((b) => ({ ...b, displayName: e.target.value }))
                }
                placeholder="Acme Inc"
              />
              <Input
                label="Employee ID prefix"
                type="text"
                autoComplete="off"
                value={branding.companyPrefix}
                onChange={(e) =>
                  setBranding((b) => ({
                    ...b,
                    companyPrefix: e.target.value
                      .toUpperCase()
                      .replace(/[^A-Z0-9]/g, '')
                      .slice(0, 6),
                  }))
                }
                placeholder="NS"
                className="font-mono uppercase"
                hint="Used at the start of every generated employee ID."
              />
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <ColorField
                  label="Primary color"
                  value={branding.primaryColor}
                  onChange={(v) =>
                    setBranding((b) => ({ ...b, primaryColor: v }))
                  }
                  hint="Buttons, links, focus rings."
                />
                <ColorField
                  label="Accent color"
                  value={branding.accentColor}
                  onChange={(v) =>
                    setBranding((b) => ({ ...b, accentColor: v }))
                  }
                  hint="Status pills, success states."
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() =>
                  setBranding((b) => ({
                    ...b,
                    primaryColor: DEFAULT_PRIMARY,
                    accentColor: DEFAULT_ACCENT,
                  }))
                }
                className="gap-1.5 text-muted-foreground"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset colors to defaults
              </Button>
            </Card>

            <BrandingPreview
              primaryColor={branding.primaryColor}
              accentColor={branding.accentColor}
              displayName={branding.displayName}
            />
          </div>
        </TabsContent>

        <TabsContent value="terminology" className="mt-4">
          <GlossaryPanel value={terminology} onChange={setTerminology} />
        </TabsContent>

        <TabsContent value="features" className="mt-4">
          <FeaturesPanel value={features} onChange={setFeatures} />
        </TabsContent>

        <TabsContent value="locale" className="mt-4">
          <LocalePanel value={locale} onChange={setLocale} />
        </TabsContent>

        <TabsContent value="leave" className="mt-4">
          <LeaveTypesPanel value={leaveTypes} onChange={setLeaveTypes} />
        </TabsContent>
      </Tabs>

      {/* Sticky save bar — only renders when the active tab has unsaved changes */}
      {dirtyForTab && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 px-4 py-3 shadow-elevated backdrop-blur-md animate-in slide-in-from-bottom-2 fade-in">
          <div className="mx-auto flex max-w-4xl items-center justify-between gap-3">
            <div className="flex items-center gap-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-amber-500" />
              <span className="font-medium text-foreground">
                You have unsaved changes
              </span>
              <span className="hidden text-xs text-muted-foreground sm:inline">
                in{' '}
                {tab === 'branding'
                  ? 'Branding'
                  : tab === 'terminology'
                    ? 'Terminology'
                    : tab === 'features'
                      ? 'Features'
                      : tab === 'locale'
                        ? 'Locale'
                        : 'Leave types'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="secondary" size="sm" onClick={onDiscard}>
                Discard
              </Button>
              <Button onClick={onSave} loading={saving} size="sm">
                Save changes
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function DirtyDot() {
  return (
    <span
      className="inline-block h-1.5 w-1.5 rounded-full bg-amber-500"
      aria-label="unsaved changes"
    />
  )
}

function AdminLink({
  href,
  icon: Icon,
  title,
  subtitle,
  danger = false,
}: {
  href: string
  icon: typeof ShieldCheck
  title: string
  subtitle: string
  danger?: boolean
}) {
  return (
    <Link
      href={href}
      className={
        danger
          ? 'group flex items-center gap-3 rounded-xl border border-destructive/30 bg-destructive/[0.03] p-3.5 transition-all hover:-translate-y-0.5 hover:border-destructive/60 hover:shadow-card-hover'
          : 'group flex items-center gap-3 rounded-xl border border-border bg-card p-3.5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-card-hover'
      }
    >
      <div
        className={
          danger
            ? 'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-destructive/10 text-destructive'
            : 'flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary'
        }
      >
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-foreground">{title}</p>
        <p className="text-xs text-muted-foreground">{subtitle}</p>
      </div>
      <ChevronRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-foreground" />
    </Link>
  )
}
