# TaskFlow — User Guide

Welcome to **TaskFlow**, your team's workspace for managing projects, tracking time, and staying on top of work.

---

## Getting Started

### Logging In
1. Open the app at your company's TaskFlow URL
2. Enter your **Email** or **Employee ID** (e.g., NS-DEV-26A7K3)
3. Enter your password
4. First time? You'll receive a one-time password via email — use it to log in, then set your own password

### Forgot Password?
1. Click "Forgot Password?" on the login page
2. Enter your email or Employee ID
3. Check your email for a verification code
4. Enter the code and set a new password

---

## Your Dashboard

The dashboard is the first thing you see after logging in. It shows:

- **Timer** (Admins & Members) — Start tracking your work immediately
- **Overdue Tasks** — Red alert if any tasks are past their deadline
- **Stat Cards** — Quick numbers: tasks, projects, members, with 7-day trend lines
- **Upcoming Deadlines** — Tasks due in the next 3 days
- **Project Progress** — Mini progress cards for each project (Owners/Admins)
- **Team Attendance** — Who's working right now, with live timers
- **Task Update** — Submit your daily work summary

---

## User Roles

TaskFlow has a role hierarchy that determines what you can do:

### Company Roles
| Role | What You Can Do |
|------|----------------|
| **Owner** | Full control — manages all users, projects, and company settings |
| **CEO / MD** | Full access + approves day-off requests |
| **Admin** | Creates projects and tasks, manages team members |
| **Member** | Works on assigned tasks, tracks time, submits updates |

### Project Roles
When you're added to a project, you get a project-level role:

| Role | What You Can Do |
|------|----------------|
| **Admin** | Full control within the project |
| **Project Manager** | Manages tasks, assigns work, views reports |
| **Team Lead** | Same as Project Manager |
| **Member** | Works on assigned tasks, updates status |

---

## Projects

### Creating a Project
1. Go to **Projects** from the sidebar
2. Click **Create Project**
3. Fill in:
   - **Name** — Project title
   - **Description** — What the project is about
   - **Domain** — Choose the work type (determines the task pipeline):
     - **Development** — For software/coding work
     - **Designing** — For design/creative work
     - **Management** — For planning/operations
     - **Research** — For research/analysis work
   - **Team Lead** — Optional, select a lead
   - **Members** — Add team members

### Project Page
Each project has 4 tabs:

- **Tasks** — Your task pipeline (see below)
- **Members** — Team members with roles, task counts, and inline role changes
- **Progress** — Health score, completion %, task breakdown with progress rings, team contribution
- **Reports** — Time tracking charts, estimated vs actual hours, session logs

---

## Task Pipeline

Tasks follow a workflow that depends on the project's **domain**:

### Development Pipeline
`To Do → In Progress → Developed → Code Review → Testing → Debugging → Final Testing → Done`

### Designing Pipeline
`To Do → In Progress → Wireframe → Design → Review → Revision → Approved → Done`

### Management Pipeline
`To Do → In Progress → Planning → Execution → Review → Done`

### Research Pipeline
`To Do → In Progress → Research → Analysis → Documentation → Review → Done`

### Working with Tasks

**Creating a Task:**
1. Click **New Task** in the pipeline
2. Enter title, description, priority, deadline
3. Assign team members

**Updating Task Status:**
- Click a task to open its details
- Use the status dropdown to move it through the pipeline
- Members can change the status of tasks assigned to them

**Filtering & Sorting:**
- **Search** — Type to find tasks by name
- **Sort** — By priority, deadline, title, or status
- **Filter by Priority** — High, Medium, Low
- **Filter by Assignee** — See one person's tasks
- **Overdue** — Toggle to show only overdue tasks

**Pipeline Pills:**
- Click any status pill (e.g., "Testing") to filter to just those tasks
- Click "All" to see everything

---

## Time Tracking

TaskFlow has built-in time tracking with live session management.

### Starting the Timer
1. On your dashboard, find the **Time Tracker**
2. Type what you're working on in the "What are you working on?" field (optional but helpful)
3. Select a **Source**:
   - **Meeting** — For meetings (no task selection needed, one-click start)
   - **Direct Tasks** — Tasks assigned directly to you
   - **Project Name** — Tasks from a specific project
4. Select a **Task** (not needed for meetings)
5. Click **Start**

### While the Timer is Running
- The live timer appears in the **sidebar** on every page
- Your **total hours today** update in real-time everywhere
- You can **switch tasks** — the current timer stops and a new one starts
- The description you entered is saved with the session

### Stopping the Timer
- Click **Stop** on the timer
- Your session is recorded with start time, end time, task, project, and description

### Quick Restart
- After stopping, a **Resume** button appears to restart your last task in one click

---

## Task Updates

At the end of your work day, submit a **Task Update** — a summary of what you worked on.

### Submitting an Update
1. Go to your **Dashboard**
2. Find the **Task Update** card
3. It auto-generates from your tracked sessions:
   - Sign-in / sign-out times
   - Tasks worked on with time breakdown
   - Your timer descriptions
4. **Stop your timer first** — you can't submit while the timer is running
5. Click **Submit Task Update**

### Viewing Team Updates (Admins/Owners)
1. Go to **Task Updates** from the sidebar
2. Navigate between dates using ← → arrows or the date picker
3. See each member's update card with task summaries
4. **Search** by name or Employee ID
5. **Export CSV** to download the day's updates

---

## Attendance

### For Members
- Your time is automatically tracked when you use the timer
- Go to **Attendance** to see your monthly summary

### For Admins/Owners
- See the **Team Attendance** table on your dashboard
- Live timers show who's currently working
- Go to **Attendance** page for detailed reports:
  - Monthly summary per member (days, hours, avg/day)
  - Per-task breakdown
  - Daily records with expandable session details
  - **Filter** by member
  - **Export CSV** for payroll/records

---

## Day Offs

### Requesting a Day Off
1. Go to **Day Offs** from the sidebar
2. Click **Request Day Off**
3. Select start date, end date, and reason
4. Submit — it goes to CEO/MD for approval

### Checking Status
- Your requests show in **My Requests** with status:
  - **Pending** — Waiting for approval
  - **Approved** — Day off granted
  - **Rejected** — Request denied
  - **Cancelled** — You cancelled it

### Cancelling a Request
- You can cancel any pending or approved request
- Click **Cancel Request** on the request card

### Approving (CEO/MD only)
- Pending requests appear in the **Pending Approvals** section
- Click **Approve** or **Reject**

---

## Reports

### Overall Reports (`/reports`)
Three views of your team's time data:

**Summary View:**
- Bar chart showing hours per project per day
- Pie chart showing project distribution
- Top tasks ranked by time spent
- Member breakdown with expandable session details

**Detailed View:**
- Complete log of every time session
- Columns: Date, Member, Project, Task, Start, End, Duration
- **Export CSV** button

**Weekly View:**
- Timesheet grid: Members × Days of the week
- Shows hours per cell
- Row and column totals
- Today's column highlighted

### Project Reports
Each project has its own **Reports** tab showing:
- Tracked hours vs estimated (budget %)
- Hours by task (bar chart)
- Status distribution (donut chart)
- Estimated vs actual hours comparison
- Member workload with task-level breakdown
- Session log with CSV export

### Filtering
- **Period**: Daily / Weekly / Monthly (or All Time for projects)
- **Member filter**: See one person's data
- **Date navigation**: ← → arrows to browse dates
- Reports **auto-refresh** every 60 seconds

---

## Users (Admin/Owner)

### Creating a User
1. Go to **Users** from the sidebar
2. Click **Add User** (or **Add Member**)
3. Enter email, name, role, and department
4. The user receives a welcome email with their Employee ID and one-time password

### Employee IDs
Employee IDs are auto-generated in this format:
```
NS-DEV-26A7K3
│   │   │  │
│   │   │  └── Unique hash
│   │   └───── Year joined
│   └───────── Department code (DEV/DES/MGT/RSH)
└────────────── Company prefix
```

The **company prefix** (default: NS) can be changed by the Owner in their profile settings.

### Managing Users
- **Change Role** — Promote or demote users (Owner/CEO/MD)
- **Change Department** — Update a user's department
- **View Progress** — See a user's task completion stats
- **Delete User** — Remove from the system (Owner/Admin)

---

## Profile

### Editing Your Profile
1. Click your avatar in the sidebar → **Profile**
2. Click **Edit Profile**
3. Update: name, phone, designation, location, bio, skills, personal info
4. Upload a **profile photo** (click your avatar)

### Profile Completeness
A progress ring shows how complete your profile is. Fill in all fields for 100%.

### Skills
Add your skills as comma-separated text. They display as colorful tags.

### Company Settings (Owner only)
- **Employee ID Prefix** — Change the prefix for new employee IDs (e.g., NS → NSTK)

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + K` (or `Cmd + K`) | Open Command Palette — search pages, projects, tasks |
| `Esc` | Close any modal, panel, or palette |

### Command Palette
Press `Ctrl+K` to open a search bar where you can:
- Navigate to any page (Dashboard, Tasks, Projects, Reports, etc.)
- Jump to a specific project by name
- Find a task by title
- Use ↑↓ arrows to navigate, Enter to open

---

## Notifications

Click the **bell icon** (🔔) in the sidebar header to see:
- **Overdue tasks** — Tasks past their deadline
- **Upcoming deadlines** — Tasks due today or tomorrow
- **Timer warnings** — If your timer has been running for 4+ hours
- **Today's hours** — How much you've tracked today

---

## Dark Mode

Toggle dark mode from your **Profile** page under theme settings. The entire app adapts — all colors, charts, backgrounds, and borders are optimized for dark viewing.

---

## Tips & Best Practices

1. **Start your timer** when you begin work — it's the foundation for reports and task updates
2. **Use descriptions** — "What are you working on?" helps your team understand your work
3. **Update task status** as you progress — the pipeline view keeps everyone aligned
4. **Submit task updates daily** — it creates an automatic work log
5. **Use the Command Palette** (`Ctrl+K`) to navigate quickly
6. **Check notifications** — the bell icon alerts you to overdue tasks
7. **Fill your profile** — skills and info help your team know you better

---

## FAQ

**Q: I can't see any tasks in the timer.**
A: The timer only shows tasks assigned to you. Ask your project admin to assign tasks to you.

**Q: I can't submit my task update.**
A: Stop your timer first. You can't submit while actively tracking time.

**Q: My employee ID looks different from others.**
A: New IDs use the format PREFIX-DEPT-YYHASH. Older accounts may have the EMP-XXXX format. Both work for login.

**Q: I can't change a task's status.**
A: You can only change the status of tasks assigned to you. Admins and leads can change any task.

**Q: What happens when I switch tasks in the timer?**
A: Your current session stops automatically and a new one starts for the new task.

**Q: Can I track time for meetings?**
A: Yes — select "Meeting" as the source in the timer. No task selection needed.

**Q: Can I cancel an approved day off?**
A: Yes — click "Cancel Request" on your approved request. Your manager will see it was cancelled.

**Q: What's the deadline overdue rule?**
A: If a deadline has only a date (no time), it's considered overdue at the **end of that day** (11:59 PM), not at midnight.

---

*Powered by NEUROSTACK*
