# TaskFlow API Reference

**Base URL:** `https://{api-id}.execute-api.ap-south-1.amazonaws.com/prod`
**Auth:** All endpoints require `Authorization: Bearer <JWT>` unless noted.
**Errors:** `{ "error": "message" }` with appropriate HTTP status code.

---

## Users

### `POST /users` — Create user
| Field | Type | Required |
|-------|------|----------|
| email | string | yes |
| name | string | yes |
| system_role | string | no (default: MEMBER) |
| department | string | yes |

**Response:** `201` — User object

### `GET /users` — List all users
**Response:** `200` — Array of user objects

### `GET /users/me` — Get current user profile
**Response:** `200` — User object (auto-creates from JWT if not found)

### `PUT /users/me` — Update profile
| Field | Type | Required |
|-------|------|----------|
| name | string | no |
| phone | string | no |
| designation | string | no |
| location | string | no |
| bio | string | no |
| avatar_url | string | no |
| skills | string[] | no |
| date_of_birth | string | no |
| college_name | string | no |
| area_of_interest | string | no |
| hobby | string | no |

**Response:** `200` — Updated user object

### `GET /users/me/tasks` — Get my tasks
**Response:** `200` — Array of task objects (filtered by role)

### `DELETE /users/{userId}` — Delete user
**Response:** `200` — Confirmation

### `PUT /users/role` — Update user role
| Field | Type | Required |
|-------|------|----------|
| user_id | string | yes |
| system_role | string | yes |

**Response:** `200` — Updated user object

### `PUT /users/department` — Update department
| Field | Type | Required |
|-------|------|----------|
| user_id | string | yes |
| department | string | yes |

**Response:** `200` — Updated user object

### `GET /users/{userId}/progress` — Get user task progress
**Response:** `200` — Progress stats

### `GET /users/admins` — List admin users
**Response:** `200` — Array of admin user objects

### `GET /resolve-employee` — Resolve employee ID to email (NO AUTH)
| Query Param | Type | Required |
|-------------|------|----------|
| employee_id | string | yes |

**Response:** `200` — `{ "email": "..." }`

---

## Projects

### `POST /projects` — Create project
| Field | Type | Required |
|-------|------|----------|
| name | string | yes |
| description | string | no |
| team_lead_id | string | no |
| member_ids | string[] | no (default: []) |

**Response:** `201` — Project object

### `GET /projects` — List projects
**Response:** `200` — Array of project objects

### `GET /projects/{projectId}` — Get project
**Response:** `200` — Project object with members

### `PUT /projects/{projectId}` — Update project
| Field | Type | Required |
|-------|------|----------|
| name | string | no |
| description | string | no |

**Response:** `200` — Updated project object

### `DELETE /projects/{projectId}` — Delete project
**Response:** `200` — Confirmation

### `GET /projects/{projectId}/status` — Get project progress
**Response:** `200` — Progress percentage and task counts

### `POST /projects/{projectId}/members` — Add member
| Field | Type | Required |
|-------|------|----------|
| user_id | string | yes |
| project_role | string | no (default: MEMBER) |

**Response:** `201` — Member object

### `DELETE /projects/{projectId}/members/{userId}` — Remove member
**Response:** `200` — Confirmation

### `PUT /projects/{projectId}/members/{userId}/role` — Update member role
| Field | Type | Required |
|-------|------|----------|
| project_role | string | yes |

**Response:** `200` — Updated member object

---

## Tasks

### `POST /projects/{projectId}/tasks` — Create task
| Field | Type | Required |
|-------|------|----------|
| title | string | yes |
| description | string | no |
| priority | string | no (LOW/MEDIUM/HIGH) |
| status | string | no (TODO/IN_PROGRESS/DONE) |
| assigned_to | string[] | no (default: []) |
| deadline | string | yes |
| estimated_hours | float | no |

**Response:** `201` — Task object

### `GET /projects/{projectId}/tasks` — List project tasks
**Response:** `200` — Array of task objects

### `GET /projects/{projectId}/tasks/{taskId}` — Get task
**Response:** `200` — Task object

### `PUT /projects/{projectId}/tasks/{taskId}` — Update task
| Field | Type | Required |
|-------|------|----------|
| title | string | no |
| description | string | no |
| status | string | no |
| priority | string | no |
| assigned_to | string[] | no |
| deadline | string | no |

**Response:** `200` — Updated task object

### `DELETE /projects/{projectId}/tasks/{taskId}` — Delete task
**Response:** `200` — Confirmation

### `PUT /projects/{projectId}/tasks/{taskId}/assign` — Assign task
| Field | Type | Required |
|-------|------|----------|
| assigned_to | string[] | yes |

**Response:** `200` — Updated task object

### `POST /direct-tasks` — Create standalone task
Same body as `POST /projects/{projectId}/tasks` (project_id auto-set to "DIRECT")

**Response:** `201` — Task object

### `GET /direct-tasks` — List standalone tasks
**Response:** `200` — Array of task objects

---

## Comments

### `POST /projects/{projectId}/tasks/{taskId}/comments` — Add comment
| Field | Type | Required |
|-------|------|----------|
| message | string | yes |

**Response:** `201` — Comment object

### `GET /projects/{projectId}/tasks/{taskId}/comments` — List comments
**Response:** `200` — Array of comment objects

---

## Attendance

### `POST /attendance/sign-in` — Start session
| Field | Type | Required |
|-------|------|----------|
| task_id | string | no |
| project_id | string | no |
| task_title | string | no |
| project_name | string | no |

**Response:** `201` — Attendance record

### `PUT /attendance/sign-out` — End session
**Response:** `200` — Updated attendance record

### `GET /attendance/me` — My attendance
| Query Param | Type | Required |
|-------------|------|----------|
| date | string (YYYY-MM-DD) | no (default: today) |

**Response:** `200` — Attendance record

### `GET /attendance/today` — All users' attendance today
**Response:** `200` — Array of attendance records with live session info

### `GET /attendance/report` — Monthly attendance report
| Query Param | Type | Required |
|-------------|------|----------|
| month | string (YYYY-MM) | yes |

**Response:** `200` — Array of daily attendance summaries

---

## Day Off Requests

### `POST /day-offs` — Request day off
| Field | Type | Required |
|-------|------|----------|
| start_date | string | yes |
| end_date | string | yes |
| reason | string | yes |

**Response:** `201` — DayOff request (status: PENDING)

### `GET /day-offs/my` — My requests
**Response:** `200` — Array of day-off requests

### `GET /day-offs/pending` — Pending approvals (CEO/MD only)
**Response:** `200` — Array of pending requests

### `GET /day-offs/all` — All requests (admin view)
**Response:** `200` — Array of all requests

### `PUT /day-offs/{requestId}/approve` — Approve request
**Response:** `200` — Updated request (status: APPROVED)

### `PUT /day-offs/{requestId}/reject` — Reject request
**Response:** `200` — Updated request (status: REJECTED)

---

## Task Updates

### `POST /task-updates` — Submit daily update
Auto-built from attendance records. Returns update with task summaries and time totals.

**Response:** `201` — TaskUpdate object

### `GET /task-updates` — List all updates
**Response:** `200` — Array of task update objects

### `GET /task-updates/me` — My updates
**Response:** `200` — Array of my task update objects
