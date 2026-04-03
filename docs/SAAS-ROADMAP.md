# TaskFlow SaaS Transformation Roadmap

## Current State

TaskFlow is a **single-tenant** serverless task management system. One company (NEUROSTACK) uses it with all data in a shared DynamoDB table, a single Cognito user pool, and no billing or self-signup capability.

To become a **multi-tenant SaaS product**, the following changes are required across 6 phases.

---

## Phase 1: Multi-Tenancy Foundation

**Goal:** Add organization/tenant concept to the entire data model.

### 1.1 Organization Entity
Create a new `Organization` entity:
```
Fields:
- org_id (UUID)
- name (company name)
- slug (URL-friendly name, e.g., "neurostack")
- owner_user_id
- logo_url
- domain (custom domain, optional)
- company_prefix (for employee IDs, e.g., "NS")
- timezone (default: "Asia/Kolkata")
- departments (list of strings — configurable per org)
- plan (FREE / PRO / ENTERPRISE)
- plan_expires_at
- max_users (based on plan)
- max_projects (based on plan)
- created_at
- updated_at
```

**DynamoDB Key:**
```
PK: ORG#{org_id}
SK: METADATA
GSI1PK: ORG_SLUG#{slug}
GSI1SK: METADATA
```

### 1.2 Add org_id to All Entities
Every existing entity gets an `org_id` field:

| Entity | New Key Pattern |
|--------|----------------|
| User | PK: `ORG#{org_id}#USER#{user_id}`, SK: `PROFILE` |
| Project | PK: `ORG#{org_id}#PROJECT#{project_id}`, SK: `METADATA` |
| ProjectMember | PK: `ORG#{org_id}#PROJECT#{project_id}`, SK: `MEMBER#{user_id}` |
| Task | PK: `ORG#{org_id}#PROJECT#{project_id}`, SK: `TASK#{task_id}` |
| Attendance | PK: `ORG#{org_id}#USER#{user_id}`, SK: `ATTENDANCE#{date}` |
| DayOff | PK: `ORG#{org_id}#USER#{user_id}`, SK: `DAYOFF#{request_id}` |
| Comment | PK: `ORG#{org_id}#TASK#{task_id}`, SK: `COMMENT#{id}` |
| TaskUpdate | PK: `ORG#{org_id}#TASKUPDATE#{date}`, SK: `USER#{user_id}#{id}` |

### 1.3 Auth Context Injection
- Extract `org_id` from JWT token (stored as `custom:orgId` in Cognito)
- Create middleware that injects `org_id` into every handler's auth context
- All repository queries automatically filter by `org_id`

### 1.4 Data Migration
- Assign existing data to a default org (NEUROSTACK)
- Write a migration script to update all PK/SK patterns
- Backfill `org_id` on all existing records

**Files to modify:** All 8 repositories, all domain entities, all handlers, CDK stack, auth context extractor.

---

## Phase 2: Self-Service Signup & Onboarding

**Goal:** Allow new companies to sign up and onboard themselves.

### 2.1 Company Registration Flow
1. New user visits `/signup`
2. Fills in: Company Name, Admin Name, Admin Email, Password
3. Backend creates:
   - New Organization record in DynamoDB
   - New Cognito user (OWNER role) with `custom:orgId`
   - Default departments (Development, Designing, Management, Research)
   - Free plan subscription
4. Sends verification email
5. Redirects to dashboard

### 2.2 Frontend Pages
- `/signup` — Company registration form
- `/onboarding` — First-time setup wizard (company logo, departments, invite team)
- `/invite` — Accept team invitation page

### 2.3 Team Invitation System
- OWNER/ADMIN can invite users via email
- Generate invite link with token
- Invited user clicks link → sets password → joins the org
- Invite expires after 7 days

### 2.4 Cognito Changes
- Enable self-signup for the registration flow only
- Add `custom:orgId` attribute to user pool
- Store org_id in JWT so it's available on every request

---

## Phase 3: Subscription & Billing

**Goal:** Monetize the platform with subscription plans.

### 3.1 Pricing Plans

| Feature | Free | Pro ($9/user/mo) | Enterprise ($19/user/mo) |
|---------|------|-------------------|--------------------------|
| Users | Up to 5 | Up to 50 | Unlimited |
| Projects | 3 | Unlimited | Unlimited |
| Storage | 1 GB | 10 GB | 100 GB |
| Attendance Tracking | Basic | Advanced + Reports | Advanced + Export |
| Day Off Management | Basic | Advanced | Advanced + Policies |
| Task Updates | No | Yes | Yes |
| Custom Departments | No | Yes | Yes |
| Custom Roles | No | No | Yes |
| Priority Support | No | Email | Email + Chat |
| SSO/SAML | No | No | Yes |
| API Access | No | Yes | Yes |
| Audit Logs | No | No | Yes |
| Data Export | No | CSV | CSV + API |
| White-label | No | No | Yes |

### 3.2 Payment Integration (Stripe)
- Create Stripe customer per organization
- Create Stripe subscription per plan
- Handle webhooks: payment succeeded, failed, subscription cancelled
- Store subscription status in Organization entity
- Implement usage-based billing (per-user pricing)

### 3.3 Billing Dashboard
- `/settings/billing` — View current plan, usage, invoices
- Upgrade/downgrade plan
- Update payment method
- Download invoices
- View payment history

### 3.4 Plan Enforcement
- Middleware checks plan limits before allowing actions
- Show upgrade prompts when limits are reached
- Graceful degradation (don't delete data when downgrading, just restrict access)

---

## Phase 4: Data Isolation & Security

**Goal:** Ensure complete tenant data isolation and security.

### 4.1 Query-Level Isolation
- Every DynamoDB query includes `org_id` in the partition key
- No scan operations cross tenant boundaries
- Repository methods require `org_id` parameter (no default)
- Unit tests verify no cross-tenant data leakage

### 4.2 API Rate Limiting
- Per-tenant rate limits (based on plan)
- Free: 100 requests/minute
- Pro: 1000 requests/minute
- Enterprise: 10000 requests/minute
- Implement via API Gateway usage plans

### 4.3 Audit Logging
Create audit log for all write operations:
```
AuditLog:
- org_id
- user_id
- action (CREATE, UPDATE, DELETE)
- resource_type (USER, PROJECT, TASK, etc.)
- resource_id
- changes (JSON diff)
- ip_address
- timestamp
```

### 4.4 Data Encryption
- DynamoDB encryption at rest (already enabled by default)
- Encrypt sensitive fields (phone, bio) with per-tenant keys
- Implement field-level encryption for Enterprise plan

### 4.5 Compliance
- GDPR data deletion (delete all org data on request)
- Data export (download all org data as JSON/CSV)
- Data retention policies per org
- Cookie consent and privacy policy

---

## Phase 5: Organization Configuration

**Goal:** Make everything configurable per organization.

### 5.1 Dynamic Departments
- Move department list from hardcoded frontend to Organization entity
- OWNER/ADMIN can add/edit/delete departments from settings
- Department changes reflected immediately across the app

### 5.2 Custom Roles (Enterprise)
- Allow orgs to create custom roles beyond ADMIN/MEMBER
- Define permissions per role (can_create_projects, can_manage_users, etc.)
- Role templates: Manager, Team Lead, Intern, Contractor, etc.

### 5.3 Organization Settings Page
```
/settings
├── /general        — Company name, logo, timezone
├── /departments    — Manage departments
├── /roles          — Custom roles (Enterprise)
├── /billing        — Subscription, invoices
├── /security       — Password policy, MFA, SSO
├── /integrations   — API keys, webhooks
├── /branding       — Custom colors, logo, domain
└── /data           — Export, import, retention
```

### 5.4 Branding / White-label (Enterprise)
- Custom logo in sidebar
- Custom colors (primary, accent)
- Custom domain (app.yourcompany.com)
- Custom email sender domain
- Remove "Powered by TaskFlow" footer

### 5.5 Email Customization
- Per-org email sender address (verified via SES)
- Customizable email templates
- Welcome email, invite email, day-off notification templates

---

## Phase 6: Advanced SaaS Features

**Goal:** Enterprise-grade features for scale.

### 6.1 SSO / SAML (Enterprise)
- Support SAML 2.0 federation per org
- Support OAuth/OpenID Connect (Google Workspace, Microsoft 365)
- Auto-provision users from identity provider
- Enforce SSO-only login per org

### 6.2 API Access (Pro/Enterprise)
- Generate API keys per organization
- REST API documentation (Swagger/OpenAPI)
- Webhook subscriptions (task created, user added, etc.)
- Rate limiting per API key

### 6.3 Notifications System
- In-app notifications (bell icon with unread count)
- Email notifications (configurable per user):
  - Task assigned to me
  - Task deadline approaching
  - Day-off request approved/rejected
  - New team member joined
  - Task update submitted
- Push notifications (optional, future)

### 6.4 Integrations
- Slack integration (post task updates to channel)
- Google Calendar integration (sync deadlines)
- Jira import (migrate existing projects)
- CSV import/export for bulk operations

### 6.5 Analytics Dashboard (Pro/Enterprise)
- Team productivity metrics
- Project completion trends
- Attendance patterns
- Time tracking insights
- Exportable reports (PDF, CSV)

### 6.6 Mobile App
- React Native or Flutter app
- Push notifications
- Offline task viewing
- Timer widget for attendance

---

## Technical Architecture Changes

### Current Architecture (Single-Tenant)
```
Frontend (Next.js) → API Gateway → Lambda → DynamoDB (single table)
                                          → Cognito (single pool)
```

### Target Architecture (Multi-Tenant SaaS)
```
Frontend (Next.js)
  ↓
CloudFront (CDN + custom domains)
  ↓
API Gateway (with usage plans per tenant)
  ↓
Lambda (with org_id middleware)
  ↓
┌─────────────┬──────────────┬─────────────┐
│ DynamoDB    │ Cognito      │ S3          │
│ (org-scoped │ (org_id in   │ (file       │
│  partition) │  JWT claims) │  storage)   │
└─────────────┴──────────────┴─────────────┘
  ↓                                ↓
Stripe (billing)            SES (emails)
  ↓                                ↓
CloudWatch (monitoring)     EventBridge (async)
```

### New AWS Services Required
| Service | Purpose |
|---------|---------|
| CloudFront | CDN, custom domains |
| S3 | File storage (avatars, exports) |
| SES | Transactional emails |
| Stripe | Payment processing |
| EventBridge | Async event processing |
| CloudWatch Alarms | Usage monitoring |
| WAF | API protection |
| Secrets Manager | Per-tenant secrets |

### Database Schema Changes
- Add `Organizations` table (or partition in existing table)
- Add `Subscriptions` table
- Add `AuditLogs` table
- Add `Invitations` table
- Add `ApiKeys` table
- Modify all existing entity PK patterns to include `org_id`

---

## Implementation Priority & Timeline Estimate

| Phase | Description | Effort | Priority |
|-------|-------------|--------|----------|
| **Phase 1** | Multi-tenancy foundation | 3-4 weeks | Critical |
| **Phase 2** | Signup & onboarding | 2-3 weeks | Critical |
| **Phase 3** | Billing & subscriptions | 2-3 weeks | High |
| **Phase 4** | Data isolation & security | 2 weeks | High |
| **Phase 5** | Org configuration | 2-3 weeks | Medium |
| **Phase 6** | Advanced features | 4-6 weeks | Low |

**Total estimated effort: 15-22 weeks** for a complete SaaS transformation.

---

## Risk Considerations

1. **Data Migration**: Existing single-tenant data needs careful migration to org-scoped keys without downtime
2. **Breaking Changes**: PK/SK restructuring will break all existing queries — must be atomic
3. **Performance**: Adding org_id to every query may increase DynamoDB read costs
4. **Cognito Limits**: AWS limits Cognito user pools to 1000 per account — may need pool-per-region strategy
5. **Cold Starts**: More Lambda functions (per-tenant config) may increase cold start latency
6. **Cost**: Multi-tenant infrastructure has higher baseline cost — need critical mass of paying customers

---

## Quick Wins (Can Do Now Without Full SaaS)

These improvements can be done immediately without the full multi-tenant rewrite:

1. **Landing page** — Marketing site with pricing, features, signup CTA
2. **Email notifications** — Welcome email, task assignment notifications (via SES)
3. **Custom departments** — Move from hardcoded to database-backed
4. **Data export** — CSV download for all data types
5. **API documentation** — Swagger/OpenAPI spec for existing endpoints
6. **Error monitoring** — CloudWatch alarms + Sentry integration
7. **Custom domain** — CloudFront distribution for the frontend
