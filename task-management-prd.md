# Product Requirements Document (PRD)

## Project Title

**Serverless Task Management System**

---

## 1. Overview

A scalable, serverless task management system where an OWNER manages users, creates projects, assigns members, and tracks task progress. Admins and Members collaborate within projects using a kanban-style interface with deadline tracking and progress comments.

**Tech stack:**

* AWS Lambda (Python 3.12) — backend logic
* AWS CDK (Python) — infrastructure as code
* API Gateway (REST) — API layer
* Cognito — authentication (JWT)
* DynamoDB — single-table database
* Next.js 14 (App Router) — frontend
* Tailwind CSS — styling
* React Query — server state management

---

## 2. Objectives

* Build a fully serverless application on AWS
* Implement three-tier RBAC (OWNER > ADMIN > MEMBER) at system and project levels
* Support multi-user collaboration with project-based task organization
* Allow multi-assignee tasks with required deadlines
* Enable progress tracking via task comments
* Follow Domain-Driven Design (DDD) with clean architecture layers
* Deploy using AWS CDK with Lambda Layers for dependency management

---

## 3. Target Users

| Role | Description |
|---|---|
| **OWNER** | System administrator — manages all users, projects, and tasks |
| **ADMIN** | Project manager — creates projects, assigns tasks, manages project members |
| **MEMBER** | Team member — works on assigned tasks, updates status, posts progress |

---

## 4. Features

### 4.1 Authentication & Authorization

* User login via AWS Cognito (email + password)
* JWT-based authentication on all API calls
* Three system roles: OWNER, ADMIN, MEMBER
* No self-registration — all user accounts are created by OWNER or ADMIN
* Cognito self-signup is disabled at the User Pool level
* Cognito `custom:systemRole` attribute synced with DynamoDB

### 4.2 User Management (OWNER / ADMIN)

* OWNER can create ADMINs and MEMBERs
* ADMIN can create MEMBERs only
* OWNER can change user roles (promote/demote)
* OWNER can delete any non-OWNER user
* ADMIN can delete MEMBERs only
* View user task progress across all projects

### 4.3 Project Management

* OWNER and ADMINs can create projects
* Projects have a name, description, and creator
* Members are assigned to projects with a project-level role (ADMIN or MEMBER)
* OWNER has full access to all projects without explicit membership
* Project ADMINs can manage members and tasks within their project
* Deleting a project cascades to all tasks and comments

### 4.4 Task Management

* OWNER and ADMINs create tasks inside projects
* Each task has: title, description, status, priority, deadline (date + time), and one or more assignees
* **Multi-assignee**: a task can be assigned to multiple project members
* **Required deadline**: every task must have a deadline (ISO 8601 datetime)
* Task statuses: TODO, IN\_PROGRESS, DONE
* Task priorities: LOW, MEDIUM, HIGH
* Members can only update the status of tasks assigned to them
* OWNER/ADMIN can update all task fields
* Deleting a task cascades to all its comments
* Tracks `created_by` and `assigned_by` metadata

### 4.5 Progress Comments

* Assigned members can post progress updates (text messages) on their tasks
* OWNER and ADMINs can also post comments on any task
* Comments are displayed chronologically in the task detail panel
* Each comment records: author, message, timestamp

### 4.6 Dashboard

* Overview of projects the user belongs to
* Task counts by status (TODO, IN\_PROGRESS, DONE)
* Quick navigation to projects and tasks

### 4.7 My Tasks

* Aggregated view of all tasks assigned to the current user across all projects
* Shows project name, task title, status, priority, and deadline

### 4.8 Profile Management

* Users can view and update their own name
* Profile changes reflect immediately across the UI (via AuthProvider state)

---

## 5. Functional Requirements

### FR1: Authentication
* Users log in with email and password via Cognito
* JWT ID token is stored in localStorage and sent with all API requests
* Token expiry is handled by Cognito; invalid tokens return 401

### FR2: Role-Based Access Control
* System-level RBAC: OWNER > ADMIN > MEMBER
* Project-level RBAC: Project ADMIN > Project MEMBER
* OWNER bypasses project membership checks (full access)
* RBAC enforced in both API Gateway (JWT validation) and application use cases (authorization logic)

### FR3: Project Management
* `POST /projects` — OWNER/ADMIN creates a project
* `GET /projects` — returns projects the caller belongs to (OWNER sees all via membership query)
* `GET /projects/{id}` — returns project metadata + member list
* `DELETE /projects/{id}` — cascades to tasks, comments, and memberships

### FR4: Member Management
* `POST /projects/{id}/members` — add user to project with role
* `DELETE /projects/{id}/members/{userId}` — remove member
* `PUT /projects/{id}/members/{userId}/role` — change project role
* Add member UI shows dropdown of available users (excludes already-added and OWNER)

### FR5: Task Management
* `POST /projects/{id}/tasks` — create task with title, deadline (required), assignees (list)
* `PUT /projects/{id}/tasks/{taskId}` — update task fields
* `PUT /projects/{id}/tasks/{taskId}/assign` — reassign task to new member list
* `DELETE /projects/{id}/tasks/{taskId}` — delete task and cascade comments
* Members can only update `status` field on tasks assigned to them

### FR6: Progress Comments
* `POST /projects/{id}/tasks/{taskId}/comments` — post progress message
* `GET /projects/{id}/tasks/{taskId}/comments` — list comments chronologically
* Only assigned members, OWNER, and ADMINs can post comments

### FR7: User Management
* `POST /users` — create user (Cognito + DynamoDB)
* `DELETE /users/{userId}` — delete user (Cognito + DynamoDB + remove from all projects)
* `PUT /users/role` — change system role
* `GET /users/{userId}/progress` — view task progress across projects

---

## 6. Non-Functional Requirements

### 6.1 Scalability
* Fully serverless — Lambda auto-scales with request volume
* DynamoDB on-demand billing — no capacity planning needed
* Single-table design minimizes DynamoDB calls per request

### 6.2 Performance
* Average API response time < 500ms
* Lambda Layer shared across all functions — reduces cold start package size
* DynamoDB single-table queries return data in one round-trip

### 6.3 Security
* Cognito JWT authentication on all API endpoints
* RBAC enforced at use case layer (not just API Gateway)
* No secrets in frontend code — Cognito handles auth flow
* Password policy: 8+ chars, uppercase, lowercase, numbers
* `created_by` and `assigned_by` audit fields on all entities

### 6.4 Reliability
* All AWS managed services (Lambda, DynamoDB, Cognito, API Gateway) — 99.9%+ SLA
* DynamoDB `RemovalPolicy.DESTROY` for dev; change to `RETAIN` for production

### 6.5 Maintainability
* Domain-Driven Design with strict layer boundaries
* No infrastructure imports in domain or application layers
* `IIdentityService` port in domain layer — Cognito is just one implementation
* Pydantic v2 for request validation at handler level
* TypeScript types on frontend match API response shape via auto snake→camel conversion

---

## 7. System Architecture

### Backend
```
API Gateway (REST, Cognito Authorizer)
    ↓
AWS Lambda (Python 3.12, Lambda Layer for deps)
    ↓
DynamoDB (single-table, GSI1)
Cognito (user identity)
```

### Infrastructure
```
AWS CDK (Python)
    ├── DynamoDB Table + GSI1
    ├── Cognito User Pool + Client
    ├── API Gateway (REST)
    ├── Lambda Layer (boto3, pydantic)
    └── 24 Lambda Functions
```

### Frontend
```
Next.js 14 (App Router)
    ├── Cognito auth (client-side)
    ├── React Query (server state)
    ├── Tailwind CSS (styling)
    └── API client (auto snake→camel key transform)
```

---

## 8. Data Model

### User
| Field | Type | Notes |
|---|---|---|
| user_id | string | Cognito sub (UUID) |
| email | string | Unique, immutable |
| name | string | Editable |
| system_role | enum | OWNER, ADMIN, MEMBER |
| created_by | string? | User ID of creator |
| created_at | datetime | ISO 8601 |
| updated_at | datetime | ISO 8601 |

### Project
| Field | Type | Notes |
|---|---|---|
| project_id | UUID | |
| name | string | |
| description | string? | Optional |
| created_by | string | User ID |
| created_at | datetime | ISO 8601 |
| updated_at | datetime | ISO 8601 |

### ProjectMember
| Field | Type | Notes |
|---|---|---|
| project_id | UUID | |
| user_id | UUID | |
| project_role | enum | ADMIN, MEMBER |
| joined_at | datetime | ISO 8601 |

### Task
| Field | Type | Notes |
|---|---|---|
| task_id | UUID | |
| project_id | UUID | |
| title | string | |
| description | string? | Optional |
| status | enum | TODO, IN_PROGRESS, DONE |
| priority | enum | LOW, MEDIUM, HIGH |
| assigned_to | list[string] | One or more user IDs |
| assigned_by | string? | Who last assigned |
| created_by | string | User ID |
| deadline | datetime | Required, ISO 8601 |
| created_at | datetime | ISO 8601 |
| updated_at | datetime | ISO 8601 |

### ProgressComment
| Field | Type | Notes |
|---|---|---|
| comment_id | UUID | |
| task_id | UUID | |
| project_id | UUID | |
| author_id | string | User ID |
| message | string | Progress update text |
| created_at | datetime | ISO 8601 |

---

## 9. DynamoDB Key Design

Single table: **TaskManagementTable**

| Item | PK | SK | GSI1PK | GSI1SK |
|---|---|---|---|---|
| User | `USER#{userId}` | `PROFILE` | `USER_EMAIL#{email}` | `PROFILE` |
| Project | `PROJECT#{projectId}` | `METADATA` | — | — |
| ProjectMember | `PROJECT#{projectId}` | `MEMBER#{userId}` | `USER#{userId}` | `PROJECT#{projectId}` |
| Task | `PROJECT#{projectId}` | `TASK#{taskId}` | `TASK#{taskId}` | `PROJECT#{projectId}` |
| Comment | `TASK#{taskId}` | `COMMENT#{ts}#{id}` | — | — |

---

## 10. Security

* Cognito JWT authentication on every API call
* API Gateway Cognito authorizer rejects invalid/expired tokens (401)
* Use case layer enforces RBAC (system role + project membership) → 403
* Password policy enforced by Cognito (8+ chars, upper, lower, digits)
* IAM roles scoped per Lambda function (DynamoDB CRUD, Cognito admin ops)
* No secrets stored in frontend — all auth via Cognito SDK

---

## 11. Testing Strategy

* Unit testing for domain entities and use cases (pytest)
* API testing via curl / Postman against deployed endpoints
* Role-based access testing — verify each role's permissions
* Frontend build verification (`next build` with TypeScript strict mode)

---

## 12. Deployment

| Component | Platform | Tool |
|---|---|---|
| Infrastructure | AWS (ap-south-1) | AWS CDK (Python) |
| Backend | AWS Lambda | CDK deploy |
| Database | DynamoDB | CDK managed |
| Auth | Cognito | CDK managed |
| Frontend | localhost / Vercel | `npm run dev` / Vercel deploy |

Deploy command: `cd backend/cdk && cdk deploy`

---

## 13. Success Metrics

| Metric | Target |
|---|---|
| API response time | < 500ms average |
| Successful auth rate | > 99% |
| Task CRUD operations | All RBAC-compliant |
| Frontend build | Zero TypeScript errors |
| Cold start time | < 2s with Lambda Layer |

---

## 14. Implemented Features (Current State)

- [x] User authentication (Cognito login)
- [x] Three-tier RBAC (OWNER > ADMIN > MEMBER)
- [x] User management (create, delete, role change, progress view)
- [x] Project CRUD with member management
- [x] Task CRUD with kanban board UI
- [x] Multi-assignee tasks
- [x] Required deadlines (date + time)
- [x] Progress comments on tasks
- [x] Dashboard with project/task overview
- [x] My Tasks page (cross-project view)
- [x] Profile management
- [x] AWS CDK deployment with Lambda Layers
- [x] DDD architecture with clean layer boundaries
- [x] snake_case → camelCase API response transformation

---

## 15. Future Enhancements

* Real-time updates via API Gateway WebSockets
* Email notifications via AWS SES/SNS
* File attachments via S3 presigned URLs
* Drag-and-drop kanban reordering
* Task filtering and search
* Analytics dashboard with charts
* Pagination for large project/task lists
* Audit log for all user actions

---

## 16. Risks & Mitigations

| Risk | Mitigation |
|---|---|
| DynamoDB hot partition | Single-table design distributes keys across partitions |
| RBAC bypass | Enforced at both API Gateway and use case layer |
| Cognito token expiry | Frontend handles 401 by redirecting to login |
| Lambda cold starts | Lambda Layer reduces package size; Python 3.12 has fast init |
| Data loss on stack delete | `RemovalPolicy.DESTROY` for dev; switch to `RETAIN` for production |
