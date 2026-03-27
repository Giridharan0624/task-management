# Task Management System

A serverless task management application built on AWS with a Next.js frontend. Supports multi-user collaboration with role-based access control, project-based task organization, multi-assignee tasks, deadlines, and progress comments.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend runtime | Python 3.12 on AWS Lambda |
| Infrastructure | AWS CDK (Python) |
| API | AWS API Gateway (REST) |
| Auth | AWS Cognito (JWT) |
| Database | AWS DynamoDB (single-table) |
| Frontend | Next.js 14 (App Router) |
| Frontend auth | amazon-cognito-identity-js |
| Frontend data | React Query (@tanstack/react-query) |
| Styling | Tailwind CSS |

---

## Project Structure

```
task-management/
├── backend/
│   ├── cdk/                     # AWS CDK infrastructure (Python)
│   │   ├── app.py               # CDK app entry point
│   │   ├── stack.py             # Full stack definition
│   │   ├── cdk.json             # CDK config
│   │   └── requirements.txt     # aws-cdk-lib, constructs
│   ├── layers/                  # Lambda Layer dependencies (gitignored)
│   │   └── python/              # pip install -t layers/python
│   ├── requirements.txt         # boto3, pydantic
│   ├── requirements-dev.txt     # pytest, moto, boto3-stubs
│   ├── pyproject.toml           # pytest + ruff config
│   └── src/                     # Lambda function source (DDD)
│       ├── domain/              # Pure business rules — no AWS deps
│       │   ├── project/         # Project, ProjectMember entities
│       │   ├── task/            # Task entity (multi-assign, deadline)
│       │   ├── comment/         # ProgressComment entity
│       │   └── user/            # User entity, IIdentityService port
│       ├── application/         # Use cases (orchestration layer)
│       │   ├── project/         # CRUD, member management
│       │   ├── task/            # CRUD, assign, my-tasks
│       │   ├── comment/         # Create + list comments
│       │   └── user/            # Profile, admin, progress
│       ├── infrastructure/      # DynamoDB repos, Cognito, mappers
│       │   ├── dynamodb/        # Repository implementations
│       │   ├── mappers/         # Entity ↔ DynamoDB item mappers
│       │   └── cognito/         # CognitoService (implements IIdentityService)
│       ├── handlers/            # Lambda entry points (composition root)
│       │   ├── project/         # 7 handlers (CRUD + members)
│       │   ├── task/            # 6 handlers (CRUD + assign)
│       │   ├── comment/         # 2 handlers (create + list)
│       │   ├── user/            # 9 handlers (profile, admin, progress)
│       │   └── shared/          # auth_context, response, validate_body
│       └── shared/              # Cross-cutting errors
└── frontend/                    # Next.js 14 App Router
    └── src/
        ├── app/                 # Pages (route groups)
        │   ├── (auth)/          # login, register
        │   └── (dashboard)/     # protected pages with sidebar
        │       ├── dashboard/   # Overview
        │       ├── projects/    # Project list + detail (kanban)
        │       ├── my-tasks/    # Tasks assigned to current user
        │       ├── admin/users/ # User management (OWNER/ADMIN)
        │       └── profile/     # Edit own profile
        ├── components/          # UI + feature components
        │   ├── ui/              # Badge, Button, Input, Modal, Spinner
        │   ├── project/         # ProjectCard, ProjectList, CreateProjectModal, MemberList
        │   └── task/            # TaskCard, TaskKanban, TaskDetailPanel, CreateTaskModal
        ├── lib/                 # API client, auth, hooks
        │   ├── api/             # projectApi, taskApi, commentApi, userApi, client
        │   ├── auth/            # AuthProvider, cognitoClient
        │   └── hooks/           # useProjects, useTasks, useComments, useUsers, usePermission
        └── types/               # project, task, comment, user
```

---

## Architecture

### Backend — Domain-Driven Design

The backend is organized into four strict layers. Dependencies flow inward — outer layers depend on inner layers, never the reverse.

```
handlers/ → application/ → domain/ ← infrastructure/
```

| Layer | Responsibility |
|---|---|
| `domain/` | Entities (`User`, `Project`, `ProjectMember`, `Task`, `ProgressComment`), value objects (enums), repository interfaces (ABCs), identity service port |
| `application/` | Use case classes — orchestrate domain logic, enforce RBAC, no AWS code |
| `infrastructure/` | Concrete DynamoDB repositories, bidirectional mappers, Cognito service |
| `handlers/` | Lambda entry points — parse event, wire dependencies, call use case, return HTTP response |

### Frontend — Next.js App Router

```
(auth)/              login, register — no sidebar
(dashboard)/         protected pages — sidebar layout
  dashboard/         overview with project + task summary
  projects/          project list + project detail (kanban board)
  projects/[id]/members/  member management
  my-tasks/          all tasks assigned to current user
  admin/users/       user management (OWNER/ADMIN only)
  profile/           edit own profile
```

---

## Database Design

Single DynamoDB table: **`TaskManagementTable`** with one GSI.

### Key Schema

| Item Type | PK | SK | GSI1PK | GSI1SK |
|---|---|---|---|---|
| User | `USER#{userId}` | `PROFILE` | `USER_EMAIL#{email}` | `PROFILE` |
| Project | `PROJECT#{projectId}` | `METADATA` | — | — |
| ProjectMember | `PROJECT#{projectId}` | `MEMBER#{userId}` | `USER#{userId}` | `PROJECT#{projectId}` |
| Task | `PROJECT#{projectId}` | `TASK#{taskId}` | `TASK#{taskId}` | `PROJECT#{projectId}` |
| Comment | `TASK#{taskId}` | `COMMENT#{timestamp}#{id}` | — | — |

### Access Patterns

| Pattern | Operation |
|---|---|
| Get user by ID | `GetItem PK=USER#{id} SK=PROFILE` |
| Get user by email | `Query GSI1 GSI1PK=USER_EMAIL#{email}` |
| Get project | `GetItem PK=PROJECT#{id} SK=METADATA` |
| List projects for user | `Query GSI1 GSI1PK=USER#{userId}` → fetch each project |
| Get project members | `Query PK=PROJECT#{id} SK begins_with MEMBER#` |
| List tasks in project | `Query PK=PROJECT#{id} SK begins_with TASK#` |
| Get task by ID | `Query GSI1 GSI1PK=TASK#{taskId}` |
| List comments on task | `Query PK=TASK#{taskId} SK begins_with COMMENT#` |
| Delete project (cascade) | `Query PK=PROJECT#{id}` → batch delete all items |

---

## API Endpoints

All routes require `Authorization: <Cognito ID token>`.

### Users

| Method | Path | RBAC | Description |
|---|---|---|---|
| `GET` | `/users/me` | Any | Get own profile |
| `PUT` | `/users/me` | Any | Update own profile |
| `GET` | `/users/me/tasks` | Any | List tasks assigned to caller |
| `GET` | `/users` | OWNER / ADMIN | List all users |
| `POST` | `/users` | OWNER / ADMIN | Create user (Cognito + DynamoDB) |
| `DELETE` | `/users/{userId}` | OWNER / ADMIN | Delete user |
| `PUT` | `/users/role` | OWNER | Change user system role |
| `GET` | `/users/{userId}/progress` | OWNER / ADMIN | View user task progress |

### Projects

| Method | Path | RBAC | Description |
|---|---|---|---|
| `POST` | `/projects` | OWNER / ADMIN | Create project |
| `GET` | `/projects` | Any | List projects for caller |
| `GET` | `/projects/{projectId}` | Project member / OWNER | Get project + members |
| `DELETE` | `/projects/{projectId}` | Project Admin / OWNER | Delete project (cascades) |

### Project Members

| Method | Path | RBAC | Description |
|---|---|---|---|
| `POST` | `/projects/{projectId}/members` | Project Admin / OWNER | Add member |
| `DELETE` | `/projects/{projectId}/members/{userId}` | Project Admin / OWNER | Remove member |
| `PUT` | `/projects/{projectId}/members/{userId}/role` | Project Admin / OWNER | Update member role |

### Tasks

| Method | Path | RBAC | Description |
|---|---|---|---|
| `POST` | `/projects/{projectId}/tasks` | OWNER / ADMIN | Create task (deadline required) |
| `GET` | `/projects/{projectId}/tasks` | Project member / OWNER | List tasks |
| `GET` | `/projects/{projectId}/tasks/{taskId}` | Project member / OWNER | Get task |
| `PUT` | `/projects/{projectId}/tasks/{taskId}` | OWNER / ADMIN / assigned member (status only) | Update task |
| `DELETE` | `/projects/{projectId}/tasks/{taskId}` | OWNER / Project Admin | Delete task (cascades comments) |
| `PUT` | `/projects/{projectId}/tasks/{taskId}/assign` | OWNER / ADMIN | Assign task to members (list) |

### Progress Comments

| Method | Path | RBAC | Description |
|---|---|---|---|
| `POST` | `/projects/{projectId}/tasks/{taskId}/comments` | Assigned member / OWNER / ADMIN | Post progress update |
| `GET` | `/projects/{projectId}/tasks/{taskId}/comments` | Project member / OWNER | List comments |

---

## RBAC

Two independent role dimensions:

### System Role (stored on User, set in Cognito `custom:systemRole`)

| Role | Capabilities |
|---|---|
| **OWNER** | Full system access — manage all users, projects, tasks. One per system. |
| **ADMIN** | Create projects, create users (members only), manage projects they belong to |
| **MEMBER** | View assigned tasks, update task status, post progress comments |

### Project Role (stored per `ProjectMember` item)

| Action | Admin | Member |
|---|---|---|
| View project & tasks | Yes | Yes |
| Create / update task | Yes | No |
| Assign task | Yes | No |
| Delete task | Yes | No |
| Delete project | Yes | No |
| Manage members | Yes | No |
| Update task status (own) | Yes | Yes |
| Post progress comments | Yes | Yes |

RBAC is enforced at two points:
1. **API Gateway** — validates JWT signature/expiry via Cognito authorizer
2. **Use case layer** — checks system role + project membership, raises `AuthorizationError` → `403`

---

## Getting Started

### Prerequisites

- AWS CLI configured with credentials
- AWS CDK CLI (`npm install -g aws-cdk`)
- Python 3.12
- Node.js 18+

### Deploy the Backend

```bash
cd backend

# Install CDK dependencies
pip install -r cdk/requirements.txt

# Bundle Lambda dependencies into layer
pip install -r requirements.txt -t layers/python \
  --only-binary :all: \
  --platform manylinux2014_x86_64 \
  --implementation cp \
  --python-version 3.12

# Bootstrap CDK (first time per account/region)
cd cdk
cdk bootstrap

# Deploy
cdk deploy

# Note the outputs:
#   ApiUrl           → paste into frontend .env.local
#   UserPoolId       → paste into frontend .env.local
#   UserPoolClientId → paste into frontend .env.local
```

### Seed the Admin User

```bash
# Create Cognito user
aws cognito-idp admin-create-user \
  --user-pool-id <UserPoolId> \
  --username admin@taskmanager.com \
  --user-attributes Name=email,Value=admin@taskmanager.com \
    Name=email_verified,Value=true \
    Name=name,Value=Admin \
    Name=custom:systemRole,Value=OWNER \
  --message-action SUPPRESS

# Set permanent password
aws cognito-idp admin-set-user-password \
  --user-pool-id <UserPoolId> \
  --username admin@taskmanager.com \
  --password "Admin@123" \
  --permanent

# Seed DynamoDB (update admin-item.json with the Cognito sub)
aws dynamodb put-item \
  --table-name TaskManagementTable \
  --item file://admin-item.json
```

### Run the Frontend

```bash
cd frontend
npm install
npm run dev
```

Create `.env.local` with CDK deploy outputs:

```
NEXT_PUBLIC_API_URL=https://<api-id>.execute-api.<region>.amazonaws.com/prod
NEXT_PUBLIC_COGNITO_USER_POOL_ID=<UserPoolId>
NEXT_PUBLIC_COGNITO_CLIENT_ID=<UserPoolClientId>
NEXT_PUBLIC_AWS_REGION=ap-south-1
```

### Redeployment

After code changes, redeploy with:

```bash
cd backend/cdk
cdk deploy
```

---

## Data Models

### User
```
user_id       string (Cognito sub)
email         string
name          string
system_role   OWNER | ADMIN | MEMBER
created_by    user_id (optional — who created this user)
created_at    ISO 8601 datetime
updated_at    ISO 8601 datetime
```

### Project
```
project_id    UUID
name          string
description   string (optional)
created_by    user_id
created_at    ISO 8601 datetime
updated_at    ISO 8601 datetime
```

### ProjectMember
```
project_id    UUID
user_id       UUID
project_role  ADMIN | MEMBER
joined_at     ISO 8601 datetime
```

### Task
```
task_id       UUID
project_id    UUID
title         string
description   string (optional)
status        TODO | IN_PROGRESS | DONE
priority      LOW | MEDIUM | HIGH
assigned_to   list[user_id]  (one or more assignees)
assigned_by   user_id (optional — who last assigned)
created_by    user_id
deadline      ISO 8601 datetime (required)
created_at    ISO 8601 datetime
updated_at    ISO 8601 datetime
```

### ProgressComment
```
comment_id    UUID
task_id       UUID
project_id    UUID
author_id     user_id
message       string
created_at    ISO 8601 datetime
```

---

## Key Design Decisions

**AWS CDK over SAM** — programmatic infrastructure definition in Python. DRY Lambda creation via helper function. Shared Lambda Layer for dependencies keeps `src/` clean.

**Single-table DynamoDB** — all access patterns served with at most one DynamoDB call. Querying `PK=PROJECT#{projectId}` returns project metadata, members, and tasks in one partition.

**Lambda Layer for dependencies** — `boto3`, `pydantic`, etc. are bundled in a shared Lambda Layer (`layers/python/`), not in `src/`. This keeps the source directory clean with only application code.

**Project role vs system role** — a user can be a Member on one project and Admin on another. The OWNER system role has full access across all projects without needing project membership.

**Multi-assignee tasks** — `assigned_to` is stored as a DynamoDB list. GSI2 was removed since list fields can't be used as GSI keys. Assignee lookups iterate per-project tasks instead.

**Progress comments** — members post progress updates on tasks they're assigned to. Comments use `PK=TASK#{taskId}, SK=COMMENT#{timestamp}#{commentId}` for chronological ordering.

**DDD with no DI container** — use cases receive repository instances via constructor injection, wired in each handler. No framework overhead on Lambda cold starts.

**Pydantic v2 for validation** — request bodies validated using Pydantic models in each handler. Invalid input returns `400` before business logic runs.

**snake_case → camelCase API client** — backend returns snake_case, frontend `transformKeys()` in the API client auto-converts all response keys to camelCase.
