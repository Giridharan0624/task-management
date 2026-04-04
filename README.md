# TaskFlow — Task Management & Time Tracking System

A comprehensive serverless task management platform with a desktop companion app for activity monitoring. Built on AWS with Next.js frontend and a Wails v2 desktop app. Designed for organizations to manage projects, assign tasks, track time, monitor employee activity, and generate AI-powered work summaries.

**Web App:** [taskflow-ns.vercel.app](https://taskflow-ns.vercel.app)
**Desktop App:** [GitHub Releases](https://github.com/Giridharan0624/taskflow-desktop/releases)

---

## System Overview

```
┌─────────────────┐     ┌──────────────────┐     ┌─────────────────┐
│  Web App         │     │  AWS Backend      │     │ Desktop App      │
│  (Next.js 16)    │────>│  Lambda + DynamoDB│<────│ (Wails v2 / Go) │
│  Vercel          │     │  Cognito + S3     │     │ Windows          │
└─────────────────┘     └──────────────────┘     └─────────────────┘
                              │                        │
                         CloudFront CDN          Activity Monitor
                         Groq AI (LLaMA 3.3)     Screenshots
                                                 System Tray
```

---

## Features

### Web Application

#### User & Role Management
- **3-tier system RBAC:** OWNER > ADMIN > MEMBER
- **4-tier project RBAC:** ADMIN > PROJECT_MANAGER > TEAM_LEAD > MEMBER
- Auto-generated Employee IDs (NS-26AK76 format)
- Login via email or Employee ID
- Profile with S3 avatar uploads, skills, bio
- Day-off score per user (100/75/50/25 based on monthly leaves)

#### Project & Task Management
- 4 domains: Development, Designing, Management, Research
- Domain-specific task pipelines (8 stages for Development, 6 for Management, etc.)
- Kanban board per project with drag-and-drop status
- Multi-assignee tasks with deadlines and priority
- Task comments and progress tracking

#### Clockify-Style Time Tracker
- Select Source > Select Task > Start timer
- Meeting mode (no task required)
- Live ticking timer with task switching
- Multiple sessions per day with descriptions
- Tab title + favicon updates when timer active

#### Attendance & Reporting
- Monthly attendance reports with CSV export
- 4 report views: Summary, Detailed, Weekly, **Activity**
- Per-task time breakdown with descriptions
- Team attendance dashboard
- Day-off integration (shows who's on leave)

#### Activity Reports (from Desktop App)
- App usage charts (VS Code, Chrome, Slack, etc.)
- Active vs idle time donut chart
- Keyboard and mouse event counts
- Screenshot timeline gallery
- **AI Work Summary** — Groq LLaMA 3.3 generates daily work analysis
- Productivity score (1-10) with concerns flagging
- Auto-generates summaries at 11:30 PM IST daily

#### Day-Off Management
- Request single/multi-day leave
- Auto-routed to OWNER/ADMIN for approval
- Self-approval prevention
- Cancel approved requests
- Day-off score visible in profile and reports

### Desktop Application

#### Timer & Task Tracking
- Same timer functionality as web app
- Start/Stop/Switch tasks with project selection
- Meeting mode with one-click start
- Resume previous sessions
- Syncs with web app via 10-second polling

#### Activity Monitoring (while timer is ON)
- Keyboard press count (no key values recorded)
- Mouse event count (no coordinates stored)
- Active window/application name tracking
- Active vs idle time detection
- 5-minute heartbeat buckets sent to backend

#### Screenshots
- Captures screen every 10 minutes
- 5-second warning notification before capture
- Skips when screen is locked
- 50% scaled JPEG (quality 60) uploaded to S3
- Screenshots visible in web Activity reports

#### Security
- DPAPI-encrypted token storage (Windows Credential Manager)
- TLS 1.3 minimum for all API calls
- HTTPS enforced — rejects HTTP
- Config injected at build time (not on disk)
- Input validation on all frontend-to-backend calls

#### System Tray
- Runs in background when window closed
- Red dot indicator when timer is active
- Right-click menu: Show/Stop Timer/Dashboard/Quit
- Windows toast notifications for screenshots

#### Auto-Update
- Checks GitHub releases on startup
- Shows update banner when new version available
- One-click download and install

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Backend** | Python 3.12, AWS Lambda (50 functions) |
| **Infrastructure** | AWS CDK (Python) |
| **API** | AWS API Gateway (REST) with Cognito Authorizer |
| **Auth** | AWS Cognito (JWT + SRP) |
| **Database** | AWS DynamoDB (single-table design, 2 GSIs) |
| **File Storage** | AWS S3 + CloudFront CDN |
| **AI** | Groq API (LLaMA 3.3 70B) |
| **Secrets** | AWS Secrets Manager |
| **Web Frontend** | Next.js 16, TypeScript, Tailwind CSS, Recharts |
| **Desktop App** | Go 1.22, Wails v2, Preact, TailwindCSS |
| **Desktop Installer** | NSIS |
| **Deployment** | Vercel (web), AWS (backend), GitHub Releases (desktop) |

---

## Architecture

### Backend — Domain-Driven Design (DDD)

```
handlers/        → Lambda entry points (50 functions)
    ↓
application/     → Use cases (business logic + RBAC)
    ↓
infrastructure/  → DynamoDB repos, Cognito, S3, Groq AI
    ↑
domain/          → Pure entities, interfaces (no AWS deps)
```

### API Endpoints (60+)

| Category | Endpoints | Auth |
|----------|-----------|------|
| Users | 11 (CRUD, roles, profile, progress) | JWT |
| Projects | 9 (CRUD, members, status) | JWT |
| Tasks | 6 (CRUD, assign) | JWT |
| Comments | 2 (create, list) | JWT |
| Attendance | 5 (sign-in/out, reports) | JWT |
| Day-Offs | 7 (request, approve, reject, cancel) | JWT |
| Task Updates | 3 (submit, list) | JWT |
| Activity | 6 (heartbeat, report, AI summary) | JWT |
| Uploads | 1 (S3 presigned URLs) | JWT |
| Resolve Employee | 1 (Employee ID → email) | Public |

### Database — Single Table Design

| Item | PK | SK |
|---|---|---|
| User | `USER#{userId}` | `PROFILE` |
| Project | `PROJECT#{projectId}` | `METADATA` |
| Project Member | `PROJECT#{projectId}` | `MEMBER#{userId}` |
| Task | `PROJECT#{projectId}` | `TASK#{taskId}` |
| Comment | `TASK#{taskId}` | `COMMENT#{ts}#{id}` |
| Attendance | `USER#{userId}` | `ATTENDANCE#{date}` |
| Day Off | `USER#{userId}` | `DAYOFF#{ts}#{id}` |
| Task Update | `USER#{userId}` | `TASKUPDATE#{date}` |
| Activity | `USER#{userId}` | `ACTIVITY#{date}` |
| AI Summary | `USER#{userId}` | `SUMMARY#{date}` |

### AWS Resources

| Service | Usage |
|---------|-------|
| Lambda | 50 functions (10s timeout, shared layer) |
| DynamoDB | Single table, on-demand, PITR enabled |
| Cognito | User pool with email sign-in |
| API Gateway | REST API with Cognito authorizer |
| S3 | File uploads (avatars, screenshots, attachments) |
| CloudFront | CDN for uploaded files |
| Secrets Manager | Groq API key, Gmail SMTP credentials |
| EventBridge | Daily AI summary cron (11:30 PM IST) |

---

## Getting Started

### Prerequisites

- AWS CLI configured with credentials
- AWS CDK CLI (`npm install -g aws-cdk`)
- Python 3.12
- Node.js 18+

### 1. Deploy Backend

```bash
cd backend/cdk
pip install -r requirements.txt
cdk bootstrap  # First time only
cdk deploy
```

For staging:
```bash
cdk deploy --app "python app_staging.py"
```

### 2. Run Web Frontend

```bash
cd frontend
npm install
npm run dev
```

Create `frontend/.env.local`:
```env
NEXT_PUBLIC_API_URL=https://<api-id>.execute-api.ap-south-1.amazonaws.com/staging
NEXT_PUBLIC_COGNITO_USER_POOL_ID=<from CDK output>
NEXT_PUBLIC_COGNITO_CLIENT_ID=<from CDK output>
NEXT_PUBLIC_AWS_REGION=ap-south-1
```

### 3. Build Desktop App

See [desktop/RELEASE-GUIDE.md](desktop/RELEASE-GUIDE.md) for full instructions.

```powershell
cd desktop
# Dev mode
wails dev

# Production build + installer
powershell -File build-installer.ps1
```

---

## Project Structure

```
task-management/
├── backend/
│   ├── cdk/                    # AWS CDK infrastructure
│   │   ├── app.py              # Production stack
│   │   ├── app_staging.py      # Staging stack
│   │   └── stack.py            # Stack definition
│   └── src/
│       ├── handlers/           # Lambda handlers (50 functions)
│       │   ├── user/           # User management
│       │   ├── project/        # Project CRUD
│       │   ├── task/           # Task CRUD
│       │   ├── attendance/     # Time tracking
│       │   ├── dayoff/         # Leave management
│       │   ├── taskupdate/     # Daily updates
│       │   ├── activity/       # Activity monitoring + AI
│       │   ├── upload/         # S3 presigned URLs
│       │   └── comment/        # Task comments
│       ├── application/        # Use cases (business logic)
│       ├── domain/             # Entities + interfaces
│       └── infrastructure/     # DynamoDB, Cognito, S3, Groq AI
│
├── frontend/                   # Next.js 16 web app
│   └── src/
│       ├── app/(dashboard)/    # Dashboard pages
│       ├── components/         # React components
│       ├── lib/                # API client, hooks, utils
│       └── types/              # TypeScript types
│
├── desktop/                    # Wails v2 desktop app (separate repo)
│   ├── internal/
│   │   ├── auth/               # Cognito + DPAPI encryption
│   │   ├── api/                # HTTP client (TLS 1.3)
│   │   ├── monitor/            # Activity, screenshots, notifications
│   │   ├── tray/               # System tray (Win32)
│   │   ├── config/             # Build-time config
│   │   └── updater/            # Auto-update via GitHub
│   └── frontend/               # Preact UI
│
├── DESKTOP-CONSENT-AND-INSTALLER-PLAN.md
├── task-management-prd.md
└── README.md
```

---

## Security

| Feature | Implementation |
|---------|---------------|
| Authentication | AWS Cognito JWT (SRP flow) |
| Authorization | RBAC checked at use-case layer from DynamoDB (not JWT cache) |
| Token Storage (Desktop) | Windows DPAPI encryption + Credential Manager |
| API Communication | HTTPS enforced, TLS 1.3 minimum |
| File Uploads | S3 presigned URLs (no AWS keys in frontend) |
| Secrets | AWS Secrets Manager (Groq API key, Gmail SMTP) |
| Config | Injected at build time via ldflags (not on disk) |
| Activity Monitoring | Consent required, no keystrokes recorded, only counts |
| Screenshots | 5-second warning, skips locked screen |
| Password Policy | 8+ chars, uppercase, lowercase, digits |

---

## License

Private project. All rights reserved. Built by NEUROSTACK.
