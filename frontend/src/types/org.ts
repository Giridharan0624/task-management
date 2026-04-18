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
  status: 'ACTIVE' | 'SUSPENDED'
  planTier: 'FREE' | 'PRO' | 'ENTERPRISE'
  createdAt: string
  updatedAt: string
}

export interface OrgSettings {
  orgId: string
  displayName: string
  logoUrl: string | null
  faviconUrl: string | null
  primaryColor: string
  accentColor: string
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
}

export interface SignupRequest {
  orgName: string
  slug: string
  ownerName: string
  ownerEmail: string
  password: string
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
  roleId?: 'admin' | 'member'
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
