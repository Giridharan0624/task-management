# 5-Minute Demo Video Script — Owner POV

**Who you're playing:** Emma Thompson, CEO / Owner of NEUROSTACK
**Workspace:** `neurostack` (staging)
**Login:** `emma.thompson@neurostack.demo` / `Demo1234!`
**Total runtime:** ~4:30
**Register:** first-person founder voice, architectural/capability language — no vendor or service names

---

## 0:00 – 0:25 · Intro / hook

**[SHOW]** Login screen. Workspace code `neurostack` already filled. Type `emma.thompson@neurostack.demo` and password.

**[SAY]** "Running a company, I need one place that tells me what's being built, who's building it, and how they're doing. One workspace — isolated from every other company on the platform, shaped end-to-end to how my team works. Let me walk you through a day, as the founder of NEUROSTACK."

---

## 0:25 – 1:00 · Dashboard — the founder's view

**[SHOW]** Land on dashboard. Pan across the widgets.

**[SAY]** "The dashboard isn't my to-do list — it's the company's pulse. Active projects, the team's hours this week, anything routed to me: leave I'm the approver on, flagged blockers. Every view is scoped to my workspace — my data and another company's never mix, at any layer, not just in the UI."

---

## 1:00 – 1:40 · Projects — everything that's shipping

**[SHOW]** Click **Projects**. Show all six. Open Payments Platform V2 → kanban. Drag a task.

**[SAY]** "Projects. Everything shipping across the company. Each project binds to a pipeline — and pipelines are first-class entities, not hardcoded columns. A named set of statuses, with order, color, and a terminal flag. Four templates ship; admins define more. Tasks reference their pipeline, so renaming a stage propagates everywhere. Each task carries its own thread — multi-assignee, priority, deadline, attributed comments."

---

## 1:40 – 2:10 · Team — who's in the workspace

**[SHOW]** Click **Admin → Users**. Scan across the 50 people and the department spread.

**[SAY]** "The team. Fifty people, seven departments. Permissions aren't tied to three fixed roles — there's a catalog of thirty-five granular actions, and roles compose from that catalog. I can define a 'Lead Engineer' who approves leave but can't edit settings. Three system roles ship — Owner, Admin, Member — and any custom role I define is honored everywhere the permission is checked."

---

## 2:10 – 2:40 · Desktop companion — how time gets tracked

**[SHOW]** Cut to the Windows system tray. Click the app icon to open the desktop companion. Pick an active task from the dropdown. Hit **Start**. The activity counter begins ticking. Minimize it back to the tray.

**[SAY]** "Everything time-related runs through a small companion in the system tray — an auto-updating binary. When I pick a task and hit start, it samples input cadence and app focus in five-minute windows and forwards them to the workspace. Token lives in the OS credential store, not on disk. If the network drops, samples queue locally and sync when it's back."

---

## 2:40 – 3:10 · Attendance + task updates

**[SHOW]** Back to the browser. Click **Attendance** → team grid. Then **Task Updates** → today's standup list.

**[SAY]** "Back on the web, this is where the captured time lands. Attendance is recorded per user, per day, broken into sessions — sign-in, sign-out, active task — rolled up into weekly and monthly reports. Task updates are the narrative layer on top: what I did, not just when I was online."

---

## 3:10 – 3:45 · Day-off workflow

**[SHOW]** Click **Day-offs**. Open one pending request routed to you. Show approve/reject.

**[SAY]** "Leave lives in the same workspace, on a two-stage approval chain. People request against the leave types I've defined — casual, sick, earned, or any custom type with its own yearly quota. Requests route to the team lead, then to an admin. Every transition is logged — who, when, any note — so I have an audit trail I can pull later."

---

## 3:45 – 4:15 · Activity insights

**[SHOW]** Click the activity report page. Show a user's daily summary with the AI paragraph and productivity score.

**[SAY]** "The activity the desktop app captures turns into something useful here. Each five-minute bucket holds input cadence, active versus idle, the apps in focus. At end-of-day those buckets feed a summarization model — the paragraph, a productivity score, the day's themes. Raw buckets stay in the workspace; the summary is a derivative view. Gated by plan tier."

---

## 4:15 – 4:45 · Settings — shaping the workspace

**[SHOW]** Click **Settings → Roles** → show the permission matrix. Then **Settings → Organization** → branding, terminology, leave types.

**[SAY]** "Everything I've shown you is shaped from here. The roles matrix is that thirty-five-permission catalog — toggle actions on a role, or define entirely new roles. Branding: logo, colors, favicon — applied everywhere. Terminology is an override map — if we called them 'missions' instead of 'tasks', the whole product picks up the new label without a code change. Leave types, working hours, timezone, feature flags — every knob on one screen."

---

## 4:45 – 5:00 · Close

**[SHOW]** Return to dashboard.

**[SAY]** "Projects, people, time, permissions — one tenant-isolated workspace, shaped end-to-end by me as the founder. That's how a company runs day-to-day."

---

## Recording notes

### Before you hit record
- Point [frontend/.env.local](frontend/.env.local) at the staging Cognito pool (`ap-south-1_NedaPlHsx`, region `ap-south-1`). Confirm `npm run dev` serves the staging-backed app on `localhost:3000`.
- Log in once manually to prime caches — first-load can be laggy.
- Close Slack/email/notifications. Silence the phone.
- Browser: Chrome in a clean profile, zoomed to 100%, window sized 1920×1080. Hide the bookmarks bar.

### Desktop segment (2:10 – 2:40)
- Record the desktop clip **separately** from the browser tour — hard-cut into the final edit.
- Run `wails dev` from [desktop/](desktop/) for a dev binary, or `make windows` per [desktop/Makefile](desktop/Makefile) for a production build.

### Speaking tips
- Total script is ~540 words → lands at 4:00–4:30 at natural pace. Plenty of room to breathe at transitions.
- Read first-person as Emma. Smoother than narrator voice for an Owner demo.
- Lines to slow down on — let the architectural phrases land:
  - *"pipelines are first-class entities, not hardcoded columns"* (1:00)
  - *"catalog of thirty-five granular actions"* (1:40)
  - *"samples input cadence and app focus in five-minute windows"* (2:10)
  - *"raw buckets stay in the workspace; the summary is a derivative view"* (3:45)
- If you fluff a line, keep going — cut it in post.

### Editing
- Light background music under everything, ducked -20dB during narration.
- Zoom in during the desktop segment and the roles permission matrix — small UI, needs emphasis.
- End with a 1-second hold on the dashboard before cutting.
