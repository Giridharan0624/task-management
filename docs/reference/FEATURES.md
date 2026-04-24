# TaskFlow — Feature Reference

A comprehensive inventory of every user-facing feature in the TaskFlow task management system, grouped by functional area. Paths in brackets link to the relevant source.

---

## 1. Authentication & Authorization

Secure multi-factor authentication via AWS Cognito with JWT tokens and role-based access control at both the system and project level.

- **Login flexibility** — sign in with email or Employee ID (auto-resolved to email).
- **Password flows** — secure password reset with verification codes, forced password change on first login.
- **Welcome email with OTP** for new users, backed by Secrets Manager + SES.
- **System RBAC (3 tiers):** OWNER > ADMIN > MEMBER. Constraints: exactly one OWNER, one CEO, one MD.
- **Project RBAC (4 tiers):** ADMIN > PROJECT_MANAGER > TEAM_LEAD > MEMBER.
- **Live role sync** — backend re-reads roles from DynamoDB on every API call; frontend polls `/users/me` every 15s so role changes apply without re-login.
- **Desktop keystore** — tokens stored securely via Windows Credential Manager / macOS Keychain / Linux gnome-keyring.

Backend: [backend/src/contexts/user/handlers/](../backend/src/contexts/user/handlers/) • Frontend: [frontend/src/components/auth/](../frontend/src/components/auth/) • Desktop: [desktop/internal/auth/](../desktop/internal/auth/)

---

## 2. User Management

- **Auto-generated employee IDs** — format `PREFIX-DEPT-YYHASH` (e.g. `NS-DEV-26AK76`). Company prefix is configurable by OWNER.
- **Profile completeness ring** tracks 11 fields (name, bio, avatar, skills, phone, designation, location, DOB, college, interests, hobby).
- **Avatar upload** with image cropping, stored on S3 and delivered via CloudFront.
- **Department assignment**, date of joining, skills (rendered as colorful tags with 8 rotating colors).
- **Online/offline indicators** sourced from attendance data; day-off score shown in profile modal.
- **User progress** — tasks done, active tasks, projects, today's hours.
- **Admin user CRUD** — create with role assignment, update role/department, delete (self-delete prevented).
- **Birthday data** exposed to birthday calendar and banner features.

Backend: [backend/src/contexts/user/handlers/](../backend/src/contexts/user/handlers/) • Frontend: [frontend/src/app/(dashboard)/admin/users/](../frontend/src/app/(dashboard)/admin/users/), [frontend/src/app/(dashboard)/profile/](../frontend/src/app/(dashboard)/profile/)

---

## 3. Project Management

- **Four domain types:** Development, Designing, Management, Research — each has its own task pipeline. Changing a project's domain auto-migrates orphaned statuses.
- **Project health indicators:** ON_TRACK, AT_RISK, BEHIND, COMPLETED.
- **Progress tracking** scored from the pipeline; **upcoming deadlines** widget uses calendar-date comparisons.
- **Per-project color** — consistent hash-based gradient used throughout dashboards.
- **Estimated hours budget** tracked per project.
- **Member management** — add/remove members, per-project role updates, max 1 TEAM_LEAD per project.
- **Breadcrumb navigation** on project detail pages.

Backend: [backend/src/contexts/project/handlers/](../backend/src/contexts/project/handlers/) • Frontend: [frontend/src/app/(dashboard)/projects/](../frontend/src/app/(dashboard)/projects/)

---

## 4. Task Management — Domain-Specific Pipelines

- **Pipelines per domain:**
  - **Development:** To Do → In Progress → Developed → Code Review → Testing → Debugging → Final Testing → Done
  - **Designing:** To Do → In Progress → Wireframe → Design → Review → Revision → Approved → Done
  - **Management:** To Do → Planning → In Progress → Execution → Review → Done
  - **Research:** To Do → In Progress → Research → Analysis → Documentation → Review → Done
- **Priority levels:** LOW, MEDIUM, HIGH.
- **Multi-assignee** tasks with required deadlines.
- **Direct tasks** (not tied to a project) with their own domain selection.
- **Pipeline view** with collapsible status groups; **My Tasks** groups by project.
- **Search, sort** (priority/deadline/title/status) and **filter** (priority/assignee/overdue).
- **Quick status change** from task rows; overdue detection by calendar date.
- **Task detail panel** — progress track, assignee management, comments, history/audit trail, estimated hours.

Backend: [backend/src/contexts/task/handlers/](../backend/src/contexts/task/handlers/) • Frontend: [frontend/src/components/task/](../frontend/src/components/task/)

---

## 5. Time Tracking & Attendance

- **Live timer** with task/project selection, one-click "Meeting" mode, mandatory "What are you working on?" description, real-time `HH:MM:SS` ticker.
- **Tab title** updates live via a Web Worker; **favicon** shows a red recording dot when active.
- **Task switching** auto-stops and starts timers; quick-restart for last task; optimistic start.
- **Timestamp-based calculation** — no background process, resilient to refresh and browser close (see [docs/TIMER-ARCHITECTURE.md](TIMER-ARCHITECTURE.md)).
- **Sign-in / sign-out** endpoints record task and project; multiple sessions per day with cumulative hours.
- **Team attendance table** — live timers for active users, online count badge.
- **Monthly reports** with CSV export, per-member and per-task breakdowns, expandable daily records.

Backend: [backend/src/contexts/attendance/handlers/](../backend/src/contexts/attendance/handlers/) • Frontend: [frontend/src/components/attendance/](../frontend/src/components/attendance/)

---

## 6. Activity Monitoring (Desktop)

Cross-platform background monitoring integrated with the TaskFlow desktop app.

- **Input tracking** — keyboard and mouse bucket counters (every 5 min).
- **Idle detection** — Win32 on Windows, IOKit on macOS, `/proc` on Linux.
- **Window & app usage** — active window sampled every 5 s, per-app time breakdown.
- **Periodic screenshots** every 10 min with a 5 s warning notification.
- **Heartbeats** — every 5 min the desktop posts keyboard count, mouse count, active/idle seconds, and app usage.
- **Activity reports** with daily buckets, totals, top-app breakdown, and computed activity score.
- **AI summaries** — Groq API generates daily summaries (key activities, productivity score, flagged concerns).

Desktop: [desktop/internal/monitor/](../desktop/internal/monitor/) • Backend: [backend/src/contexts/activity/handlers/](../backend/src/contexts/activity/handlers/)

---

## 7. Day-Off Request Management

- **Submit requests** with date range and reason; auto-routed to OWNER or any ADMIN.
- **Self-approval prevention** — an ADMIN cannot approve or reject their own request.
- **Cancel** by the requester (pending or approved).
- **Day-off banner** surfaces who's on leave today; filters by ALL / PENDING / APPROVED / REJECTED / CANCELLED.
- **Day-off score** (per month): 100 (0 days), 75 (1–2), 50 (3–5), 25 (6+). Visible in profile modal, day-offs page, and requests table.
- **Team scores overview** for OWNER on the day-offs page.

Backend: [backend/src/contexts/dayoff/handlers/](../backend/src/contexts/dayoff/handlers/) • Frontend: [frontend/src/app/(dashboard)/day-offs/](../frontend/src/app/(dashboard)/day-offs/)

---

## 8. Task Updates & Daily Summaries

- **Auto-generated** from attendance sessions, including the timer's "What are you working on?" description.
- **Project-grouped summaries** with time bars, sign-in / sign-out times.
- **"Still working" warning** blocks submission while a timer is running.
- **Admin view** with date navigation, search, stats, and CSV export.
- **Dashboard prompt** surfaces pending yesterday's update.

Backend: [backend/src/contexts/taskupdate/handlers/](../backend/src/contexts/taskupdate/handlers/) • Frontend: [frontend/src/app/(dashboard)/task-updates/](../frontend/src/app/(dashboard)/task-updates/)

---

## 9. Reporting & Analytics

**Overall reports** (`/reports`) in three views:

- **Summary** — stacked bar chart (hours by project per day), project distribution pie chart, member breakdown, top tasks.
- **Detailed** — full session log table with CSV export.
- **Weekly** — timesheet grid (members × Mon–Sun) with column/row totals.

**Project reports** (per-project tab) — tracked hours, budget %, members, sessions, hours-by-task bar chart, status distribution donut, estimated vs actual chart, member workload stacked bars, collapsible session log with CSV export.

Shared: period selector (Daily/Weekly/Monthly/All Time), date picker, member filter, live auto-refresh, Recharts visualizations.

Frontend: [frontend/src/components/reports/](../frontend/src/components/reports/)

---

## 10. Admin Panel

Centralized administration for users, roles, departments, and company-level configuration. Includes bulk user listing, role promotion/demotion, department assignment, and profile completeness visibility.

Frontend: [frontend/src/app/(dashboard)/admin/](../frontend/src/app/(dashboard)/admin/)

---

## 11. Dashboard & Widgets

- **Timer hero** (for ADMIN/MEMBER) as the first visible element.
- **Overdue tasks alert** and **pending task-update alert** (flags users who worked but didn't submit).
- **4 stat cards** with 7-day sparkline trends: tasks done, active tasks, projects, today's hours.
- **Upcoming deadlines** (next 3 days) and **project progress mini-cards** with per-project colors.
- **Team attendance table** with live timers; **quick action cards** for navigation.
- **Birthday banner** with confetti animation; **day-off banner** for today's leave.

Frontend: [frontend/src/app/(dashboard)/dashboard/page.tsx](../frontend/src/app/(dashboard)/dashboard/page.tsx)

---

## 12. UI / UX Features

- **Command Palette** (Ctrl/Cmd+K) for searching pages, projects, and tasks.
- **Notification Center** with red/indigo badge counts.
- **Custom dialogs, date/time pickers, filter dropdowns** — no browser-native popups.
- **Skeleton loaders**, **sparkline micro-charts**, **breadcrumbs**, **progress animations**.
- **Dark mode** via comprehensive CSS variables.
- **Collapsible sidebar** with persistent mini timer widget.
- **Walkthrough tour** on first login.
- **React Query polling** — 10s (critical), 15s (profile/comments), 30s (standard), suppressed in hidden tabs, with optimistic updates.

---

## 13. Profile & Personalization

Avatar upload with cropping, quick stats, profile completeness ring, joined date, skills tags, personal info (DOB, college, interests, hobby), bio, designation, phone, location, theme toggle, password change, and the OWNER-only company prefix setting with format preview.

Frontend: [frontend/src/app/(dashboard)/profile/page.tsx](../frontend/src/app/(dashboard)/profile/page.tsx)

---

## 14. File Upload & Media

Presigned S3 URLs for avatar uploads, CloudFront delivery, client-side image cropping, CORS-enabled bucket, cache invalidation via CloudFront.

Backend: [backend/src/contexts/upload/handlers/presign.py](../backend/src/contexts/upload/handlers/presign.py)

---

## 15. Comments & Collaboration

Task-level commenting with timestamps, user attribution, 15 s auto-refresh polling, and optimistic updates. Scoped to individual tasks.

Backend: [backend/src/contexts/comment/handlers/](../backend/src/contexts/comment/handlers/)

---

## 16. Employee Resolution (Public)

Public endpoint `/resolve-employee?employee_id=...` that resolves employee IDs (e.g. `NS-OWNER`, `NS-26AK76`, `NS-DEV-26AK76`) to the associated email. Used to allow login by employee ID.

Backend: [backend/src/contexts/user/handlers/resolve_employee.py](../backend/src/contexts/user/handlers/resolve_employee.py)

---

## 17. Birthday Calendar

- **Dashboard banner** on the day with confetti animation.
- **Dedicated page** highlighting today and the next 30 days, with avatar / designation / department cards.
- **Cake-cut animation modal** for interactive celebration.

Frontend: [frontend/src/app/(dashboard)/birthdays/page.tsx](../frontend/src/app/(dashboard)/birthdays/page.tsx)

---

## 18. Desktop App (Wails + Go)

Native cross-platform client (Windows, macOS, Linux) that wraps the web UI and adds:

- **Activity monitoring** (see §6).
- **System tray** — show/hide window, stop timer, quit, balloon notifications.
- **Secure keystore auth** with session restoration.
- **Background services** — activity monitor, auto-start/stop timer on login/logout, auto-sign-out before quitting.
- **Silent update checker** on startup.
- **Idle-based auto-sign-out** (user-configured timeout).

Desktop: [desktop/app.go](../desktop/app.go), [desktop/internal/](../desktop/internal/)

---

## 19. Infrastructure & Data

Serverless AWS backend with a DDD layout: handlers → use cases → domain → infrastructure.

- **Python 3.12 Lambda** behind API Gateway (REST).
- **Single-table DynamoDB** with GSI1/GSI2, Pay-Per-Request, Point-in-Time Recovery.
- **Cognito User Pool** with SRP auth.
- **SES** for transactional email; **Secrets Manager** for SMTP credentials.
- **S3 + CloudFront** for avatar hosting.
- **Lambda layers** for shared auth, responses, and repositories.

Backend stack: [backend/cdk/](../backend/cdk/) • Contexts: [backend/src/contexts/](../backend/src/contexts/)

---

## Architecture Highlights

1. Stateless Lambdas routed via API Gateway.
2. Repository pattern abstracts DynamoDB.
3. Auth context injection on every request enforces RBAC.
4. Polling-based real-time sync (10–30 s) with background-tab suppression — no WebSockets.
5. Optimistic UI updates on tasks, users, day-offs, and comments.
6. Clean split between system roles (OWNER/ADMIN/MEMBER) and project roles (ADMIN/PM/TEAM_LEAD/MEMBER).
7. Timestamp-based timer calculation — recomputed on render, survives refresh.
