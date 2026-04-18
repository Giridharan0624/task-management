import { apiClient } from './client'
import type {
  AcceptInviteRequest,
  AcceptInviteResponse,
  CurrentOrgResponse,
  ListInvitesResponse,
  OrgSettings,
  OrgSummary,
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
}
