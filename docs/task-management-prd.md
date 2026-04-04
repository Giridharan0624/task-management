# Product Requirements Document (PRD)

## Project Title

**TaskFlow — Serverless Task Management & Time Tracking System**

---

## 1. Overview

A comprehensive, serverless task management and time tracking platform where organizations manage users, projects, and tasks across multiple domains (Development, Designing, Management, Research). Each domain has its own workflow pipeline. Built-in Clockify-style time tracking, attendance monitoring, reports, and day-off management.

**Tech Stack:**

* AWS Lambda (Python 3.12) — backend logic
* AWS CDK (Python) — infrastructure as code
* API Gateway (REST) — API layer with CORS
* Cognito — authentication (JWT + SRP)
* DynamoDB — single-table database with GSI1 + GSI2
* Secrets Manager — Gmail SMTP credentials
* Next.js 16 (App Router) — frontend
* Tailwind CSS — styling with dark mode support
* TanStack React Query — server state management
* Recharts — data visualization
* S3 + CloudFront — avatar image hosting

---

## 2. Objectives

* Build a fully serverless application on AWS
* Implement 3-tier system RBAC (OWNER > ADMIN > MEMBER)
* Implement 4-tier project RBAC (ADMIN > PROJECT_MANAGER > TEAM_LEAD > MEMBER)
* Support domain-specific task pipelines (Development, Designing, Management, Research)
* Clockify-style live time tracking with task switching
* Comprehensive reporting (Summary, Detailed, Weekly views)
* Attendance monitoring with team-wide visibility
* Day-off request workflow with self-approval prevention
* Dark mode with comprehensive theme system
* Seamless real-time polling for cross-user data sync
* Follow Domain-Driven Design (DDD) with clean architecture layers

---

## 3. Target Users

| Role | Description |
|---|---|
| **OWNER** | Super admin — manages all users, projects, company settings, approves day-offs |
| **ADMIN** | Full management access — creates users/projects, assigns tasks, approves day-offs (not own), tracks time |
| **MEMBER** | Team member — works on assigned tasks, tracks time, requests day-offs |

---

## 4. Features

### 4.1 Authentication & Authorization
* Login via email or Employee ID (auto-resolved to email)
* Employee ID regex supports all formats: `NS-OWNER`, `NS-26AK76`, `NS-DEV-26AK76`
* AWS Cognito SRP authentication (password never sent to server)
* JWT stored in localStorage with automatic expiry check (60s interval)
* First-login password change flow (OTP → set new password)
* Forgot password with verification code
* 3-tier system RBAC enforced at use case layer
* 4-tier project RBAC (ADMIN, PROJECT_MANAGER, TEAM_LEAD, MEMBER)
* **Live role sync**: Backend reads role from DynamoDB (not JWT) on every API call
* **Frontend role sync**: Dashboard polls `/users/me` every 15s, auto-updates auth context
* Role changes take effect immediately without re-login

### 4.2 User Management
* OWNER creates ADMIN, MEMBER
* ADMIN creates ADMIN, MEMBER
* MEMBER cannot create anyone
* Employee ID format: `{PREFIX}-{YY}{HASH}` (e.g., NS-26AK76)
* Company prefix configurable by OWNER from profile
* Date of joining picker in user creation
* Welcome email with OTP via Gmail SMTP (Secrets Manager)
* User profile with avatar (S3 + CloudFront), bio, skills, personal info
* Profile completeness indicator
* Online status indicators (from attendance data)
* Day-off score displayed in user profile modal

### 4.3 Project Management
* Projects have a name, description, domain, and estimated hours
* **4 domains**: Development, Designing, Management, Research
* Domain editable from project settings
* Each domain determines the task pipeline steps
* Domain change auto-migrates orphaned task statuses to TODO
* Project health indicators (ON_TRACK, AT_RISK, BEHIND, COMPLETED)
* Project progress with pipeline-based scoring
* Upcoming deadlines widget (calendar-date comparison, not timestamp)
* Project-level time reports
* Per-project unique color (consistent hash-based gradient)
* Breadcrumb navigation

### 4.4 Task Management — Domain-Specific Pipelines

| Domain | Pipeline Steps |
|---|---|
| **Development** | To Do → In Progress → Developed → Code Review → Testing → Debugging → Final Testing → Done |
| **Designing** | To Do → In Progress → Wireframe → Design → Review → Revision → Approved → Done |
| **Management** | To Do → Planning → In Progress → Execution → Review → Done |
| **Research** | To Do → In Progress → Research → Analysis → Documentation → Review → Done |

* Tasks inherit domain from their project
* Direct tasks (no project) can select their own domain
* Multi-assignee support with required deadlines
* Priority levels: LOW, MEDIUM, HIGH
* Status-based progress scores (auto-calculated per domain)
* Pipeline list view with collapsible status groups
* **Tasks grouped by project** in My Tasks page
* Orphaned statuses (from domain change) fall back to first stage
* Search, sort (priority/deadline/title/status), filter (priority/assignee/overdue)
* Quick status change on task rows (hover dropdown)
* Deadline overdue detection (calendar-date comparison, not timestamp)
* Task detail panel with progress track, assignee management, comments

### 4.5 Time Tracking (Clockify-style)
* Select source → select task → start timer
* **Meeting** option — one-click meeting tracking (no task required)
* "What are you working on?" description field **(required)**
* Description reflected in task updates and reports
* Live timer ticking in real-time (00:00:00 format)
* **Tab title updates live** even in background tabs (Web Worker, not throttled)
* **Favicon shows red recording dot** when timer is active
* Timer visible in sidebar on every page (ADMIN and MEMBER)
* Task switching auto-stops current timer, starts new
* Quick-restart last task button
* Optimistic UI — timer starts instantly (no waiting for API)
* **Running session visible in session list** with live-ticking duration
* Session times spread across available space (flex-wrap layout)

### 4.6 Attendance
* Sign-in/sign-out with task and project tracking
* Multiple sessions per day with cumulative hours
* Team attendance table with live timers for active users
* **Online count shows all users** regardless of active tab/filter
* Monthly attendance reports with CSV export
* Per-member summary (days present, total hours, avg/day, distribution)
* Per-task breakdown
* Expandable daily records with session details
* Member filter and search
* Day-off integration (shows who's on leave)

### 4.7 Day-Off Requests
* **ADMIN and MEMBER** can request day-offs
* OWNER cannot request (no one above to approve)
* Auto-routed to any ADMIN or OWNER for approval
* **Self-approval prevention**: ADMIN cannot approve/reject their own request
* Approve/Reject by OWNER or any other ADMIN
* **Cancel by requester** (pending or approved requests)
* Day-off banner showing who's on leave today
* Filter by status: ALL, PENDING, APPROVED, REJECTED, CANCELLED
* **Day-off score** (per month): 100 (0 days off), 75 (1-2), 50 (3-5), 25 (6+)
* Score shown in: user profile modal, day-offs page, all-requests table
* **Team scores overview** for OWNER on day-offs page
* Custom confirmation dialog (no browser native popups)

### 4.8 Reports — 3 Views

**Overall Reports (`/reports`):**
* **Summary**: Stacked bar chart (hours by project per day), pie chart (distribution), member breakdown with expandable sessions, top tasks by time
* **Detailed**: Full session log table with Date/Member/Project/Task/Start/End/Duration, CSV export
* **Weekly**: Timesheet grid (rows=members, columns=Mon-Sun), column/row totals, today highlighted

**Project Reports (per-project `Reports` tab):**
* Stat cards: Tracked hours, Budget %, Members, Sessions
* Hours by Task bar chart
* Status Distribution donut chart
* Estimated vs Actual hours comparison chart
* Member Workload with stacked task breakdown bars
* Collapsible session log with CSV export

**Shared features**: Period selector (Daily/Weekly/Monthly/All Time), date navigation, member filter, live auto-refresh, `formatDuration` (Xh Ym Zs) everywhere

### 4.9 Dashboard
* **Timer** as hero element (Admin/Member) — first thing visible
* Overdue tasks alert (red card)
* **Pending task updates alert** — shows users who worked today but haven't submitted
* 4 stat cards with sparkline mini-charts (7-day trend)
* Upcoming deadlines (next 3 days, calendar-date comparison)
* Project progress mini-cards with **unique per-project colors**
* Team attendance table
* Quick action cards
* Task update submission widget
* Date display in greeting
* OWNER and ADMIN share the same full dashboard view

### 4.10 Task Updates
* Auto-generated from attendance sessions
* Includes timer description ("What are you working on?") — **mandatory field**
* Project-grouped task summaries with time bars
* Sign-in/sign-out display
* "Still working" warning (blocks submit if timer active)
* Admin view: date navigation, search, stats, CSV export
* Pending yesterday's update prompt

### 4.11 Profile
* Avatar upload with image cropping (S3 + CloudFront)
* Quick stats: tasks done, active tasks, projects, today's hours
* Profile completeness ring (11 fields tracked)
* Joined date display
* Skills as colorful tags (8 rotating colors)
* Personal info form (DOB, college, interests, hobby)
* Company prefix setting (OWNER only) — format preview
* Theme toggle (light/dark)
* Password change

### 4.12 UI/UX Features
* **Command Palette** (Cmd+K / Ctrl+K) — search pages, projects, tasks
* **Notification Center** — bell icon with **total notification count badge** (red for urgent, indigo for info)
* **Toast notifications** — success/error/info feedback
* **Custom confirmation dialogs** — no browser native popups
* **FilterSelect** component — portal-based dropdown for all filters
* **DatePicker + TimePicker** — custom date/time selection (no native pickers)
* **Skeleton loaders** — shimmer loading placeholders
* **Sparkline charts** — inline 7-day trend lines
* **Breadcrumbs** — navigation trail on project pages
* **Dark mode** — comprehensive CSS variable system with 100+ overrides
* **Collapsible sidebar** with mini timer widget
* **Progress bar animations** on mount
* **Live-updating hours** everywhere timer is running
* **Walkthrough tour** — shown once per user on first login
* **Seamless polling** — 10-30s intervals with background tab suppression

### 4.13 Real-Time Data Sync
* React Query polling with tiered intervals:
  * **10s**: Tasks, today's attendance, my tasks (critical)
  * **15s**: My attendance, comments, profile/role sync
  * **30s**: Users, projects, day-offs, task updates (standard)
* `staleTime` matches `refetchInterval` to prevent duplicate fetches
* `refetchIntervalInBackground: false` — zero polling in hidden tabs
* Optimistic updates on: tasks, users, day-offs, comments
* Window focus refetch for instant catch-up

---

## 5. System Roles & Permissions

### System Roles (3-tier)

| Permission | OWNER | ADMIN | MEMBER |
|---|---|---|---|
| Create Admin | Yes | Yes | No |
| Create Member | Yes | Yes | No |
| Change Roles | Yes | No | No |
| Delete Admin | Yes | No | No |
| Delete Member | Yes | Yes | No |
| Approve Day-offs | Yes (any) | Yes (not own) | No |
| Request Day-offs | No | Yes | Yes |
| Manage Projects | Yes | Yes | No |
| View All Users | Yes | Yes | No |
| View Reports | Yes | Yes | No |
| View All Tasks | Yes | Yes | Assigned only |
| Use Timer | No | Yes | Yes |
| Submit Task Update | No | Yes | Yes |
| Company Prefix | Yes | No | No |

### Project Roles (4-tier)

| Permission | ADMIN | PROJECT_MANAGER | TEAM_LEAD | MEMBER |
|---|---|---|---|---|
| Create Tasks | Yes | Yes | Yes | No |
| Update Any Task | Yes | Yes | Yes | No |
| Update Own Status | Yes | Yes | Yes | Yes |
| Assign Tasks | Yes | Yes | Yes | No |
| Manage Members | Yes | Yes | Yes | No |
| View All Tasks | Yes | Yes | Yes | Own Only |
| View Progress | Yes | Yes | Yes | No |
| View Reports | Yes | Yes | Yes | No |

---

## 6. Data Model

### User
| Field | Type | Notes |
|---|---|---|
| user_id | string | Cognito sub (UUID) |
| employee_id | string? | Format: NS-26AK76 |
| email | string | Unique, immutable |
| name | string | Editable |
| system_role | enum | OWNER, ADMIN, MEMBER |
| department | string? | Development, Designing, Management, Research |
| company_prefix | string? | OWNER only — used for employee ID generation |
| phone, designation, location, bio | string? | Profile fields |
| avatar_url | string? | S3 + CloudFront URL |
| skills | list[string] | Skill tags |
| date_of_birth, college_name, area_of_interest, hobby | string? | Personal info |
| created_by | string? | Creator's user ID |
| created_at, updated_at | datetime | ISO 8601 (created_at used as join date) |

### Project
| Field | Type | Notes |
|---|---|---|
| project_id | UUID | |
| name | string | |
| description | string? | |
| domain | enum | DEVELOPMENT, DESIGNING, MANAGEMENT, RESEARCH |
| estimated_hours | float? | For time budget tracking |
| created_by | string | |
| created_at, updated_at | datetime | |

### Task
| Field | Type | Notes |
|---|---|---|
| task_id | UUID | |
| project_id | string | UUID or "DIRECT" |
| title | string | |
| description | string? | |
| status | string | Domain-specific (e.g., TODO, CODE_REVIEW, WIREFRAME) |
| priority | enum | LOW, MEDIUM, HIGH |
| domain | enum | DEVELOPMENT, DESIGNING, MANAGEMENT, RESEARCH |
| assigned_to | list[string] | User IDs |
| assigned_by | string? | |
| created_by | string | |
| deadline | datetime | Required |
| estimated_hours | float? | |
| created_at, updated_at | datetime | |

### Attendance (Session)
| Field | Type | Notes |
|---|---|---|
| sign_in_at | datetime | |
| sign_out_at | datetime? | null if active |
| hours | float? | Calculated on sign-out |
| task_id, project_id | string? | What was worked on |
| task_title, project_name | string? | Denormalized for display |
| description | string | "What are you working on?" (required) |

### DayOffRequest
| Field | Type | Notes |
|---|---|---|
| request_id | UUID | |
| user_id | string | |
| start_date, end_date | string | ISO dates |
| reason | string | |
| status | enum | PENDING, APPROVED, REJECTED, CANCELLED |
| admin_id, admin_name | string? | Approver (auto-assigned, cannot be self) |

---

## 7. DynamoDB Key Design

Single table: **TaskManagementTable** (PAY_PER_REQUEST, Point-in-Time Recovery enabled)

| Item | PK | SK | GSI1PK | GSI1SK | GSI2PK | GSI2SK |
|---|---|---|---|---|---|---|
| User | `USER#{userId}` | `PROFILE` | `USER_EMAIL#{email}` | `PROFILE` | `EMPLOYEE#{empId}` | `PROFILE` |
| Project | `PROJECT#{projectId}` | `METADATA` | — | — | — | — |
| ProjectMember | `PROJECT#{projectId}` | `MEMBER#{userId}` | — | — | — | — |
| Task | `PROJECT#{projectId}` | `TASK#{taskId}` | `TASK#{taskId}` | `PROJECT#{projectId}` | — | — |
| Comment | `TASK#{taskId}` | `COMMENT#{ts}#{id}` | — | — | — | — |
| Attendance | `USER#{userId}` | `ATTENDANCE#{date}` | — | — | — | — |
| DayOff | `USER#{userId}` | `DAYOFF#{ts}#{id}` | — | — | — | — |

---

## 8. Security

* AWS Cognito JWT authentication on all endpoints
* Backend reads authoritative role from DynamoDB (not stale JWT claims)
* Secrets Manager for Gmail SMTP credentials (not hardcoded)
* CORS restricted to frontend domain + localhost
* RBAC enforced at both API Gateway and use case layer
* Self-approval prevention on day-off requests
* Password policy: 8+ chars, uppercase, lowercase, digits
* DynamoDB Point-in-Time Recovery enabled
* No native browser dialogs — custom themed confirmations
* No `console.log` in production code

---

## 9. Infrastructure

| Component | Service | Config |
|---|---|---|
| Compute | AWS Lambda (Python 3.12) | 10s timeout, shared layer |
| Database | DynamoDB | On-demand, PITR enabled |
| Auth | Cognito User Pool | Email sign-in, custom attributes |
| API | API Gateway REST | Cognito authorizer, CORS |
| Secrets | Secrets Manager | Gmail credentials |
| Frontend | Vercel | Next.js 16, auto-deploy on push |
| Images | S3 + CloudFront | Unsigned avatar uploads |
| Email | Gmail SMTP | Welcome emails with OTP |
| Region | ap-south-1 (Mumbai) | |

**Lambda Functions:** 35+ (one per endpoint)
**Deploy:** `cd backend/cdk && cdk deploy`

---

## 10. Custom UI Components

| Component | Replaces |
|---|---|
| `Select` | Native `<select>` (form fields) |
| `FilterSelect` | Native `<select>` (toolbar filters) |
| `DatePicker` | Native `<input type="date">` |
| `TimePicker` | Native `<input type="time">` |
| `DateTimePicker` | Native `<input type="datetime-local">` |
| `ConfirmDialog` | Native `confirm()` |
| `Toast` | Native `alert()` |
| `CommandPalette` | No native equivalent |
| `NotificationCenter` | No native equivalent |
| `Sparkline` | No native equivalent |
| `Skeleton` | Spinner-only loading |
| `EmptyState` | Plain text empty states |
| `Breadcrumbs` | No native equivalent |
| `LiveTimer` | Static time display |

---

## 11. Implemented Features Checklist

- [x] 3-tier system RBAC (OWNER > ADMIN > MEMBER)
- [x] 4-tier project RBAC (ADMIN > PM > TEAM_LEAD > MEMBER)
- [x] Domain-specific task pipelines (Development, Designing, Management, Research)
- [x] Domain editing with auto-migration of orphaned task statuses
- [x] Clockify-style live time tracking with mandatory descriptions
- [x] Meeting tracking (no task required)
- [x] Reports: Summary, Detailed, Weekly views
- [x] Project-level reports with charts
- [x] Attendance monitoring with CSV export
- [x] Day-off workflow with self-approval prevention
- [x] Day-off score (monthly, tier-based)
- [x] Task updates with timer descriptions
- [x] Dark mode with comprehensive theme system (100+ CSS overrides)
- [x] Command palette (Cmd+K)
- [x] Notification center with total count badge
- [x] Toast notifications
- [x] Custom confirmation dialogs
- [x] Employee ID: PREFIX-YYHASH format
- [x] Date of joining picker in user creation
- [x] Profile completeness tracking
- [x] Sparkline charts in dashboard
- [x] Skeleton loaders
- [x] Breadcrumbs
- [x] All native elements replaced with custom components
- [x] Deadline overdue = calendar-date comparison (not timestamp)
- [x] AWS Secrets Manager for credentials
- [x] DynamoDB Point-in-Time Recovery
- [x] CORS restricted to allowed origins
- [x] Seamless real-time polling (10-30s intervals)
- [x] Optimistic updates on mutations
- [x] Background tab polling suppression
- [x] Live role sync (frontend polls /users/me, backend reads DynamoDB)
- [x] Tab title + red dot favicon when timer active
- [x] Web Worker for background tab timer ticking
- [x] Tasks grouped by project in My Tasks page
- [x] Per-project unique colors (hash-based)
- [x] Pending task updates alert on dashboard
- [x] Walkthrough tour (per-user, first login only)
- [x] Onboarding tour for new users

---

## 12. Future Enhancements

* Real-time updates via WebSockets (replace polling)
* Direct task assignment (CEO/Admin to user without project)
* File attachments on tasks (S3)
* Drag-and-drop task reordering
* Activity feed / audit log
* Project notes / wiki
* Milestones / phases
* Mobile-optimized bottom navigation
* Pagination for large datasets
* Email notifications for task assignments
