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
* Cloudinary — avatar image hosting

---

## 2. Objectives

* Build a fully serverless application on AWS
* Implement 5-tier system RBAC (OWNER > CEO > MD > ADMIN > MEMBER)
* Implement 4-tier project RBAC (ADMIN > PROJECT_MANAGER > TEAM_LEAD > MEMBER)
* Support domain-specific task pipelines (Development, Designing, Management, Research)
* Clockify-style live time tracking with task switching
* Comprehensive reporting (Summary, Detailed, Weekly views)
* Attendance monitoring with team-wide visibility
* Day-off request workflow with approval/rejection/cancellation
* Dark mode with comprehensive theme system
* Follow Domain-Driven Design (DDD) with clean architecture layers

---

## 3. Target Users

| Role | Description |
|---|---|
| **OWNER** | System administrator — manages all users, projects, company settings |
| **CEO** | Full system access, approves day-offs, manages admins and members |
| **MD** | Full system access, approves day-offs, manages admins and members |
| **ADMIN** | Project manager — creates projects, assigns tasks, manages members |
| **MEMBER** | Team member — works on assigned tasks, tracks time, updates status |

---

## 4. Features

### 4.1 Authentication & Authorization
* Login via email or Employee ID (auto-resolved to email)
* AWS Cognito SRP authentication (password never sent to server)
* JWT stored in localStorage with automatic expiry check (60s interval)
* First-login password change flow (OTP → set new password)
* Forgot password with verification code
* 5-tier system RBAC enforced at use case layer
* 4-tier project RBAC (ADMIN, PROJECT_MANAGER, TEAM_LEAD, MEMBER)

### 4.2 User Management
* OWNER creates CEO, MD, ADMIN, MEMBER
* CEO/MD creates ADMIN, MEMBER
* ADMIN creates MEMBER only
* Employee ID format: `{PREFIX}-{DEPT}-{YY}{HASH}` (e.g., NS-DEV-26A7K3)
* Company prefix configurable by OWNER from profile
* Department-based employee IDs (DEV, DES, MGT, RSH, GEN)
* Welcome email with OTP via Gmail SMTP (Secrets Manager)
* User profile with avatar (Cloudinary), bio, skills, personal info
* Profile completeness indicator
* Online status indicators (from attendance data)

### 4.3 Project Management
* Projects have a name, description, domain, and estimated hours
* **4 domains**: Development, Designing, Management, Research
* Each domain determines the task pipeline steps
* Project health indicators (ON_TRACK, AT_RISK, BEHIND, COMPLETED)
* Project progress with weighted scoring
* Upcoming deadlines widget
* Project-level time reports
* Breadcrumb navigation

### 4.4 Task Management — Domain-Specific Pipelines

| Domain | Pipeline Steps |
|---|---|
| **Development** | To Do → In Progress → Developed → Code Review → Testing → Debugging → Final Testing → Done |
| **Designing** | To Do → In Progress → Wireframe → Design → Review → Revision → Approved → Done |
| **Management** | To Do → In Progress → Planning → Execution → Review → Done |
| **Research** | To Do → In Progress → Research → Analysis → Documentation → Review → Done |

* Tasks inherit domain from their project
* Direct tasks (no project) can select their own domain
* Multi-assignee support with required deadlines
* Priority levels: LOW, MEDIUM, HIGH
* Status-based progress scores (auto-calculated per domain)
* Pipeline list view with collapsible status groups
* Search, sort (priority/deadline/title/status), filter (priority/assignee/overdue)
* Quick status change on task rows (hover dropdown)
* Deadline overdue detection (date-only = end of day)
* Task detail panel with progress track, assignee management, comments

### 4.5 Time Tracking (Clockify-style)
* Select source → select task → start timer
* **Meeting** option — one-click meeting tracking (no task required)
* "What are you working on?" description field
* Live timer ticking in real-time (00:00:00 format)
* Timer visible in sidebar on every page
* Task switching auto-stops current timer, starts new
* Daily target progress ring (8-hour goal)
* Quick-restart last task button
* Optimistic UI — timer starts instantly (no waiting for API)
* Session description stored and shown in task updates
* Timer descriptions included in reports

### 4.6 Attendance
* Sign-in/sign-out with task and project tracking
* Multiple sessions per day with cumulative hours
* Team attendance table with live timers for active users
* Monthly attendance reports with CSV export
* Per-member summary (days present, total hours, avg/day, distribution)
* Per-task breakdown
* Expandable daily records with session details
* Member filter and search
* Day-off integration (shows who's on leave)

### 4.7 Day-Off Requests
* Members request single-day or multi-day leave
* Auto-routed to CEO/MD for approval
* Approve/Reject by CEO/MD
* **Cancel by member** (pending or approved requests)
* Day-off banner showing who's on leave today
* Filter by status: ALL, PENDING, APPROVED, REJECTED, CANCELLED
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

**Shared features**: Period selector (Daily/Weekly/Monthly/All Time), date navigation, member filter, live auto-refresh (60s), `formatDuration` (Xh Ym Zs) everywhere

### 4.9 Dashboard
* **Timer** as hero element (Admin/Member) — first thing visible
* Overdue tasks alert (red card)
* 4 stat cards with sparkline mini-charts (7-day trend)
* Upcoming deadlines (next 3 days)
* Project progress mini-cards with completion bars
* Team attendance table
* Quick action cards
* Task update submission widget
* Date display in greeting

### 4.10 Task Updates
* Auto-generated from attendance sessions
* Includes timer description ("What are you working on?")
* Project-grouped task summaries with time bars
* Sign-in/sign-out display
* "Still working" warning (blocks submit if timer active)
* Admin view: date navigation, search, stats, CSV export
* Pending yesterday's update prompt

### 4.11 Profile
* Avatar upload with image cropping (Cloudinary)
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
* **Notification Center** — bell icon with overdue tasks, deadline alerts, timer warnings
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

---

## 5. System Roles & Permissions

### System Roles (5-tier)

| Permission | OWNER | CEO | MD | ADMIN | MEMBER |
|---|---|---|---|---|---|
| Create CEO/MD | Yes | No | No | No | No |
| Create Admin | Yes | Yes | Yes | No | No |
| Create Member | Yes | Yes | Yes | Yes | No |
| Approve Day-offs | No | Yes | Yes | No | No |
| Manage Projects | Yes | Yes | Yes | Yes | No |
| View Reports | Yes | Yes | Yes | Yes | No |
| View All Tasks | Yes | Yes | Yes | Yes | No |
| Use Timer | No | No | No | Yes | Yes |
| Submit Task Update | No | No | No | Yes | Yes |

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
| employee_id | string? | Format: NS-DEV-26A7K3 |
| email | string | Unique, immutable |
| name | string | Editable |
| system_role | enum | OWNER, CEO, MD, ADMIN, MEMBER |
| department | string? | Development, Designing, Management, Research |
| company_prefix | string? | OWNER only — used for employee ID generation |
| phone, designation, location, bio | string? | Profile fields |
| avatar_url | string? | Cloudinary URL |
| skills | list[string] | Skill tags |
| date_of_birth, college_name, area_of_interest, hobby | string? | Personal info |
| created_by | string? | Creator's user ID |
| created_at, updated_at | datetime | ISO 8601 |

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
| description | string? | "What are you working on?" |

### DayOffRequest
| Field | Type | Notes |
|---|---|---|
| request_id | UUID | |
| user_id | string | |
| start_date, end_date | string | ISO dates |
| reason | string | |
| status | enum | PENDING, APPROVED, REJECTED, CANCELLED |
| admin_id, admin_name | string? | Approver |

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
* Secrets Manager for Gmail SMTP credentials (not hardcoded)
* CORS restricted to frontend domain + localhost
* RBAC enforced at both API Gateway and use case layer
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
| Frontend | Vercel + localhost | Next.js 16 |
| Images | Cloudinary | Unsigned avatar uploads |
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

- [x] 5-tier system RBAC (OWNER > CEO > MD > ADMIN > MEMBER)
- [x] 4-tier project RBAC (ADMIN > PM > TEAM_LEAD > MEMBER)
- [x] Domain-specific task pipelines (Development, Designing, Management, Research)
- [x] Clockify-style live time tracking with descriptions
- [x] Meeting tracking (no task required)
- [x] Reports: Summary, Detailed, Weekly views
- [x] Project-level reports with charts
- [x] Attendance monitoring with CSV export
- [x] Day-off workflow (request/approve/reject/cancel)
- [x] Task updates with timer descriptions
- [x] Dark mode with comprehensive theme system
- [x] Command palette (Cmd+K)
- [x] Notification center
- [x] Toast notifications
- [x] Custom confirmation dialogs
- [x] Employee ID: PREFIX-DEPT-YYHASH format
- [x] Profile completeness tracking
- [x] Sparkline charts in dashboard
- [x] Skeleton loaders
- [x] Breadcrumbs
- [x] All native elements replaced with custom components
- [x] Deadline overdue = end of day for date-only deadlines
- [x] AWS Secrets Manager for credentials
- [x] DynamoDB Point-in-Time Recovery
- [x] CORS restricted to allowed origins
- [x] 15+ backend unit tests

---

## 12. Future Enhancements

* Real-time updates via WebSockets
* File attachments on tasks (S3)
* Drag-and-drop task reordering
* Activity feed / audit log
* Project notes / wiki
* Milestones / phases
* Mobile-optimized bottom navigation
* Onboarding tour for new users
* Pagination for large datasets
* Email notifications for task assignments
