'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  AlertCircle,
  Crown,
  KeySquare,
  Lock,
  Plus,
  Save,
  Search,
  Shield,
  ShieldCheck,
  Trash2,
  Users,
  X,
} from 'lucide-react'

import { BackToSettings } from '@/components/settings/BackToSettings'

import { domainLabel, metaFor } from '@/lib/permissions/catalog'

import { useAuth } from '@/lib/auth/AuthProvider'
import { orgsApi } from '@/lib/api/orgsApi'
import type { Role } from '@/types/org'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card } from '@/components/ui/Card'
import { Alert, AlertDescription } from '@/components/ui/Alert'
import { Badge } from '@/components/ui/Badge'
import { Modal } from '@/components/ui/Modal'
import { PageHeader } from '@/components/ui/PageHeader'
import { useToast } from '@/components/ui/Toast'
import { useConfirm } from '@/components/ui/ConfirmDialog'
import { cn } from '@/lib/utils'

interface RolesPageState {
  loading: boolean
  error: string | null
  roles: Role[]
  allPermissions: string[]
}

/** Visual treatment per built-in role. Custom roles get the neutral theme. */
const ROLE_THEME: Record<
  string,
  { icon: typeof Shield; tint: string; ring: string; label: string }
> = {
  owner: {
    icon: Crown,
    tint: 'bg-amber-50 text-amber-700',
    ring: 'ring-amber-200',
    label: 'Full access',
  },
  admin: {
    icon: ShieldCheck,
    tint: 'bg-violet-50 text-violet-700',
    ring: 'ring-violet-200',
    label: 'Manages workspace',
  },
  member: {
    icon: Users,
    tint: 'bg-sky-50 text-sky-700',
    ring: 'ring-sky-200',
    label: 'Day-to-day work',
  },
}

const NEUTRAL_THEME = {
  icon: Shield,
  tint: 'bg-slate-50 text-slate-700',
  ring: 'ring-slate-200',
  label: 'Custom role',
}

export default function RolesSettingsPage() {
  const { user, refreshSession } = useAuth()
  const router = useRouter()
  const toast = useToast()
  const confirm = useConfirm()
  const [state, setState] = useState<RolesPageState>({
    loading: true,
    error: null,
    roles: [],
    allPermissions: [],
  })
  const [editingRole, setEditingRole] = useState<Role | null>(null)
  const [creating, setCreating] = useState(false)

  // Authz — only OWNER manages roles. ADMINs see read-only.
  const canManage = user?.systemRole === 'OWNER'

  useEffect(() => {
    if (user && user.systemRole !== 'OWNER' && user.systemRole !== 'ADMIN') {
      router.replace('/dashboard')
    }
  }, [user, router])

  const refresh = async () => {
    setState((s) => ({ ...s, loading: true, error: null }))
    try {
      const res = await orgsApi.listRoles()
      setState({
        loading: false,
        error: null,
        roles: res.roles,
        allPermissions: res.allPermissions,
      })
    } catch (e) {
      setState((s) => ({
        ...s,
        loading: false,
        error: e instanceof Error ? e.message : 'Failed to load roles',
      }))
    }
  }

  useEffect(() => {
    refresh()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const handleDelete = async (role: Role) => {
    if (role.isSystem) return
    const ok = await confirm({
      title: `Delete '${role.name}'?`,
      description:
        'Users currently assigned this role will keep it until reassigned. This cannot be undone.',
      confirmLabel: 'Delete',
      variant: 'danger',
    })
    if (!ok) return
    try {
      await orgsApi.deleteRole(role.roleId)
      toast.success(`Role '${role.name}' deleted`)
      await refresh()
      // If the caller's own role was deleted their token is stale.
      // Safe to always refresh — no-op if the token is already current.
      await refreshSession().catch(() => {})
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Failed to delete role')
    }
  }

  const customRoleCount = state.roles.filter((r) => !r.isSystem).length

  if (!user) return null
  if (user.systemRole !== 'OWNER' && user.systemRole !== 'ADMIN') return null

  return (
    <div className="mx-auto flex w-full max-w-5xl flex-col gap-5 pb-24 animate-fade-in">
      <BackToSettings />

      <PageHeader
        title="Roles & permissions"
        description={
          canManage
            ? 'Define who can do what. System roles are editable; custom roles can be created.'
            : 'View what each role grants in your workspace.'
        }
      />

      {state.error && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      )}

      {/* Stat strip */}
      {!state.loading && state.roles.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <StatTile
            label="Roles"
            value={state.roles.length}
            sublabel={`${state.roles.length - customRoleCount} system, ${customRoleCount} custom`}
            icon={ShieldCheck}
          />
          <StatTile
            label="Permissions"
            value={state.allPermissions.length}
            sublabel="Available in catalog"
            icon={KeySquare}
          />
          <StatTile
            label="Most permissive"
            value={
              state.roles
                .map((r) => r.permissions.length)
                .reduce((a, b) => Math.max(a, b), 0)
            }
            sublabel="Largest role"
            icon={Crown}
          />
        </div>
      )}

      {canManage && (
        <div className="flex items-center justify-end">
          <Button variant="primary" size="sm" onClick={() => setCreating(true)}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            New role
          </Button>
        </div>
      )}

      {state.loading ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <RoleCardSkeleton key={i} />
          ))}
        </div>
      ) : state.roles.length === 0 ? (
        <Card className="flex flex-col items-center gap-3 px-5 py-12 text-center">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            <Shield className="h-6 w-6" />
          </div>
          <div>
            <p className="text-sm font-semibold text-foreground">
              No roles configured
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Default roles are seeded automatically when an organization is
              created.
            </p>
          </div>
        </Card>
      ) : (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 stagger-rise">
          {state.roles.map((r) => (
            <RoleCard
              key={r.roleId}
              role={r}
              totalPermissions={state.allPermissions.length}
              canManage={canManage}
              onEdit={() => setEditingRole(r)}
              onDelete={() => handleDelete(r)}
            />
          ))}
        </div>
      )}

      {editingRole && (
        <RoleEditorModal
          role={editingRole}
          allPermissions={state.allPermissions}
          onClose={() => setEditingRole(null)}
          onSaved={async () => {
            setEditingRole(null)
            await refresh()
            // If the edited role is one the caller holds, their token
            // is stale until refresh. Always-refresh is cheap and safe.
            await refreshSession().catch(() => {})
          }}
        />
      )}

      {creating && (
        <RoleCreatorModal
          allPermissions={state.allPermissions}
          onClose={() => setCreating(false)}
          onCreated={async () => {
            setCreating(false)
            await refresh()
          }}
        />
      )}
    </div>
  )
}

function StatTile({
  label,
  value,
  sublabel,
  icon: Icon,
}: {
  label: string
  value: number | string
  sublabel: string
  icon: typeof ShieldCheck
}) {
  return (
    <Card className="flex items-center gap-3 p-4">
      <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </p>
        <p className="text-xl font-bold tabular-nums text-foreground leading-none mt-0.5">
          {value}
        </p>
        <p className="text-[11px] text-muted-foreground mt-0.5 truncate">
          {sublabel}
        </p>
      </div>
    </Card>
  )
}

function RoleCardSkeleton() {
  return (
    <Card className="flex flex-col gap-3 p-5">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-muted animate-pulse" />
          <div className="h-4 w-20 rounded bg-muted animate-pulse" />
        </div>
        <div className="h-4 w-12 rounded bg-muted animate-pulse" />
      </div>
      <div className="h-3 w-32 rounded bg-muted animate-pulse" />
      <div className="h-2 w-full rounded bg-muted animate-pulse" />
      <div className="flex flex-wrap gap-1">
        <div className="h-4 w-16 rounded bg-muted animate-pulse" />
        <div className="h-4 w-20 rounded bg-muted animate-pulse" />
        <div className="h-4 w-14 rounded bg-muted animate-pulse" />
      </div>
    </Card>
  )
}

function RoleCard({
  role,
  totalPermissions,
  canManage,
  onEdit,
  onDelete,
}: {
  role: Role
  totalPermissions: number
  canManage: boolean
  onEdit: () => void
  onDelete: () => void
}) {
  const theme = ROLE_THEME[role.roleId.toLowerCase()] ?? NEUTRAL_THEME
  const Icon = theme.icon

  // Group permissions by domain prefix for a more scannable preview
  const grouped = useMemo(() => {
    const m = new Map<string, number>()
    for (const p of role.permissions) {
      const domain = p.split('.')[0] || 'other'
      m.set(domain, (m.get(domain) ?? 0) + 1)
    }
    return Array.from(m.entries()).sort(
      ([, a], [, b]) => b - a
    )
  }, [role.permissions])

  const pct =
    totalPermissions > 0
      ? Math.round((role.permissions.length / totalPermissions) * 100)
      : 0

  return (
    <Card className="group flex flex-col gap-4 p-5 transition-all hover:-translate-y-0.5 hover:shadow-card-hover hover-lift-sm">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex h-10 w-10 items-center justify-center rounded-xl ring-1',
              theme.tint,
              theme.ring,
            )}
          >
            <Icon className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-bold text-foreground leading-tight">
              {role.name}
            </h3>
            <p className="text-[11px] text-muted-foreground mt-0.5">
              {theme.label}
            </p>
          </div>
        </div>
        {role.isSystem ? (
          <Badge variant="outline" className="text-[10px] shrink-0">
            System
          </Badge>
        ) : (
          <Badge
            variant="outline"
            className="text-[10px] shrink-0 border-primary/30 text-primary"
          >
            Custom
          </Badge>
        )}
      </div>

      {/* Permission count + progress */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-baseline justify-between">
          <span className="text-2xl font-bold tabular-nums text-foreground leading-none">
            {role.permissions.length}
          </span>
          <span className="text-[11px] text-muted-foreground">
            of {totalPermissions} permissions
          </span>
        </div>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
          <div
            className="h-full rounded-full bg-primary transition-all"
            style={{ width: `${pct}%` }}
          />
        </div>
      </div>

      {/* Grouped permission preview */}
      {role.permissions.length === 0 ? (
        <p className="text-xs text-muted-foreground italic">
          No permissions visible to you.
        </p>
      ) : (
        <div className="flex flex-wrap gap-1">
          {grouped.slice(0, 8).map(([domain, count]) => (
            <span
              key={domain}
              className="inline-flex items-center gap-1 rounded-md bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-foreground/80"
            >
              <span className="font-mono">{domain}</span>
              <span className="text-muted-foreground tabular-nums">
                {count}
              </span>
            </span>
          ))}
          {grouped.length > 8 && (
            <span className="inline-flex items-center text-[10px] text-muted-foreground">
              +{grouped.length - 8}
            </span>
          )}
        </div>
      )}

      {canManage && (
        <div className="mt-auto flex gap-2 border-t border-border pt-3">
          <Button
            variant="secondary"
            size="sm"
            onClick={onEdit}
            className="flex-1"
          >
            Edit
          </Button>
          {!role.isSystem && (
            <Button
              variant="ghost"
              size="sm"
              onClick={onDelete}
              aria-label="Delete role"
            >
              <Trash2 className="h-3.5 w-3.5 text-destructive" />
            </Button>
          )}
        </div>
      )}
    </Card>
  )
}

function PermissionMatrix({
  allPermissions,
  selected,
  onChange,
  search,
}: {
  allPermissions: string[]
  selected: Set<string>
  onChange: (next: Set<string>) => void
  search: string
}) {
  const q = search.trim().toLowerCase()

  // Group permissions by domain prefix
  const grouped = useMemo(() => {
    const groups = new Map<string, string[]>()
    for (const p of allPermissions) {
      const domain = p.split('.')[0] || 'other'
      if (!groups.has(domain)) groups.set(domain, [])
      groups.get(domain)!.push(p)
    }
    return Array.from(groups.entries()).sort(([a], [b]) =>
      domainLabel(a).localeCompare(domainLabel(b)),
    )
  }, [allPermissions])

  // Apply search filter — match against id, friendly label, or domain
  const filtered = useMemo(() => {
    if (!q) return grouped
    return grouped
      .map(
        ([domain, perms]) =>
          [
            domain,
            perms.filter((p) => {
              const label = metaFor(p).label.toLowerCase()
              return (
                p.toLowerCase().includes(q) ||
                label.includes(q) ||
                domainLabel(domain).toLowerCase().includes(q)
              )
            }),
          ] as const,
      )
      .filter(([, perms]) => perms.length > 0)
  }, [grouped, q])

  const toggle = (p: string) => {
    const next = new Set(selected)
    if (next.has(p)) next.delete(p)
    else next.add(p)
    onChange(next)
  }

  const toggleGroup = (perms: string[], allOn: boolean) => {
    const next = new Set(selected)
    for (const p of perms) {
      if (allOn) next.delete(p)
      else next.add(p)
    }
    onChange(next)
  }

  if (filtered.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border px-4 py-10 text-center">
        <Search className="h-5 w-5 text-muted-foreground/60" />
        <p className="text-xs text-muted-foreground">
          No permissions match &ldquo;{search}&rdquo;.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {filtered.map(([domain, perms]) => {
        const onCount = perms.filter((p) => selected.has(p)).length
        const allOn = onCount === perms.length
        const partial = onCount > 0 && !allOn
        return (
          <div
            key={domain}
            className="overflow-hidden rounded-xl border border-border bg-card"
          >
            <button
              type="button"
              onClick={() => toggleGroup(perms, allOn)}
              className="group flex w-full items-center justify-between gap-3 border-b border-border bg-muted/30 px-4 py-2.5 text-left transition-colors hover:bg-muted/60"
            >
              <div className="flex items-center gap-3">
                <span
                  className={cn(
                    'inline-flex h-4 w-4 items-center justify-center rounded border-2 transition-colors',
                    allOn
                      ? 'border-primary bg-primary text-primary-foreground'
                      : partial
                        ? 'border-primary bg-primary/20'
                        : 'border-border bg-card group-hover:border-foreground/40',
                  )}
                  aria-hidden
                >
                  {allOn && (
                    <svg viewBox="0 0 20 20" className="h-2.5 w-2.5">
                      <path
                        d="M5 10l3 3 7-7"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                  {partial && (
                    <span className="h-0.5 w-2 rounded-full bg-primary" />
                  )}
                </span>
                <span className="text-sm font-semibold text-foreground">
                  {domainLabel(domain)}
                </span>
              </div>
              <span
                className={cn(
                  'rounded-md px-1.5 py-0.5 text-[10px] font-bold tabular-nums',
                  onCount === 0
                    ? 'bg-muted text-muted-foreground'
                    : allOn
                      ? 'bg-primary/10 text-primary'
                      : 'bg-amber-100 text-amber-700',
                )}
              >
                {onCount}/{perms.length}
              </span>
            </button>
            <ul className="divide-y divide-border/60">
              {perms.map((p) => {
                const meta = metaFor(p)
                const checked = selected.has(p)
                return (
                  <li key={p}>
                    <label
                      className={cn(
                        'flex cursor-pointer items-start gap-3 px-4 py-2 transition-colors',
                        checked
                          ? 'bg-primary/5 border-l-2 border-l-primary'
                          : 'border-l-2 border-l-transparent hover:bg-muted/40',
                      )}
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggle(p)}
                        className="mt-0.5 h-3.5 w-3.5 shrink-0 rounded border-border accent-primary"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <span
                            className={cn(
                              'text-sm font-medium',
                              checked
                                ? 'text-foreground'
                                : 'text-foreground/85',
                            )}
                          >
                            {meta.label}
                          </span>
                          {meta.destructive && (
                            <span className="inline-flex items-center rounded-md bg-destructive/10 px-1 py-0 text-[9px] font-bold uppercase tracking-wider text-destructive">
                              Destructive
                            </span>
                          )}
                        </div>
                        {meta.description && (
                          <p className="text-[11px] text-muted-foreground mt-0.5">
                            {meta.description}
                          </p>
                        )}
                        <code className="mt-0.5 block font-mono text-[10px] text-muted-foreground/70">
                          {p}
                        </code>
                      </div>
                    </label>
                  </li>
                )
              })}
            </ul>
          </div>
        )
      })}
    </div>
  )
}

/** Header common to both create + edit modals — search + quick presets. */
function MatrixHeader({
  search,
  setSearch,
  selectedCount,
  totalCount,
  allPermissions,
  onChange,
}: {
  search: string
  setSearch: (s: string) => void
  selectedCount: number
  totalCount: number
  allPermissions: string[]
  onChange: (next: Set<string>) => void
}) {
  const selectAll = () => onChange(new Set(allPermissions))
  const selectNone = () => onChange(new Set())
  const selectReadOnly = () => {
    // Heuristic: "read-only" = anything ending in .view, .list, .view.*, or
    // containing .list. Catches user.list, task.view.all, etc.
    const next = new Set<string>()
    for (const p of allPermissions) {
      if (
        p.endsWith('.view') ||
        p.endsWith('.list') ||
        p.includes('.view.') ||
        p.includes('.list.')
      ) {
        next.add(p)
      }
    }
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-baseline gap-2">
          <p className="text-sm font-semibold text-foreground">Permissions</p>
          <span className="rounded-md bg-muted px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-foreground/80">
            {selectedCount} / {totalCount}
          </span>
        </div>
        <div className="inline-flex items-center rounded-lg border border-border bg-card p-0.5">
          <PresetButton onClick={selectAll}>All</PresetButton>
          <PresetButton onClick={selectReadOnly}>Read-only</PresetButton>
          <PresetButton onClick={selectNone}>None</PresetButton>
        </div>
      </div>
      <Input
        type="text"
        placeholder="Search by name or permission id..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        leftIcon={<Search />}
        rightIcon={
          search ? (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="pointer-events-auto rounded p-0.5 text-muted-foreground/70 hover:text-foreground"
              aria-label="Clear search"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : undefined
        }
        className="h-9"
      />
    </div>
  )
}

function PresetButton({
  onClick,
  children,
}: {
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md px-2.5 py-1 text-xs font-semibold text-muted-foreground transition-all hover:bg-muted hover:text-foreground"
    >
      {children}
    </button>
  )
}

function RoleEditorModal({
  role,
  allPermissions,
  onClose,
  onSaved,
}: {
  role: Role
  allPermissions: string[]
  onClose: () => void
  onSaved: () => void | Promise<void>
}) {
  const toast = useToast()
  const [name, setName] = useState(role.name)
  const [perms, setPerms] = useState<Set<string>>(new Set(role.permissions))
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const onSave = async () => {
    setSaving(true)
    setError('')
    try {
      await orgsApi.updateRole(role.roleId, {
        name: role.isSystem ? undefined : name.trim(),
        permissions: Array.from(perms),
      })
      toast.success(`Role '${role.name}' saved`)
      await onSaved()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen onClose={onClose} title={`Edit role: ${role.name}`} size="lg">
      <div className="flex flex-col gap-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {role.isSystem ? (
          <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/60 px-3 py-2.5">
            <Lock className="h-4 w-4 shrink-0 text-amber-600 mt-0.5" />
            <div className="min-w-0">
              <p className="text-xs font-semibold text-amber-800">
                System role
              </p>
              <p className="text-[11px] text-amber-700/90 mt-0.5">
                Name and ID are locked. Edit permissions below — they take
                effect on next request, no re-login needed for the role
                itself, but token claims refresh on next login.
              </p>
            </div>
          </div>
        ) : (
          <Input
            label="Role name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        )}

        <MatrixHeader
          search={search}
          setSearch={setSearch}
          selectedCount={perms.size}
          totalCount={allPermissions.length}
          allPermissions={allPermissions}
          onChange={setPerms}
        />

        <div className="max-h-[50vh] overflow-y-auto pr-1">
          <PermissionMatrix
            allPermissions={allPermissions}
            selected={perms}
            onChange={setPerms}
            search={search}
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onSave} loading={saving}>
            <Save className="mr-1.5 h-3.5 w-3.5" />
            Save changes
          </Button>
        </div>
      </div>
    </Modal>
  )
}

function RoleCreatorModal({
  allPermissions,
  onClose,
  onCreated,
}: {
  allPermissions: string[]
  onClose: () => void
  onCreated: () => void | Promise<void>
}) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [perms, setPerms] = useState<Set<string>>(new Set())
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const onCreate = async () => {
    setError('')
    if (!name.trim()) {
      setError('Role name is required')
      return
    }
    setSaving(true)
    try {
      await orgsApi.createRole({
        name: name.trim(),
        permissions: Array.from(perms),
      })
      toast.success(`Role '${name}' created`)
      await onCreated()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create role')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal isOpen onClose={onClose} title="Create role" size="lg">
      <div className="flex flex-col gap-4">
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Input
          label="Role name"
          placeholder="e.g. Tester, Project Lead"
          value={name}
          onChange={(e) => setName(e.target.value)}
          hint="The role ID is derived from the name (lowercase, underscores)."
        />

        <MatrixHeader
          search={search}
          setSearch={setSearch}
          selectedCount={perms.size}
          totalCount={allPermissions.length}
          allPermissions={allPermissions}
          onChange={setPerms}
        />

        <div className="max-h-[50vh] overflow-y-auto pr-1">
          <PermissionMatrix
            allPermissions={allPermissions}
            selected={perms}
            onChange={setPerms}
            search={search}
          />
        </div>

        <div className="flex justify-end gap-2 border-t border-border pt-3">
          <Button variant="secondary" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" onClick={onCreate} loading={saving}>
            <Plus className="mr-1.5 h-3.5 w-3.5" />
            Create role
          </Button>
        </div>
      </div>
    </Modal>
  )
}
