# TaskFlow

**Serverless Task Management & Time Tracking Platform**

A full-stack application for organizations to manage projects, assign tasks, track work hours, monitor employee activity, and generate AI-powered productivity reports. Features a web dashboard and a Windows desktop companion app.

[Live Demo](https://taskflow-ns.vercel.app) | [Download Desktop App](https://dtzl7r6jcvxb2.cloudfront.net/downloads/TaskFlowDesktop-Setup-1.0.0.exe)

---

## Architecture

```
                    ┌──────────────────────────────────────┐
                    │            AWS Cloud (ap-south-1)     │
                    │                                      │
┌──────────┐       │  ┌────────┐   ┌──────────────────┐   │       ┌──────────────┐
│  Web App  │──────│──│  API    │───│  Lambda (32 fn)  │   │───────│  Desktop App  │
│ Next.js 16│  JWT │  │ Gateway │   │  Python 3.12     │   │  JWT  │  Wails v2/Go │
│  Vercel   │──────│──│  REST   │───│  DDD Architecture│   │───────│  Windows     │
└──────────┘       │  └────────┘   └────────┬─────────┘   │       └──────┬───────┘
                    │                        │              │              │
                    │  ┌─────────┐  ┌────────┴─────────┐   │   Screenshots & Activity
                    │  │ Cognito │  │    DynamoDB       │   │   Heartbeats (5 min)
                    │  │  Auth   │  │  Single Table     │   │
                    │  └─────────┘  └──────────────────┘   │
                    │                                      │
                    │  ┌─────────────┐  ┌──────────────┐   │
                    │  │ S3 + CDN    │  │ Groq AI      │   │
                    │  │ Avatars,    │  │ LLaMA 3.3    │   │
                    │  │ Screenshots │  │ Work Summary │   │
                    │  └─────────────┘  └──────────────┘   │
                    └──────────────────────────────────────┘
```

---

## Features

### Web Application

| Feature | Description |
|---------|-------------|
| **Role-Based Access** | 3-tier system RBAC (OWNER > ADMIN > MEMBER) + 4-tier project roles |
| **Project Management** | 4 domains (Development, Designing, Management, Research) with custom pipelines |
| **Task Pipelines** | Domain-specific stages (e.g., To Do > In Progress > Code Review > Testing > Done) |
| **Time Tracking** | Live timer with task switching, meeting mode, mandatory descriptions |
| **Attendance** | Team attendance dashboard, monthly reports, CSV export |
| **Day-Off Management** | Request/approve/reject workflow with self-approval prevention |
| **Reports** | Summary, Detailed, Weekly, and Activity views with charts |
| **AI Work Summary** | Groq LLaMA 3.3 generates daily productivity analysis from activity data |
| **Real-Time Sync** | Polling-based updates (10-30s intervals) with optimistic mutations |
| **Dark Mode** | Comprehensive theme system with 100+ CSS variable overrides |
| **Desktop Download** | In-app installer download for the desktop companion |

### Desktop Application (Windows)

| Feature | Description |
|---------|-------------|
| **Timer** | Same functionality as web — start/stop/switch tasks |
| **Activity Monitoring** | Keyboard/mouse event counts, active app tracking (while timer is ON only) |
| **Screenshots** | Every 10 minutes with 5-second warning, skips locked screens |
| **System Tray** | Background operation, red dot when timer active, right-click menu |
| **Security** | DPAPI-encrypted tokens, TLS 1.3 enforced, consent-based monitoring |
| **Auto-Update** | Checks GitHub releases on startup, one-click install |

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Backend | Python 3.12, AWS Lambda, DDD architecture |
| Infrastructure | AWS CDK (Python), CloudFormation |
| API | API Gateway REST + Cognito JWT authorizer |
| Database | DynamoDB (single-table design, 2 GSIs, PITR enabled) |
| Auth | AWS Cognito (SRP authentication) |
| Storage | S3 + CloudFront CDN (avatars, screenshots, downloads) |
| AI | Groq API (LLaMA 3.3 70B) for work summaries |
| Secrets | AWS Secrets Manager (Gmail SMTP, Groq API key) |
| Web Frontend | Next.js 16, TypeScript, Tailwind CSS, React Query, Recharts |
| Desktop | Go 1.22, Wails v2, Preact, NSIS installer |
| Deployment | Vercel (web), AWS CDK (backend), S3/CloudFront (desktop) |

---

## RBAC Permissions

### System Roles

| Permission | OWNER | ADMIN | MEMBER |
|------------|-------|-------|--------|
| Create users | ADMIN + MEMBER | ADMIN + MEMBER | No |
| Change roles | Yes | No | No |
| Delete users | Anyone | MEMBER only | No |
| Approve day-offs | Any request | Any (not own) | No |
| Request day-offs | No | Yes | Yes |
| Manage projects | Yes | Yes | No |
| View all users | Yes | Yes | No |
| View reports | Yes | Yes | No |
| Track time | No | Yes | Yes |

### Project Roles

| Permission | ADMIN | PROJECT_MANAGER | TEAM_LEAD | MEMBER |
|------------|-------|-----------------|-----------|--------|
| Create/delete tasks | Yes | Yes | Yes | No |
| Update any task | Yes | Yes | Yes | No |
| Update own status | Yes | Yes | Yes | Yes |
| Manage members | Yes | Yes | Yes | No |
| View all tasks | Yes | Yes | Yes | Assigned only |

---

## Getting Started

### Prerequisites

- AWS CLI (configured with credentials)
- AWS CDK CLI (`npm install -g aws-cdk`)
- Python 3.12+
- Node.js 18+
- Go 1.22+ (for desktop app only)
- Wails v2 CLI (for desktop app only)

### 1. Deploy Backend

```bash
cd backend/cdk
pip install -r requirements.txt
cdk bootstrap    # First time only
cdk deploy       # Production
```

For staging environment:
```bash
cdk deploy --app "python app_staging.py"
```

CDK outputs the API URL, Cognito User Pool ID, and Client ID.

### 2. Run Web Frontend

```bash
cd frontend
npm install
```

Create `.env.local` with values from CDK output:
```env
NEXT_PUBLIC_API_URL=https://<api-id>.execute-api.ap-south-1.amazonaws.com/prod
NEXT_PUBLIC_COGNITO_USER_POOL_ID=<user-pool-id>
NEXT_PUBLIC_COGNITO_CLIENT_ID=<client-id>
NEXT_PUBLIC_AWS_REGION=ap-south-1
```

```bash
npm run dev      # Development
npm run build    # Production build
```

### 3. Build Desktop App

```bash
cd desktop
wails dev        # Development mode
wails build      # Production build
```

Build the installer:
```powershell
powershell -File build-installer.ps1
```

Output: `desktop/build/windows/installer/TaskFlowDesktop-Setup-1.0.0.exe`

---

## Project Structure

```
task-management/
├── backend/
│   ├── cdk/                          # AWS CDK infrastructure
│   │   ├── app.py                    # Production entry point
│   │   ├── app_staging.py            # Staging entry point
│   │   └── stack.py                  # Stack definition (all resources)
│   ├── src/
│   │   ├── contexts/                 # Bounded contexts (DDD)
│   │   │   ├── user/                 # User management context
│   │   │   │   ├── domain/           # Entities, value objects, interfaces
│   │   │   │   ├── application/      # Use cases (business logic + RBAC)
│   │   │   │   ├── infrastructure/   # DynamoDB repo, Cognito, Gmail
│   │   │   │   └── handlers/         # Lambda entry points
│   │   │   ├── project/              # Project management context
│   │   │   ├── task/                 # Task management context
│   │   │   ├── attendance/           # Time tracking context
│   │   │   ├── dayoff/               # Day-off request context
│   │   │   ├── comment/              # Task comments context
│   │   │   ├── taskupdate/           # Daily work updates context
│   │   │   ├── activity/             # Desktop activity monitoring + AI
│   │   │   └── upload/               # S3 file upload context
│   │   └── shared_kernel/            # Cross-cutting concerns
│   │       ├── auth_context.py       # JWT extraction + DynamoDB role lookup
│   │       ├── response.py           # API response builder
│   │       ├── validate_body.py      # Pydantic body validation
│   │       ├── errors.py             # Shared exception classes
│   │       └── dynamo_client.py      # DynamoDB table reference
│   └── tests/                        # Pytest test suite
│
├── frontend/                         # Next.js 16 web application
│   ├── public/                       # Static assets (logo)
│   └── src/
│       ├── app/                      # App Router pages
│       │   ├── (auth)/               # Login page
│       │   └── (dashboard)/          # All dashboard pages
│       ├── components/               # React components
│       │   ├── ui/                   # Base UI (20+ custom components)
│       │   ├── attendance/           # Timer, attendance table
│       │   ├── task/                 # Kanban, task detail, create modal
│       │   ├── project/              # Project cards, member list
│       │   └── reports/              # Charts, activity reports
│       ├── lib/                      # Utilities
│       │   ├── api/                  # API client modules
│       │   ├── auth/                 # Cognito auth provider
│       │   ├── hooks/                # React Query hooks
│       │   └── utils/                # Helpers (formatting, colors, etc.)
│       └── types/                    # TypeScript type definitions
│
├── desktop/                          # Wails v2 desktop app
│   ├── internal/                     # Go backend
│   │   ├── auth/                     # Cognito + DPAPI encryption
│   │   ├── api/                      # HTTP client (TLS 1.3)
│   │   ├── monitor/                  # Activity, screenshots, notifications
│   │   ├── tray/                     # System tray (Win32 API)
│   │   └── updater/                  # Auto-update via GitHub releases
│   ├── frontend/                     # Preact UI
│   └── build/                        # Build artifacts + NSIS installer
│
└── docs/                             # Documentation
    ├── task-management-prd.md        # Product requirements document
    ├── RBAC-DOCUMENTATION.md         # Complete permission reference
    ├── TIMER-ARCHITECTURE.md         # Timer implementation details
    └── ...                           # Migration guides, roadmaps
```

### Backend Architecture (DDD Bounded Contexts)

Each bounded context is self-contained with its own domain, application, infrastructure, and handler layers:

```
contexts/{context}/
├── domain/           # Entities, value objects, repository interfaces
├── application/      # Use cases (business logic + authorization)
├── infrastructure/   # DynamoDB repository, mappers, external services
└── handlers/         # Lambda entry points (API request/response)
```

---

## Database Design

Single-table DynamoDB with composite keys:

| Entity | PK | SK |
|--------|----|----|
| User | `USER#{userId}` | `PROFILE` |
| Project | `PROJECT#{projectId}` | `METADATA` |
| Project Member | `PROJECT#{projectId}` | `MEMBER#{userId}` |
| Task | `PROJECT#{projectId}` | `TASK#{taskId}` |
| Comment | `TASK#{taskId}` | `COMMENT#{ts}#{id}` |
| Attendance | `USER#{userId}` | `ATTENDANCE#{date}` |
| Day Off | `USER#{userId}` | `DAYOFF#{ts}#{id}` |
| Task Update | `TASKUPDATE#{date}` | `USER#{userId}` |
| Activity | `USER#{userId}` | `ACTIVITY#{date}` |
| AI Summary | `USER#{userId}` | `SUMMARY#{date}` |

**GSI1**: Email lookups, date-based queries
**GSI2**: Employee ID lookups

---

## API Endpoints

| Category | Count | Examples |
|----------|-------|---------|
| Users | 11 | CRUD, role management, profile, progress |
| Projects | 9 | CRUD, members, status/health |
| Tasks | 6 | CRUD, assign, direct tasks |
| Comments | 2 | Create, list per task |
| Attendance | 5 | Sign in/out, today, reports |
| Day-Offs | 7 | Request, approve, reject, cancel |
| Task Updates | 3 | Submit, list, my status |
| Activity | 6 | Heartbeat, report, AI summary |
| Uploads | 1 | S3 presigned URLs |
| Public | 1 | Employee ID resolution |

**Total: 51 endpoints** across 32 Lambda functions.

---

## Security

| Area | Implementation |
|------|---------------|
| Authentication | AWS Cognito JWT with SRP flow (password never sent to server) |
| Authorization | RBAC enforced from DynamoDB role (not stale JWT claims) |
| Role sync | Backend reads role from DB on every request; frontend polls every 15s |
| Token storage (desktop) | Windows DPAPI encryption + Credential Manager |
| API transport | HTTPS enforced, TLS 1.3 minimum (desktop) |
| File uploads | S3 presigned URLs (no AWS credentials in frontend) |
| Secrets | AWS Secrets Manager for API keys and SMTP credentials |
| Activity monitoring | Consent required, only event counts (no keystrokes), 5s screenshot warning |
| Day-off approval | Self-approval blocked at API level |
| Password policy | 8+ characters, uppercase, lowercase, digits |

---

## Environments

| Environment | API | Web | Desktop Config |
|-------------|-----|-----|----------------|
| Production | `3syc4x99a7.../prod` | [taskflow-ns.vercel.app](https://taskflow-ns.vercel.app) | `config.json` → prod |
| Staging | `4saz9agwdi.../staging` | `localhost:3000` | `config.json` → staging |

Both environments have identical infrastructure (32 Lambdas, full API routes, S3, CloudFront, Secrets Manager).

---

## Deployment

| Component | Command | Target |
|-----------|---------|--------|
| Backend (prod) | `cd backend/cdk && cdk deploy` | AWS Lambda + API Gateway |
| Backend (staging) | `cd backend/cdk && cdk deploy --app "python app_staging.py"` | Separate AWS stack |
| Frontend | `git push` to main | Vercel auto-deploy |
| Desktop | `cd desktop && wails build` | Local exe |
| Installer | `powershell -File build-installer.ps1` | NSIS installer |
| Upload installer | `aws s3 cp ... s3://taskflow-uploads-prod/downloads/` | S3 + CloudFront |

---

## Author

Developed by **Giridharan S** at **NEUROSTACK**

Copyright 2026 NEUROSTACK. All rights reserved.
