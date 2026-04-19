'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { AlertCircle, CheckCircle2, RotateCcw } from 'lucide-react'

import { useAuth } from '@/lib/auth/AuthProvider'
import { useTenant } from '@/lib/tenant/TenantProvider'
import { applyTenantTheme } from '@/lib/tenant/theme'
import { orgsApi, type UpdateSettingsRequest } from '@/lib/api/orgsApi'
import { PageHeader } from '@/components/ui/PageHeader'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
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
import { TerminologyPanel } from '@/components/settings/TerminologyPanel'
import { FeaturesPanel } from '@/components/settings/FeaturesPanel'

type Tab = 'branding' | 'terminology' | 'features'

interface BrandingState {
  displayName: string
  logoUrl: string
  primaryColor: string
  accentColor: string
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
    logoUrl: '',
    primaryColor: DEFAULT_PRIMARY,
    accentColor: DEFAULT_ACCENT,
  })
  const [terminology, setTerminology] = useState<Record<string, string>>({})
  const [features, setFeatures] = useState<Record<string, boolean>>({})

  // Snapshot of last-saved values for dirty checks
  const [savedBranding, setSavedBranding] = useState<BrandingState>(branding)
  const [savedTerminology, setSavedTerminology] = useState<
    Record<string, string>
  >({})
  const [savedFeatures, setSavedFeatures] = useState<Record<string, boolean>>(
    {}
  )

  // Authz — only OWNER can see this page
  useEffect(() => {
    if (user && user.systemRole !== 'OWNER') {
      router.replace('/dashboard')
    }
  }, [user, router])

  // Hydrate form from TenantContext when settings arrive
  useEffect(() => {
    if (!current?.settings) {
      refreshCurrent()
      return
    }
    const s = current.settings
    const initialBranding: BrandingState = {
      displayName: s.displayName ?? '',
      logoUrl: s.logoUrl ?? '',
      primaryColor: s.primaryColor ?? DEFAULT_PRIMARY,
      accentColor: s.accentColor ?? DEFAULT_ACCENT,
    }
    const initialTerminology = s.terminology ?? {}
    const initialFeatures = s.features ?? {}
    setBranding(initialBranding)
    setTerminology(initialTerminology)
    setFeatures(initialFeatures)
    setSavedBranding(initialBranding)
    setSavedTerminology(initialTerminology)
    setSavedFeatures(initialFeatures)
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

  const dirtyForTab =
    tab === 'branding'
      ? brandingDirty
      : tab === 'terminology'
        ? terminologyDirty
        : featuresDirty

  const onSave = async () => {
    setSaving(true)
    setError(null)
    try {
      let payload: UpdateSettingsRequest = {}
      if (tab === 'branding') {
        payload = {
          displayName: branding.displayName,
          logoUrl: branding.logoUrl || null,
          primaryColor: branding.primaryColor,
          accentColor: branding.accentColor,
        }
      } else if (tab === 'terminology') {
        payload = { terminology }
      } else {
        payload = { features }
      }

      await orgsApi.updateSettings(payload)
      await refreshCurrent()

      // Sync the saved snapshot for the tab we just persisted
      if (tab === 'branding') setSavedBranding(branding)
      else if (tab === 'terminology') setSavedTerminology(terminology)
      else setSavedFeatures(features)

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
    else setFeatures(savedFeatures)
    setError(null)
  }

  if (!user) return null
  if (user.systemRole !== 'OWNER') return null

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 pb-24 animate-fade-in">
      <PageHeader
        title="Organization settings"
        description="These changes apply to everyone in your workspace."
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
          <TabsTrigger value="terminology" className="gap-2">
            Terminology
            {terminologyDirty && <DirtyDot />}
          </TabsTrigger>
          <TabsTrigger value="features" className="gap-2">
            Features
            {featuresDirty && <DirtyDot />}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="branding" className="mt-4">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <Card className="space-y-5 p-5">
              <Input
                label="Display name"
                type="text"
                value={branding.displayName}
                onChange={(e) =>
                  setBranding((b) => ({ ...b, displayName: e.target.value }))
                }
                placeholder="Acme Inc"
              />
              <Input
                label="Logo URL"
                type="url"
                value={branding.logoUrl}
                onChange={(e) =>
                  setBranding((b) => ({ ...b, logoUrl: e.target.value }))
                }
                placeholder="https://..."
                hint="Square images at 128×128 or larger look best."
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
              logoUrl={branding.logoUrl}
            />
          </div>
        </TabsContent>

        <TabsContent value="terminology" className="mt-4">
          <TerminologyPanel value={terminology} onChange={setTerminology} />
        </TabsContent>

        <TabsContent value="features" className="mt-4">
          <FeaturesPanel value={features} onChange={setFeatures} />
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
                in {tab === 'branding' ? 'Branding' : tab === 'terminology' ? 'Terminology' : 'Features'}
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
