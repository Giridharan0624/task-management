# TaskFlow — Task Management System

A full-stack serverless task management platform built on AWS with a Next.js frontend. Designed for organizations to manage projects, assign tasks, track time, handle day-off requests, and monitor team attendance — all with a multi-tier role-based access control system.

**Live Demo:** [task-management.vercel.app](https://task-management.vercel.app)

---

## Features

### User & Role Management
- **5-tier role hierarchy:** OWNER > CEO > MD > ADMIN > MEMBER
- OWNER creates CEO, MD, and ADMIN accounts; ADMINs create MEMBERs
- Auto-generated unique Employee IDs (EMP-0001, EMP-0002, ...)
- Login via email or Employee ID
- Full bio/profile with Cloudinary avatar uploads
- Department-based categorization (Development, Designing, Management, Research)
- Searchable user directory with department filters

### Project Management
- Create projects with team members and a Team Lead (one per project)
- Kanban board (To Do / In Progress / Done) per project
- Project progress tracking with completion percentage
- Edit project details, manage members, view progress — all in one page
- Members see only tasks assigned to them; leads and admins see all

### Task Management
- Create tasks inside projects with deadlines, priority, and multi-assignee support
- Direct task assignment (outside projects) for quick ad-hoc tasks
- Members can only update task status (To Do → In Progress → Done)
- OWNER/CEO/MD/ADMIN can edit all task fields
- Progress comments on tasks
- Starting a timer on a task auto-moves it to "In Progress"

### Clockify-Style Time Tracker
- Select a project (or "Direct Tasks") → select a task → start timer
- Live ticking timer on dashboard
- Switch tasks (auto-stops current, starts new)
- Multiple sessions per day with cumulative hours
- Session history with task names and timestamps
- Team attendance table with live timers for active users

### Day Off Requests
- Members and Admins can request single-day or multi-day leave
- Optional time range for partial-day requests
- Auto-routed to CEO/MD for approval (no manual selection)
- Approve / Reject with approver name recorded
- Day-off banner on team attendance showing who's on leave today

### Attendance & Reporting
- Daily attendance tracking via the time tracker
- Monthly attendance reports with CSV download
- Per-task time breakdown in reports
- Team attendance dashboard for OWNER/CEO/MD/ADMIN

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | Python 3.12, AWS Lambda |
| Infrastructure | AWS CDK (Python) |
| API | AWS API Gateway (REST) |
| Auth | AWS Cognito (JWT) |
| Database | AWS DynamoDB (single-table design) |
| Frontend | Next.js 16 (App Router), TypeScript |
| Styling | Tailwind CSS |
| Font | Lexend (Google Fonts) |
| State Management | React Query (@tanstack/react-query) |
| Image Storage | Cloudinary (unsigned uploads) |
| Deployment | Vercel (frontend), AWS (backend) |

---

## Architecture

### Backend — Domain-Driven Design (DDD)

```
handlers/        → Lambda entry points (parse request, return response)
    ↓ calls
application/     → Use cases (business logic + RBAC enforcement)
    ↓ calls
infrastructure/  → DynamoDB repositories, Cognito service, mappers
    ↑ implements
domain/          → Pure entities, enums, repository interfaces (no AWS code)
```

### Frontend — Next.js App Router

| Route | Description |
|---|---|
| `/login` | Authentication page |
| `/dashboard` | Role-specific overview with stats, timer, attendance |
| `/my-tasks` | All Tasks (OWNER/CEO/MD) or My Tasks (ADMIN/MEMBER) |
| `/projects` | Project list with progress bars |
| `/projects/[id]` | Kanban board, members, progress tabs |
| `/admin/users` | User management with department filters |
| `/attendance` | Monthly attendance reports with CSV export |
| `/day-offs` | Day-off request and approval management |
| `/profile` | User profile with avatar upload |

---

## Role Hierarchy & Permissions

```
OWNER (system account — manages the organization)
├── CEO  (full access, approves day-offs)
├── MD   (full access, approves day-offs)
│   ├── ADMIN (manages projects, tasks, members)
│   │   └── MEMBER (works on assigned tasks)
```

| Action | OWNER | CEO | MD | ADMIN | TEAM LEAD | MEMBER |
|---|---|---|---|---|---|---|
| Create CEO/MD | Yes | — | — | — | — | — |
| Create Admin | Yes | Yes | Yes | — | — | — |
| Create Member | Yes | Yes | Yes | Yes | — | — |
| View all users | Yes | Yes | Yes | Members only | — | — |
| Create projects | Yes | Yes | Yes | Yes | — | — |
| Create tasks | Yes | Yes | Yes | Yes | Yes | — |
| View all tasks | Yes | Yes | Yes | Yes | Yes | Assigned only |
| Edit any task | Yes | Yes | Yes | Yes | Yes | Status only |
| Approve day-offs | — | Yes | Yes | — | — | — |
| Request day-offs | — | — | — | Yes | — | Yes |
| View attendance | Yes | Yes | Yes | Yes | — | Own only |
| Assign direct tasks | Yes | Yes | Yes | Yes | — | — |

---

## Database Design

**Single DynamoDB table:** `TaskManagementTable` with GSI1 and GSI2.

| Item | PK | SK |
|---|---|---|
| User | `USER#{userId}` | `PROFILE` |
| Project | `PROJECT#{projectId}` | `METADATA` |
| Project Member | `PROJECT#{projectId}` | `MEMBER#{userId}` |
| Task | `PROJECT#{projectId}` | `TASK#{taskId}` |
| Direct Task | `PROJECT#DIRECT` | `TASK#{taskId}` |
| Comment | `TASK#{taskId}` | `COMMENT#{ts}#{id}` |
| Attendance | `USER#{userId}` | `ATTENDANCE#{date}` |
| Day Off | `USER#{userId}` | `DAYOFF#{ts}#{id}` |

**GSI1:** Email lookups, project membership, task lookups
**GSI2:** Employee ID lookups

---

## Getting Started

### Prerequisites

- AWS CLI configured with credentials
- AWS CDK CLI (`npm install -g aws-cdk`)
- Python 3.12
- Node.js 18+
- Cloudinary account (for avatar uploads)

### 1. Deploy the Backend

```bash
cd backend

# Install CDK dependencies
pip install -r cdk/requirements.txt

# Bundle Lambda dependencies
pip install -r requirements.txt -t src/ \
  --only-binary :all: \
  --platform manylinux2014_x86_64 \
  --implementation cp \
  --python-version 3.12

# Bootstrap CDK (first time)
cd cdk && cdk bootstrap

# Deploy
cdk deploy
```

Note the outputs: `ApiUrl`, `UserPoolId`, `UserPoolClientId`

### 2. Seed the OWNER Account

```bash
# Create Cognito user
aws cognito-idp admin-create-user \
  --user-pool-id <UserPoolId> \
  --username admin@yourcompany.com \
  --user-attributes Name=email,Value=admin@yourcompany.com \
    Name=email_verified,Value=true \
    Name=name,Value="Company Name" \
    Name=custom:systemRole,Value=OWNER \
  --message-action SUPPRESS

# Set permanent password
aws cognito-idp admin-set-user-password \
  --user-pool-id <UserPoolId> \
  --username admin@yourcompany.com \
  --password "YourPassword@123" \
  --permanent
```

The OWNER profile is auto-created in DynamoDB on first login.

### 3. Run the Frontend Locally

```bash
cd frontend
npm install
npm run dev
```

Create `frontend/.env.local`:

```env
NEXT_PUBLIC_API_URL=https://<api-id>.execute-api.<region>.amazonaws.com/prod
NEXT_PUBLIC_COGNITO_USER_POOL_ID=<UserPoolId>
NEXT_PUBLIC_COGNITO_CLIENT_ID=<UserPoolClientId>
NEXT_PUBLIC_AWS_REGION=ap-south-1
NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME=<your_cloud_name>
NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET=<your_upload_preset>
```

### 4. Deploy Frontend to Vercel

1. Push to GitHub
2. Import repo in Vercel → set **Root Directory** to `frontend`
3. Add the environment variables above
4. Deploy

### 5. Cloudinary Setup (for profile images)

1. Create account at [cloudinary.com](https://cloudinary.com)
2. Go to Settings → Upload → Add upload preset
3. Set Signing Mode to **Unsigned**, folder to `taskflow-avatars`
4. Copy the cloud name and preset name to your env variables

---

## Data Models

### User
| Field | Type | Description |
|---|---|---|
| user_id | string | Cognito sub (UUID) |
| employee_id | string | Auto-generated (EMP-0001) |
| email | string | Unique, used for login |
| name | string | Display name |
| system_role | enum | OWNER, CEO, MD, ADMIN, MEMBER |
| department | string | Set by admin (Development, Designing, etc.) |
| designation | string | Job title |
| phone | string | Contact number |
| location | string | City/office |
| bio | string | About section |
| avatar_url | string | Cloudinary image URL |
| skills | list | Skill tags |
| created_by | string | User ID of creator |

### Project
| Field | Type | Description |
|---|---|---|
| project_id | UUID | Unique identifier |
| name | string | Project name |
| description | string | Optional description |
| estimated_hours | float | Time budget for progress tracking |
| created_by | string | Creator's user ID |

### Task
| Field | Type | Description |
|---|---|---|
| task_id | UUID | Unique identifier |
| project_id | UUID | Parent project (or "DIRECT" for standalone) |
| title | string | Task title |
| status | enum | TODO, IN_PROGRESS, DONE |
| priority | enum | LOW, MEDIUM, HIGH |
| assigned_to | list | One or more user IDs |
| deadline | datetime | Required due date/time |
| estimated_hours | float | Time estimate |

### Attendance (per user per day)
| Field | Type | Description |
|---|---|---|
| sessions | list | Multiple sign-in/out sessions with task context |
| total_hours | float | Cumulative hours across all sessions |
| Each session has | | task_id, project_id, task_title, project_name, hours |

### Day Off Request
| Field | Type | Description |
|---|---|---|
| request_id | UUID | Unique identifier |
| start_date | datetime | Leave start |
| end_date | datetime | Leave end |
| reason | string | Reason for leave |
| status | enum | PENDING, APPROVED, REJECTED |
| admin_id | string | CEO/MD who approves |

---

## Key Design Decisions

| Decision | Rationale |
|---|---|
| **AWS CDK** over SAM | Programmatic infrastructure in Python, DRY Lambda creation |
| **Single-table DynamoDB** | All access patterns in one table, minimal round-trips |
| **Lambda Layers** | Dependencies separated from source code, clean `src/` |
| **5-tier roles** | OWNER > CEO > MD > ADMIN > MEMBER mirrors real org hierarchies |
| **DDD architecture** | Clean layer separation, no AWS deps in domain/application |
| **Unsigned Cloudinary uploads** | Direct browser-to-Cloudinary, no backend proxy needed |
| **snake_case ↔ camelCase auto-conversion** | Backend uses Python conventions, frontend uses JS conventions, API client converts automatically |
| **JWT + DynamoDB dual source** | Cognito JWT for auth, DynamoDB for full profile (avatar, bio, etc.) |
| **Direct tasks** | Tasks outside projects using `project_id="DIRECT"` — same table, no schema change |

---

## Redeployment

```bash
# Backend
cd backend/cdk && cdk deploy

# Frontend (auto-deploys on git push to Vercel)
git add . && git commit -m "update" && git push
```

---

## License

Private project. All rights reserved