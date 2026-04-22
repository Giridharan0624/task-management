import { apiClient } from './client'
import type {
  AcceptInviteRequest,
  AcceptInviteResponse,
  CurrentOrgResponse,
  ListAuditResponse,
  ListInvitesResponse,
  ListRolesResponse,
  OrgSettings,
  OrgSummary,
  Pipeline,
  Role,
  SendInviteRequest,
  SendInviteResponse,
  SignupRequest,
  SignupResponse,
} from '@/types/org'

/** Partial settings update — only the fields in the request are changed. */
export type UpdateSettingsRequest = Partial<
  Pick<
    OrgSettings,
    | 'displayName'
    | 'logoUrl'
    | 'faviconUrl'
    | 'primaryColor'
    | 'accentColor'
    | 'terminology'
    | 'timezone'
    | 'locale'
    | 'currency'
    | 'weekStartDay'
    | 'workingHoursStart'
    | 'workingHoursEnd'
    | 'employeeIdPrefix'
    | 'features'
    | 'leaveTypes'
  >
>

export const orgsApi = {
  // Public — POST /signup creates a tenant and its first owner user
  async signup(req: SignupRequest): Promise<SignupResponse> {
    return apiClient.post<SignupResponse>('/signup', req)
  },

  // Public — GET /orgs/by-slug/{slug} resolves a workspace code
  // to org metadata so the login/signup page can theme itself before
  // the user authenticates.
  async getBySlug(slug: string): Promise<OrgSummary> {
    return apiClient.get<OrgSummary>(`/orgs/by-slug/${encodeURIComponent(slug)}`)
  },

  // Authed — GET /orgs/current returns the full org + settings + plan
  // for the caller's org (resolved from the JWT's custom:orgId claim).
  async getCurrent(): Promise<CurrentOrgResponse> {
    return apiClient.get<CurrentOrgResponse>('/orgs/current')
  },

  // Authed OWNER — PUT /orgs/current/settings merges a partial payload
  // into the current settings.
  async updateSettings(req: UpdateSettingsRequest): Promise<OrgSettings> {
    return apiClient.put<OrgSettings>('/orgs/current/settings', req)
  },

  // ---------- Invites ----------

  // Authed OWNER/ADMIN — POST /orgs/current/invites
  async sendInvite(req: SendInviteRequest): Promise<SendInviteResponse> {
    return apiClient.post<SendInviteResponse>('/orgs/current/invites', req)
  },

  // Authed OWNER/ADMIN — GET /orgs/current/invites
  async listInvites(): Promise<ListInvitesResponse> {
    return apiClient.get<ListInvitesResponse>('/orgs/current/invites')
  },

  // Authed OWNER/ADMIN — DELETE /orgs/current/invites/{token}
  async revokeInvite(token: string): Promise<void> {
    return apiClient.del<void>(`/orgs/current/invites/${encodeURIComponent(token)}`)
  },

  // ---------- Roles ----------

  // Authed — GET /orgs/current/roles returns the role records + permission catalog.
  // Members get role names only (no permission lists); role.manage holders see all.
  async listRoles(): Promise<ListRolesResponse> {
    return apiClient.get<ListRolesResponse>('/orgs/current/roles')
  },

  // Authed (role.manage) — POST /orgs/current/roles
  async createRole(req: { name: string; permissions: string[] }): Promise<Role> {
    return apiClient.post<Role>('/orgs/current/roles', req)
  },

  // Authed (role.manage) — PUT /orgs/current/roles/{roleId}
  async updateRole(
    roleId: string,
    req: { name?: string; permissions?: string[] },
  ): Promise<Role> {
    return apiClient.put<Role>(
      `/orgs/current/roles/${encodeURIComponent(roleId)}`,
      req,
    )
  },

  // Authed (role.manage) — DELETE /orgs/current/roles/{roleId}
  async deleteRole(roleId: string): Promise<void> {
    return apiClient.del<void>(`/orgs/current/roles/${encodeURIComponent(roleId)}`)
  },

  // Pipelines list is folded into GET /orgs/current — use `useTenant().current?.pipelines`
  // or the `usePipelines()` hook. CRUD routes below hit the pipelines_router
  // Lambda (not yet wired into CDK; pending nested-stack refactor).

  async createPipeline(req: {
    name: string
    statuses: Array<{ id: string; label: string; color: string; isTerminal?: boolean }>
    isDefault?: boolean
  }): Promise<Pipeline> {
    return apiClient.post<Pipeline>('/orgs/current/pipelines', req)
  },

  async updatePipeline(
    pipelineId: string,
    req: {
      name?: string
      statuses?: Array<{ id: string; label: string; color: string; isTerminal?: boolean }>
      isDefault?: boolean
    },
  ): Promise<Pipeline> {
    return apiClient.put<Pipeline>(
      `/orgs/current/pipelines/${encodeURIComponent(pipelineId)}`,
      req,
    )
  },

  async deletePipeline(pipelineId: string): Promise<void> {
    return apiClient.del<void>(
      `/orgs/current/pipelines/${encodeURIComponent(pipelineId)}`,
    )
  },

  // Authed (settings.edit) — GET /orgs/current/audit
  // Paginated reverse-chronological audit log. Not yet wired in CDK;
  // UI renders empty-state until endpoint deploys.
  async listAudit(params: {
    limit?: number
    cursor?: string | null
    action?: string | null
  } = {}): Promise<ListAuditResponse> {
    const qs = new URLSearchParams()
    if (params.limit) qs.set('limit', String(params.limit))
    if (params.cursor) qs.set('cursor', params.cursor)
    if (params.action) qs.set('action', params.action)
    const suffix = qs.toString() ? `?${qs}` : ''
    return apiClient.get<ListAuditResponse>(`/orgs/current/audit${suffix}`)
  },

  // Public — POST /invites/{token}/accept (invited user sets password)
  async acceptInvite(
    token: string,
    req: AcceptInviteRequest,
  ): Promise<AcceptInviteResponse> {
    return apiClient.post<AcceptInviteResponse>(
      `/invites/${encodeURIComponent(token)}/accept`,
      req,
    )
  },

  // OWNER only — POST /orgs/current/transfer-ownership. Promotes the
  // target user to OWNER and demotes the current OWNER to ADMIN.
  // Irreversible without the new owner's cooperation — the UI triple-
  // confirms (target selection, typed email, explicit button).
  async transferOwnership(req: {
    newOwnerUserId: string
    confirmEmail: string
  }): Promise<{
    previousOwnerId: string
    newOwnerId: string
    transferredAt: string
  }> {
    return apiClient.post('/orgs/current/transfer-ownership', req)
  },

  // OWNER only — schedule the workspace for deletion. 30-day grace
  // window; owner can call undelete() at any point during it. Typed-
  // slug confirmation is the typo guard (matches the typed-email
  // pattern on transfer-ownership). Response includes the updated
  // org record with status=PENDING_DELETION and deleted_at set.
  async deleteWorkspace(confirmSlug: string): Promise<{
    org: { status: string; deletedAt: string | null }
    alreadyPending?: boolean
  }> {
    return apiClient.post('/orgs/current/delete', { confirmSlug })
  },

  // OWNER only — reverse a pending deletion. Only valid while status
  // is PENDING_DELETION; backend returns 400 otherwise.
  async undeleteWorkspace(): Promise<{
    org: { status: string; deletedAt: string | null }
  }> {
    return apiClient.post('/orgs/current/undelete', {})
  },

  // OWNER only — generate a JSON export of every tenant-scoped row
  // (config + tenant data + audit log). Response includes a 24h-TTL
  // presigned GET URL. Sync endpoint — may take tens of seconds on
  // large tenants.
  async exportWorkspace(): Promise<{
    downloadUrl: string
    expiresInSeconds: number
    sizeBytes: number
    itemCount: number
  }> {
    return apiClient.post('/orgs/current/export', {})
  },
}
