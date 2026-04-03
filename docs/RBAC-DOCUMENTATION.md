# TaskFlow — Role-Based Access Control (RBAC) Documentation

> Complete reference for all permission rules enforced by the system.
> Last updated: 2026-04-02

---

## 1. Role Hierarchy

```
OWNER  >  CEO  >  MD  >  ADMIN  >  MEMBER
|______ TOP_TIER ______|
|_________ PRIVILEGED _________|
```

| Group | Roles | Description |
|-------|-------|-------------|
| **TOP_TIER** | OWNER, CEO, MD | Executive-level access. Nearly identical privileges. |
| **PRIVILEGED** | OWNER, CEO, MD, ADMIN | Can manage users, projects, and tasks. |
| **MEMBER** | MEMBER | Basic access. Can only work on assigned tasks. |

### System Role Constraints

- Only **1 OWNER** exists (created at system setup).
- Only **1 CEO** and **1 MD** allowed system-wide.
- OWNER cannot be created, deleted, or demoted.

---

## 2. Project Roles

Each user can have a **project-level role** independent of their system role.

| Project Role | Can Manage Tasks | Can Manage Members |
|-------------|-----------------|-------------------|
| ADMIN | Yes | Yes |
| PROJECT_MANAGER | Yes | Yes |
| TEAM_LEAD | Yes | Yes |
| MEMBER | No (status only) | No |

**Constraint**: Only 1 TEAM_LEAD per project.

**Task Management Roles** = Project ADMIN, PROJECT_MANAGER, TEAM_LEAD

---

## 3. User Management

### 3.1 List Users

| Caller | Can List | Sees |
|--------|----------|------|
| OWNER / CEO / MD | Yes | All users |
| ADMIN | Yes | MEMBER users only |
| MEMBER | No | — |

### 3.2 Create User

| Caller | Can Create |
|--------|-----------|
| OWNER | CEO, MD, ADMIN, MEMBER |
| CEO / MD | ADMIN, MEMBER |
| ADMIN | MEMBER only |
| MEMBER | No |

**Constraints**:
- Cannot create an OWNER account.
- Only OWNER can create CEO or MD.
- Only 1 CEO and 1 MD allowed (enforced at creation).
- Email must be unique.
- Auto-generates employee ID (format: `PREFIX-DEPT-YYHASH`).
- Sends welcome email with temporary password (OTP).

### 3.3 Update User Role

| Caller | Can Change | Target Roles |
|--------|-----------|-------------|
| OWNER | ADMIN, MEMBER | Can promote to CEO, MD, ADMIN, MEMBER |
| CEO / MD | No | — |
| ADMIN | No | — |
| MEMBER | No | — |

**Constraints**:
- Cannot change another TOP_TIER user's role.
- Cannot promote anyone to OWNER.
- Only OWNER can promote to CEO or MD.
- Role change syncs to both DynamoDB and Cognito.
- Backend RBAC reads role from DynamoDB (takes effect immediately, no re-login needed).

### 3.4 Delete User

| Caller | Can Delete |
|--------|-----------|
| OWNER / CEO / MD | Anyone except TOP_TIER users |
| ADMIN | MEMBER only |
| MEMBER | No |

**Constraints**:
- Cannot delete self.
- Cannot delete OWNER.
- Cascade: removes from all project memberships + deletes from Cognito.

### 3.5 View User Progress

| Caller | Can View |
|--------|---------|
| OWNER / CEO / MD | Anyone's progress |
| ADMIN | MEMBER progress only |
| MEMBER | No |

---

## 4. Project Management

### 4.1 Permission Matrix

| Action | OWNER/CEO/MD | ADMIN | Project ADMIN/PM/TL | MEMBER |
|--------|-------------|-------|---------------------|--------|
| Create project | Yes | Yes | — | No |
| View project | Any project | Any project | Their project | Their project |
| List projects | All projects | All projects | — | Own projects only |
| Update project | Any project | Any project | Their project | No |
| Delete project | Any project | Any project | Their project | No |
| Add member | Any project | Any project | Their project | No |
| Remove member | Any project | Any project | Their project | No |
| Change member role | Any project | Any project | Their project | No |

### 4.2 Project Creation Details

- Requires: name, description, domain, team lead, members.
- Team lead assigned PROJECT_MANAGER or TEAM_LEAD role automatically.
- All specified members must exist in the system.
- Domain determines the task pipeline (see Section 5.2).

### 4.3 Member Role Constraints

- Only 1 TEAM_LEAD per project.
- Existing TEAM_LEAD must be demoted before promoting another.
- Member addition tracks who added them (`added_by`).

---

## 5. Task Management

### 5.1 Permission Matrix

| Action | OWNER/CEO/MD | ADMIN | Project ADMIN/PM/TL | Project MEMBER |
|--------|-------------|-------|---------------------|----------------|
| Create task | Any project | Any project | Their project | **No** |
| View tasks | All tasks | All tasks | All project tasks | **Assigned only** |
| Update any field | Yes | Yes | Yes | **No** |
| Update status only | Yes | Yes | Yes | **Assigned tasks only** |
| Delete task | Any task | Any task | Their project | **No** |
| Assign task | Any task | Any task | Their project | **No** |

### 5.2 Domain-Specific Task Pipelines

Each project has a domain that determines valid task statuses:

| Domain | Pipeline Stages |
|--------|----------------|
| **DEVELOPMENT** | TODO → IN_PROGRESS → DEVELOPED → CODE_REVIEW → TESTING → DEBUGGING → FINAL_TESTING → DONE |
| **DESIGNING** | TODO → IN_PROGRESS → WIREFRAME → DESIGN → REVIEW → REVISION → APPROVED → DONE |
| **MANAGEMENT** | TODO → IN_PROGRESS → PLANNING → EXECUTION → REVIEW → DONE |
| **RESEARCH** | TODO → IN_PROGRESS → RESEARCH → ANALYSIS → DOCUMENTATION → REVIEW → DONE |

### 5.3 Task Update Rules (for MEMBER role)

Members can **ONLY** update the `status` field of tasks assigned to them.

**Cannot change**: title, description, deadline, assigned_to, priority, domain, estimated_hours.

Any attempt to update other fields returns: *"Members can only update the status of their assigned tasks."*

### 5.4 Direct Tasks

Direct tasks (project_id = `DIRECT`) are standalone tasks not tied to a project.

- Only PRIVILEGED_ROLES can create, update, and delete direct tasks.
- Members cannot interact with direct tasks.

### 5.5 Task Assignment Rules

- All assignees must be members of the task's project.
- Assignment tracks who assigned (`assigned_by`).
- When a task is assigned and a user signs in to work on it, the status auto-moves to IN_PROGRESS if it was TODO.

---

## 6. Attendance & Time Tracking

### 6.1 Permission Matrix

| Action | OWNER/CEO/MD | ADMIN | MEMBER |
|--------|-------------|-------|--------|
| Sign in / Sign out | Yes | Yes | Yes |
| View own attendance | Yes | Yes | Yes |
| View team attendance (today) | All users | All except TOP_TIER | **No** |
| Attendance report (date range) | All users | All except TOP_TIER | **Own records only** |

### 6.2 Sign-In Rules

- Any authenticated user can sign in.
- Can switch tasks while signed in (closes current session, starts new one).
- If already signed in without specifying a new task, throws error.
- Associates session with current task and project.

### 6.3 Attendance Report Visibility

- **TOP_TIER**: See all users for any date range.
- **ADMIN**: See all users except TOP_TIER for any date range.
- **MEMBER**: See only own records for any date range.

---

## 7. Day-Off Management

### 7.1 Permission Matrix

| Action | OWNER | CEO / MD | ADMIN | MEMBER |
|--------|-------|---------|-------|--------|
| Request day-off | **No** | **No** | Yes | Yes |
| View own requests | Yes | Yes | Yes | Yes |
| View all requests | Yes | Yes | Yes | No |
| View pending approvals | No | **Yes** | No | No |
| Approve request | No | **Yes** | No | No |
| Reject request | No | **Yes** | No | No |
| Cancel own request | Yes | Yes | Yes | Yes |

### 7.2 Approval Flow

1. ADMIN or MEMBER submits a day-off request.
2. System auto-assigns CEO or MD as the approver.
3. CEO/MD sees it in "Pending Approvals".
4. CEO/MD approves or rejects.
5. Requester can cancel at any time (unless already cancelled).

### 7.3 Constraints

- TOP_TIER (OWNER/CEO/MD) **cannot** request day-offs.
- **Only CEO or MD** can approve/reject requests.
- Request includes: start date, end date, reason.
- Cancellation sets both admin_status and status to CANCELLED.

---

## 8. Comments

| Action | OWNER/CEO/MD | ADMIN | Project Member | MEMBER (not in project) |
|--------|-------------|-------|---------------|------------------------|
| Add comment | Any task | Any task | If assigned to task | No |
| View comments | Any task | If project member | If project member | No |

**Constraint**: Members must be assigned to the specific task to comment on it.

---

## 9. Task Updates (Daily Work Submissions)

### 9.1 Permission Matrix

| Action | OWNER/CEO/MD | ADMIN | MEMBER |
|--------|-------------|-------|--------|
| Submit daily update | Yes | Yes | Yes |
| View all updates | Yes | Yes | **No** |
| View own update | Yes | Yes | Yes |

### 9.2 Submission Rules

- Must have attendance record (time tracking sessions) for the day.
- Can submit for yesterday or today.
- If yesterday has unsubmitted work, must submit yesterday first.
- Cannot submit twice for the same date.
- Auto-generates report from attendance sessions (task hours, descriptions).

---

## 10. Frontend Access Control

### 10.1 Dashboard Views

| Role | Dashboard Component |
|------|-------------------|
| OWNER / CEO / MD | OwnerDashboard (team attendance table, all stats, all projects) |
| ADMIN | AdminDashboard (team attendance, task updates, member management) |
| MEMBER | MemberDashboard (own tasks, own attendance, timer) |

### 10.2 Navigation Items

| Page | OWNER/CEO/MD | ADMIN | MEMBER |
|------|-------------|-------|--------|
| Dashboard | Yes | Yes | Yes |
| All Tasks / My Tasks | All Tasks | Tasks | My Tasks |
| Task Updates | Yes | Yes | **No** |
| Users / Members | Users (full) | Members (limited) | **No** |
| Projects | Yes | Yes | Yes |
| Reports | Yes | Yes | **No** |
| Attendance | Yes | Yes | Yes |
| Day Offs | Yes | Yes | Yes |

### 10.3 Route Protection

- `/admin/*` routes: Accessible to OWNER, CEO, MD, ADMIN only. Others redirected to `/dashboard`.
- Role sync: Dashboard layout polls `/users/me` every 15 seconds. If role changes, UI updates automatically (navigation, dashboard, permissions).
- Backend RBAC: Reads role from DynamoDB on every API call (not JWT). Role changes take effect immediately.

---

## 11. Real-Time Role Change Behavior

When a user's role is changed (e.g., MEMBER → ADMIN):

| Layer | Update Mechanism | Latency |
|-------|-----------------|---------|
| **DynamoDB** | Updated immediately | Instant |
| **Cognito** | Custom attribute synced | Instant |
| **Backend RBAC** | Reads from DynamoDB on each API call | Instant |
| **Frontend UI** | Polls `/users/me` every 15s, syncs to auth context | ~15 seconds |

**What changes automatically**:
- Navigation menu switches (member → admin nav items)
- Dashboard view switches (MemberDashboard → AdminDashboard)
- Admin route access granted/revoked
- Sidebar timer visibility adjusts
- API permissions update immediately

**No re-login required.**
