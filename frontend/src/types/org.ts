// Types returned by the public GET /orgs/by-slug/{slug} endpoint.
// Safe for unauthenticated callers — only branding fields.
export interface OrgSummary {
  orgId: string
  slug: string
  name: string
  status: 'ACTIVE' | 'SUSPENDED'
  displayName: string
  logoUrl: string | null
  primaryColor: string
  accentColor: string
}

// Full org detail — returned by authed GET /orgs/current only.
export interface OrgDetail {
  orgId: string
  slug: string
  name: string
  ownerUserId: string
  status: 'ACTIVE' | 'SUSPENDED' | 'PENDING_DELETION'
  planTier: 'FREE' | 'PRO' | 'ENTERPRISE'
  createdAt: string
  updatedAt: string
  /** Set when the owner has scheduled deletion. 30 days from this
   *  timestamp the sweeper hard-deletes everything. Cleared by the
   *  undelete flow. */
  deletedAt?: string | null
}

export interface OrgSettings {
  orgId: string
  displayName: string
  logoUrl: string | null
  faviconUrl: string | null
  primaryColor: string
  accentColor: string
  /** Curated font id (see frontend/src/lib/tenant/fonts.ts). Null/empty
   *  means use the app default (Outfit). */
  fontFamily: string | null
  /** Curated theme preset id (see frontend/src/lib/tenant/themes.ts).
   *  Drives the workspace-wide surface palette. Defaults to "slate". */
  theme: string
  terminology: Record<string, string>
  timezone: string
  locale: string
  currency: string
  weekStartDay: number
  workingHoursStart: string
  workingHoursEnd: string
  employeeIdPrefix: string
  features: Record<string, boolean>
  leaveTypes: Array<{ id: string; name: string; annualQuota: number }>
  /** OWNER-managed department catalog. Drives the dropdown in the
   *  user create/edit form and the filter on the admin Users page. */
  departments: string[]
  createdAt: string
  updatedAt: string
}

export interface OrgPlan {
  orgId: string
  tier: 'FREE' | 'PRO' | 'ENTERPRISE'
  maxUsers: number | null
  maxProjects: number | null
  retentionDays: number | null
  featuresAllowed: string[]
  createdAt: string
  updatedAt: string
}

export interface CurrentOrgResponse {
  org: OrgDetail
  settings: OrgSettings | null
  plan: OrgPlan | null
  /** Phase 5 — folded into this response so the kanban can render
   *  pipelines without a second round-trip on app load. */
  pipelines?: Pipeline[]
}

export interface SignupRequest {
  orgName: string
  slug: string
  ownerName: string
  ownerEmail: string
  password: string
  /** Employee-ID prefix for this tenant — gets baked into every
   *  employee ID generated for the workspace (e.g. `ACME-26AB12`).
   *  Backend strips trailing `-` and uppercases. Optional — falls
   *  back to `EMP-` when omitted. The owner can change it later in
   *  /settings/organization but existing IDs aren't renamed, so
   *  setting it correctly here matters. */
  employeeIdPrefix?: string
  /** Caller's IANA timezone (browser-detected). Drives report
   *  boundaries, day-off date math, and scheduled-job timing.
   *  Optional — defaults to `Asia/Kolkata` for legacy clients. */
  timezone?: string
  /** hCaptcha token from the widget. Optional — backend verification
   *  is skipped when HCAPTCHA_SECRET is unset (dev/staging). */
  captchaToken?: string
}

export interface SignupResponse {
  orgId: string
  slug: string
  name: string
  ownerUserId: string
  redirectUrl: string
}

export interface SendInviteRequest {
  email: string
  /** Canonical lowercase role_id. Built-in tiers are `admin` and
   *  `member`; tenants with custom scope="system" roles can also pass
   *  those role_ids directly (validated server-side against the tenant's
   *  role records). `owner` is rejected — use transfer-ownership. */
  roleId?: string
}

export interface SendInviteResponse {
  token: string
  email: string
  roleId: string
  expiresAt: string
  invitedBy: string
}

export interface Invite {
  email: string
  roleId: string
  invitedBy: string
  expiresAt: string
  acceptedAt: string | null
  createdAt: string
  status: 'pending' | 'accepted' | 'expired'
  token: string
}

export interface ListInvitesResponse {
  invites: Invite[]
}

export interface Role {
  orgId: string
  roleId: string
  name: string
  scope: 'system' | 'project'
  isSystem: boolean
  permissions: string[]
  createdAt: string | null
  updatedAt: string | null
}

export interface ListRolesResponse {
  roles: Role[]
  allPermissions: string[]
}

export interface PipelineStatus {
  id: string
  label: string
  color: string
  order: number
  isTerminal: boolean
}

export interface Pipeline {
  orgId: string
  pipelineId: string
  name: string
  isDefault: boolean
  statuses: PipelineStatus[]
  createdAt: string | null
  updatedAt: string | null
}

export interface ListPipelinesResponse {
  pipelines: Pipeline[]
}

export interface AuditEvent {
  eventId: string
  action: string
  actorId: string
  actorEmail: string
  actorRole: string
  targetType: string
  targetId: string
  summary: string
  before?: unknown
  after?: unknown
  metadata?: unknown
  createdAt: string
}

export interface ListAuditResponse {
  events: AuditEvent[]
  nextCursor: string | null
}

export interface AcceptInviteRequest {
  name: string
  password: string
}

export interface AcceptInviteResponse {
  orgId: string
  slug: string
  userId: string
  email: string
  redirectUrl: string
}
