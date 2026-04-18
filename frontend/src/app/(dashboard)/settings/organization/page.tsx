'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'

import { useAuth } from '@/lib/auth/AuthProvider'
import { useTenant } from '@/lib/tenant/TenantProvider'
import { applyTenantTheme } from '@/lib/tenant/theme'
import { orgsApi, type UpdateSettingsRequest } from '@/lib/api/orgsApi'
import { BASE_TERMINOLOGY } from '@/lib/tenant/i18n'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type Tab = 'branding' | 'terminology' | 'features'

/** OWNER-only org settings page. Tabs: Branding, Terminology, Features.
 * Phase 3 scope — locale/leave-types tabs deferred to later. */
export default function OrgSettingsPage() {
  const { user } = useAuth()
  const { current, refreshCurrent } = useTenant()
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('branding')
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Form state, seeded from current settings
  const [displayName, setDisplayName] = useState('')
  const [logoUrl, setLogoUrl] = useState('')
  const [primaryColor, setPrimaryColor] = useState('#4F46E5')
  const [accentColor, setAccentColor] = useState('#10B981')
  const [terminology, setTerminology] = useState<Record<string, string>>({})
  const [features, setFeatures] = useState<Record<string, boolean>>({})

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
    setDisplayName(s.displayName ?? '')
    setLogoUrl(s.logoUrl ?? '')
    setPrimaryColor(s.primaryColor ?? '#4F46E5')
    setAccentColor(s.accentColor ?? '#10B981')
    setTerminology(s.terminology ?? {})
    setFeatures(s.features ?? {})
  }, [current, refreshCurrent])

  const onSave = async (payload: UpdateSettingsRequest) => {
    setSaving(true)
    setError(null)
    try {
      await orgsApi.updateSettings(payload)
      await refreshCurrent()
      setSavedAt(Date.now())
      // Re-apply theme immediately in case colors changed
      if (payload.primaryColor || payload.accentColor) {
        applyTenantTheme(
          payload.primaryColor ?? primaryColor,
          payload.accentColor ?? accentColor,
        )
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  if (!user) return null
  if (user.systemRole !== 'OWNER') return null

  return (
    <div className="max-w-3xl mx-auto px-6 py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
          Organization settings
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          These changes apply to everyone in your workspace.
        </p>
      </header>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200 dark:border-gray-700">
        {(['branding', 'terminology', 'features'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-medium capitalize border-b-2 transition-colors ${
              tab === t
                ? 'border-primary text-primary'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {error && (
        <div className="mb-4 rounded-xl bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}
      {savedAt && !error && (
        <div className="mb-4 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3 text-sm text-emerald-700">
          Saved.
        </div>
      )}

      {tab === 'branding' && (
        <div className="flex flex-col gap-5">
          <Input
            label="Display name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Acme Inc"
          />
          <Input
            label="Logo URL"
            type="url"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            placeholder="https://..."
          />
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-1.5 block">
                Primary color
              </label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="h-10 w-14 rounded border border-gray-200 cursor-pointer"
                />
                <input
                  type="text"
                  value={primaryColor}
                  onChange={(e) => setPrimaryColor(e.target.value)}
                  className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-sm font-semibold text-gray-700 mb-1.5 block">
                Accent color
              </label>
              <div className="flex gap-2 items-center">
                <input
                  type="color"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="h-10 w-14 rounded border border-gray-200 cursor-pointer"
                />
                <input
                  type="text"
                  value={accentColor}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="flex-1 rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>
          {/* Live preview swatch */}
          <div className="rounded-xl border border-gray-200 p-4 flex items-center gap-3">
            <div
              className="h-10 w-10 rounded-lg"
              style={{ backgroundColor: primaryColor }}
            />
            <div
              className="h-10 w-10 rounded-lg"
              style={{ backgroundColor: accentColor }}
            />
            <span className="text-sm text-gray-500">Preview</span>
          </div>
          <Button
            onClick={() =>
              onSave({
                displayName,
                logoUrl: logoUrl || null,
                primaryColor,
                accentColor,
              })
            }
            loading={saving}
            className="self-start"
          >
            Save branding
          </Button>
        </div>
      )}

      {tab === 'terminology' && (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-gray-500">
            Override how TaskFlow refers to things in your workspace.
            Leave any field blank to use the default.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {Object.entries(BASE_TERMINOLOGY).map(([key, defaultValue]) => (
              <div key={key}>
                <label className="text-xs font-semibold text-gray-500 mb-1 block">
                  {key}{' '}
                  <span className="text-gray-400 font-normal">
                    (default: {defaultValue})
                  </span>
                </label>
                <input
                  type="text"
                  value={terminology[key] ?? ''}
                  onChange={(e) => {
                    const v = e.target.value
                    setTerminology((prev) => {
                      const next = { ...prev }
                      if (v.trim() === '') delete next[key]
                      else next[key] = v
                      return next
                    })
                  }}
                  placeholder={defaultValue}
                  className="w-full rounded-xl border border-gray-200 px-3 py-2 text-sm"
                />
              </div>
            ))}
          </div>
          <Button
            onClick={() => onSave({ terminology })}
            loading={saving}
            className="self-start mt-4"
          >
            Save terminology
          </Button>
        </div>
      )}

      {tab === 'features' && (
        <div className="flex flex-col gap-3">
          <p className="text-sm text-gray-500 mb-2">
            Turn features on or off for everyone in your workspace.
          </p>
          {Object.entries(features).map(([key, enabled]) => (
            <label
              key={key}
              className="flex items-center justify-between px-4 py-3 rounded-xl border border-gray-200 cursor-pointer hover:bg-gray-50"
            >
              <span className="text-sm font-medium text-gray-800 capitalize">
                {key.replace(/_/g, ' ')}
              </span>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) =>
                  setFeatures((prev) => ({ ...prev, [key]: e.target.checked }))
                }
                className="h-5 w-9 appearance-none bg-gray-300 rounded-full relative cursor-pointer checked:bg-primary transition-colors before:content-[''] before:absolute before:top-0.5 before:left-0.5 before:h-4 before:w-4 before:rounded-full before:bg-white before:transition-transform checked:before:translate-x-4"
              />
            </label>
          ))}
          <Button
            onClick={() => onSave({ features })}
            loading={saving}
            className="self-start mt-4"
          >
            Save features
          </Button>
        </div>
      )}
    </div>
  )
}
