# Task Management System

A serverless, Trello-like task management application built on AWS with a Next.js frontend. Supports multi-user collaboration with role-based access control per board.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend runtime | Python 3.12 on AWS Lambda |
| Infrastructure | AWS SAM (CloudFormation) |
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
├── backend/                  # AWS SAM + Python Lambda (DDD)
│   ├── template.yaml         # SAM infrastructure definition
│   ├── requirements.txt      # boto3, pydantic
│   ├── requirements-dev.txt  # pytest, moto, boto3-stubs
│   ├── pyproject.toml        # pytest + ruff config
│   └── src/
│       ├── domain/           # Pure business rules — no AWS deps
│       ├── application/      # Use cases (orchestration layer)
│       ├── infrastructure/   # DynamoDB repositories + mappers
│       └── handlers/         # Lambda entry points
└── frontend/                 # Next.js 14 App Router
    ├── .env.local.example
    └── src/
        ├── app/              # Pages (route groups)
        ├── components/       # UI + feature components
        ├── lib/              # API client, auth, hooks
        └── types/            # Shared TypeScript types
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
| `domain/` | Entities (`User`, `Board`, `BoardMember`, `Task`), value objects (enums), repository interfaces (ABCs) |
| `application/` | Use case classes — orchestrate domain logic, enforce RBAC, no AWS code |
| `infrastructure/` | Concrete DynamoDB repositories + bidirectional mappers |
| `handlers/` | Lambda entry points — parse event, call use case, return HTTP response |

### Frontend — Next.js App Router

```
(auth)/           login, register — no sidebar
(dashboard)/      protected pages — sidebar layout
  dashboard/      overview with board + task summary
  boards/         board list + board detail (kanban)
  boards/[id]/members/  member management
```

---

## Database Design

Single DynamoDB table: **`TaskManagementTable`**

### Key Schema

| Item Type | PK | SK | GSI1PK | GSI1SK | GSI2PK | GSI2SK |
|---|---|---|---|---|---|---|
| User | `USER#{userId}` | `PROFILE` | `USER_EMAIL#{email}` | `PROFILE` | — | — |
| Board | `BOARD#{boardId}` | `METADATA` | `BOARD_CREATED#{createdBy}` | `{createdAt}` | — | — |
| BoardMember | `BOARD#{boardId}` | `MEMBER#{userId}` | `USER#{userId}` | `BOARD#{boardId}` | — | — |
| Task | `BOARD#{boardId}` | `TASK#{taskId}` | `TASK#{taskId}` | `BOARD#{boardId}` | `ASSIGNEE#{assignedTo}` | `TASK#{taskId}` |

### Access Patterns

| Pattern | Operation |
|---|---|
| Get user by ID | `GetItem PK=USER#{id} SK=PROFILE` |
| Get user by email | `Query GSI1 GSI1PK=USER_EMAIL#{email}` |
| Get board | `GetItem PK=BOARD#{id} SK=METADATA` |
| List boards for user | `Query GSI1 GSI1PK=USER#{userId}` → fetch each board |
| Get board members | `Query PK=BOARD#{id} SK begins_with MEMBER#` |
| List tasks on board | `Query PK=BOARD#{id} SK begins_with TASK#` |
| Get task by ID | `Query GSI1 GSI1PK=TASK#{taskId}` |
| Tasks assigned to user | `Query GSI2 GSI2PK=ASSIGNEE#{userId}` |
| Delete board (cascade) | `Query PK=BOARD#{id}` → batch delete all items |

---

## API Endpoints

All routes require `Authorization: Bearer <Cognito ID token>` except auth operations handled client-side via the Cognito SDK.

### Users

| Method | Path | RBAC | Description |
|---|---|---|---|
| `GET` | `/users/me` | Any | Get own profile |
| `PUT` | `/users/me` | Any | Update own profile (`name`) |

### Boards

| Method | Path | RBAC | Description |
|---|---|---|---|
| `POST` | `/boards` | System Admin | Create board |
| `GET` | `/boards` | Any | List boards for caller |
| `GET` | `/boards/{boardId}` | Board member | Get board + members |
| `DELETE` | `/boards/{boardId}` | Board Admin | Delete board (cascades) |

### Board Members

| Method | Path | RBAC | Description |
|---|---|---|---|
| `POST` | `/boards/{boardId}/members` | Board Admin | Add member (`user_id`, `board_role`) |
| `DELETE` | `/boards/{boardId}/members/{userId}` | Board Admin | Remove member |
| `PUT` | `/boards/{boardId}/members/{userId}/role` | Board Admin | Update member role |

### Tasks

| Method | Path | RBAC | Description |
|---|---|---|---|
| `POST` | `/boards/{boardId}/tasks` | Admin or Member | Create task |
| `GET` | `/boards/{boardId}/tasks` | Any member | List tasks |
| `GET` | `/boards/{boardId}/tasks/{taskId}` | Any member | Get task |
| `PUT` | `/boards/{boardId}/tasks/{taskId}` | Admin or Member | Update task |
| `DELETE` | `/boards/{boardId}/tasks/{taskId}` | Board Admin | Delete task |
| `PUT` | `/boards/{boardId}/tasks/{taskId}/assign` | Admin or Member | Assign task to user |

---

## RBAC

Two independent role dimensions:

### System Role (stored on User, set in Cognito `custom:systemRole`)

| Action | Admin | Member | Viewer |
|---|---|---|---|
| Create board | Yes | No | No |
| View own profile | Yes | Yes | Yes |
| Update own profile | Yes | Yes | Yes |

### Board Role (stored per `BoardMember` item)

| Action | Admin | Member | Viewer |
|---|---|---|---|
| View board & tasks | Yes | Yes | Yes |
| Create / update task | Yes | Yes | No |
| Assign task | Yes | Yes | No |
| Delete task | Yes | No | No |
| Delete board | Yes | No | No |
| Manage members | Yes | No | No |

RBAC is enforced at two points:
1. **API Gateway** — validates JWT signature/expiry, rejects with `401` before Lambda runs
2. **Use case layer** — checks board membership and role, raises `AuthorizationError` → `403`

---

## Getting Started

### Prerequisites

- AWS CLI configured
- AWS SAM CLI installed
- Python 3.12
- Node.js 18+

### Deploy the Backend

```bash
cd backend

# Install dependencies
pip install -r requirements.txt

# Build and deploy (first time — interactive)
sam build
sam deploy --guided

# Note the outputs:
#   ApiUrl           → paste into frontend .env.local
#   UserPoolId       → paste into frontend .env.local
#   UserPoolClientId → paste into frontend .env.local
```

### Run the Frontend

```bash
cd frontend

# Copy and fill in env vars from SAM deploy outputs
cp .env.local.example .env.local

# Install and run
npm install
npm run dev
```

`.env.local` variables:

```
NEXT_PUBLIC_API_URL=https://<api-id>.execute-api.<region>.amazonaws.com/prod
NEXT_PUBLIC_COGNITO_USER_POOL_ID=<UserPoolId>
NEXT_PUBLIC_COGNITO_CLIENT_ID=<UserPoolClientId>
NEXT_PUBLIC_COGNITO_REGION=us-east-1
```

### Local Backend Development

```bash
cd backend

# Start local API (requires Docker)
sam local start-api

# Run unit tests
pip install -r requirements-dev.txt
pytest
```

---

## Data Models

### User
```
user_id      string (Cognito sub / UUID)
email        string
name         string
system_role  ADMIN | MEMBER | VIEWER
created_at   ISO 8601 string
updated_at   ISO 8601 string
```

### Board
```
board_id     UUID
name         string
description  string (optional)
created_by   user_id
created_at   ISO 8601 string
updated_at   ISO 8601 string
```

### BoardMember
```
board_id     UUID
user_id      UUID
board_role   ADMIN | MEMBER | VIEWER
joined_at    ISO 8601 string
```

### Task
```
task_id      UUID
board_id     UUID
title        string
description  string (optional)
status       TODO | IN_PROGRESS | DONE
priority     LOW | MEDIUM | HIGH
assigned_to  user_id (optional)
created_by   user_id
due_date     ISO 8601 string (optional)
created_at   ISO 8601 string
updated_at   ISO 8601 string
```

---

## Key Design Decisions

**Single-table DynamoDB** — all access patterns are served with at most one DynamoDB call. Querying `PK=BOARD#{boardId}` returns board metadata, members, and tasks in one round-trip.

**Board role vs system role** — a user can be a Viewer on one board and Admin on another. The system role on `User` gates only system-wide operations (creating boards). Per-board permissions are governed by the `BoardMember` item.

**No DI container** — use cases receive repository instances via constructor injection, wired directly in each handler. No framework overhead on Lambda cold starts.

**Pydantic v2 for validation** — request bodies are validated using Pydantic models defined alongside each handler. Invalid input returns `400` before any business logic runs.

---

## Future Enhancements

- Real-time updates via API Gateway WebSockets
- Email notifications via AWS SNS
- File attachments via S3 presigned URLs
- Drag-and-drop kanban UI
- Analytics dashboard
- Pagination for large boards
