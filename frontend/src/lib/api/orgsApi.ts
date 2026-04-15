import { apiClient } from './client'
import type {
  CurrentOrgResponse,
  OrgSummary,
  SignupRequest,
  SignupResponse,
} from '@/types/org'

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
}
