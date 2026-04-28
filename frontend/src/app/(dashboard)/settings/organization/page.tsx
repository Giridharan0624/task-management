'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2 } from 'lucide-react'

import { useAuth } from '@/lib/auth/AuthProvider'
import { useTenant } from '@/lib/tenant/TenantProvider'
import { applyTenantFont } from '@/lib/tenant/fonts'
import { applyThemePreset } from '@/lib/tenant/theme'
import { DEFAULT_THEME_ID, type ThemeId } from '@/lib/tenant/themes'
import { orgsApi, type UpdateSettingsRequest } from '@/lib/api/orgsApi'
import { getProfile, updateProfile } from '@/lib/api/userApi'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Spinner } from '@/components/ui/Spinner'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { useToast } from '@/components/ui/Toast'
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@/components/ui/Tabs'
import { FontPicker } from '@/components/settings/FontPicker'
import { GlossaryPanel } from '@/components/settings/GlossaryPanel'
import { FeaturesPanel } from '@/components/settings/FeaturesPanel'
import { LocalePanel, type LocaleState } from '@/components/settings/LocalePanel'
import {
  LeaveTypesPanel,
  type LeaveType,
} from '@/components/settings/LeaveTypesPanel'
import {
  DepartmentsPanel,
  DEFAULT_DEPARTMENTS,
} from '@/components/settings/DepartmentsPanel'
import { ThemePicker } from '@/components/settings/ThemePicker'

type Tab =
  | 'branding'
  | 'theme'
  | 'terminology'
  | 'features'
  | 'locale'
  | 'leave'
  | 'departments'

interface BrandingState {
  displayName: string
  /** Curated font id (or null = app default Outfit). See
   *  frontend/src/lib/tenant/fonts.ts for the catalog. */
  fontFamily: string | null
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
    fontFamily: null,
    companyPrefix: 'NS',
  })
  const [terminology, setTerminology] = useState<Record<string, string>>({})
  const [features, setFeatures] = useState<Record<string, boolean>>({})
  const [locale, setLocale] = useState<LocaleState>(DEFAULT_LOCALE)
  const [leaveTypes, setLeaveTypes] = useState<LeaveType[]>([])
  const [departments, setDepartments] = useState<string[]>([])
  const [theme, setTheme] = useState<ThemeId>(DEFAULT_THEME_ID)

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
  const [savedDepartments, setSavedDepartments] = useState<string[]>([])
  const [savedTheme, setSavedTheme] = useState<ThemeId>(DEFAULT_THEME_ID)

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
      fontFamily: s.fontFamily ?? null,
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
    // Legacy tenants saved before the `departments` field shipped read
    // back as `null` / undefined here. Seed from the canonical default
    // list so the panel renders a starting point instead of an empty
    // shell — owner can prune or restore from there.
    const initialDepartments =
      s.departments && s.departments.length > 0
        ? s.departments
        : [...DEFAULT_DEPARTMENTS]
    const initialTheme = (s.theme as ThemeId) || DEFAULT_THEME_ID
    setBranding(initialBranding)
    setTerminology(initialTerminology)
    setFeatures(initialFeatures)
    setLocale(initialLocale)
    setLeaveTypes(initialLeaveTypes)
    setDepartments(initialDepartments)
    setTheme(initialTheme)
    setSavedBranding(initialBranding)
    setSavedTerminology(initialTerminology)
    setSavedFeatures(initialFeatures)
    setSavedLocale(initialLocale)
    setSavedLeaveTypes(initialLeaveTypes)
    setSavedDepartments(initialDepartments)
    setSavedTheme(initialTheme)
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
  const departmentsDirty = useMemo(
    () => JSON.stringify(departments) !== JSON.stringify(savedDepartments),
    [departments, savedDepartments]
  )
  const themeDirty = theme !== savedTheme

  const dirtyForTab =
    tab === 'branding'
      ? brandingDirty
      : tab === 'theme'
        ? themeDirty
        : tab === 'terminology'
          ? terminologyDirty
          : tab === 'features'
            ? featuresDirty
            : tab === 'locale'
              ? localeDirty
              : tab === 'leave'
                ? leaveTypesDirty
                : departmentsDirty

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
          //
          // Colors are owned by the Theme tab now and are NOT sent here,
          // so a Branding-tab save can't override the active theme preset.
          fontFamily: branding.fontFamily,
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
      } else if (tab === 'leave') {
        payload = { leaveTypes }
      } else if (tab === 'theme') {
        payload = { theme }
      } else {
        payload = { departments }
      }

      await orgsApi.updateSettings(payload)
      await refreshCurrent()

      // Sync the saved snapshot for the tab we just persisted
      if (tab === 'branding') setSavedBranding(branding)
      else if (tab === 'terminology') setSavedTerminology(terminology)
      else if (tab === 'features') setSavedFeatures(features)
      else if (tab === 'locale') setSavedLocale(locale)
      else if (tab === 'leave') setSavedLeaveTypes(leaveTypes)
      else if (tab === 'theme') setSavedTheme(theme)
      else setSavedDepartments(departments)

      // Re-apply font on save so the active session reflects the new
      // typeface without a reload. `payload.fontFamily` may be null
      // (user picked the default) — applyTenantFont handles that.
      if ('fontFamily' in payload) {
        applyTenantFont(payload.fontFamily ?? null)
      }
      // Theme follows the same pattern: the picker no longer applies
      // on click, so this is the moment the workspace actually
      // re-themes. TenantProvider would also re-apply on next refresh,
      // but doing it inline here is instant — no flash of the old
      // palette while we wait for /orgs/current to round-trip.
      if ('theme' in payload && payload.theme) {
        applyThemePreset(payload.theme)
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
    else if (tab === 'leave') setLeaveTypes(savedLeaveTypes)
    else if (tab === 'theme') setTheme(savedTheme)
    else setDepartments(savedDepartments)
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
        title="General"
        description="Branding, terminology, locale, features, and leave types. Other admin surfaces (Roles, Pipelines, Plan, Audit, Webhooks, Transfer, Delete) are in the left-rail nav."
      />

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
          <TabsTrigger value="theme" className="gap-2">
            Theme
            {themeDirty && <DirtyDot />}
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
          <TabsTrigger value="departments" className="gap-2">
            Departments
            {departmentsDirty && <DirtyDot />}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="branding" className="mt-4 space-y-10">
          {/* ─── Identity ──────────────────────────────────────
              Two stacked inputs at full content width — no card
              chrome, hairline divider above the typography block
              below. The previous 2-col layout left a dead right
              half after BrandingPreview was retired; this version
              reflows the surface so it doesn't look unfinished. */}
          <section className="flex flex-col gap-5">
            <header className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                Identity
              </h2>
              <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                The workspace name and employee-ID prefix members see
                across the app and in their generated IDs.
              </p>
            </header>

            <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
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
            </div>

          </section>

          {/* ─── Typography ────────────────────────────────────
              Hairline divider separates the section above; the
              FontPicker takes care of its own card grid. */}
          <section className="flex flex-col gap-5 border-t border-border/60 pt-8">
            <header className="flex flex-col gap-1">
              <h2 className="text-lg font-semibold tracking-tight text-foreground">
                Typography
              </h2>
              <p className="max-w-prose text-sm leading-relaxed text-muted-foreground">
                Pick a typeface for the whole workspace. Members see
                the change on their next page load.
              </p>
            </header>
            <FontPicker
              value={branding.fontFamily}
              onChange={(next) =>
                setBranding((b) => ({ ...b, fontFamily: next }))
              }
            />
          </section>
        </TabsContent>

        <TabsContent value="theme" className="mt-4">
          <ThemePicker
            value={theme}
            savedValue={savedTheme}
            onChange={setTheme}
          />
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

        <TabsContent value="departments" className="mt-4">
          <DepartmentsPanel value={departments} onChange={setDepartments} />
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
                        : tab === 'leave'
                          ? 'Leave types'
                          : 'Departments'}
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

