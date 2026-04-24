# UX Backlog — P1 & P2

Everything left on the UX audit after P0 finished. Each item lists why it matters, rough effort, acceptance criteria, and any dependency on other items so whoever picks up the work can sequence it without re-deriving the audit.

Status legend: `[ ]` not started · `[~]` partial · `[x]` done (left in place for recently-completed items during triage).

---

## Suggested next batch (highest impact-per-hour right now)

1. **P1 · Breadcrumbs everywhere** — quickest nav-clarity win, one shared primitive and a sweep.
2. **P1 · Duplicate task / project action** — obvious gap in power-user flow.
3. **P1 · Extend saved views to Projects + Admin Users** — reuse the shipped `useSavedViews` hook; ~5 min per page.
4. **P1 · Smart form defaults** — project-member defaults, "next workday" default for day-off, etc.
5. **P2 · Density toggle + context menus** — polish that cumulatively makes power users faster.

Everything else should be demand-driven or bundled with a related feature.

---

## P1 — foundational lifts, ship when user-visible work allows

### Navigation & findability

- [ ] **Breadcrumbs everywhere**
  - Why: Users can't tell where they are two clicks deep (e.g. a task inside a project inside a filtered view).
  - Effort: ~30 min. One `<Breadcrumbs>` primitive already exists (`components/ui/Breadcrumbs.tsx`) — sweep is mostly wiring the trail on each page.
  - Acceptance: every `(dashboard)/` page renders a `<Breadcrumbs>` between the top-bar and the `PageHeader`, including dynamic segments (project name, user name).
  - Depends on: nothing.

- [~] **Saved views on Projects and Admin Users**
  - Why: `useSavedViews` already ships for My Tasks; other list pages should get the same affordance.
  - Effort: ~5 min per page (import `SavedViewsBar`, thread `useSearchParams`).
  - Acceptance: users can save/apply/rename/delete named filter snapshots on `/projects` and `/admin/users`.
  - Depends on: already-merged saved-views primitive.

### Speed & perceived performance

- [ ] **Suspense boundaries per widget**
  - Why: a single slow query currently blocks sibling widgets on the dashboard and project detail.
  - Effort: ~45 min. Wrap each independently-fetching widget in its own `<Suspense>` with a matching skeleton.
  - Acceptance: TodayHero, TeamPulseStrip, WhoIsWorking, TopProjects, and QuickActions each reveal independently while others render immediately from cache.
  - Depends on: React Query's `useSuspenseQuery` variant on the relevant hooks.

### Forms & data entry

- [ ] **Smart form defaults**
  - Why: Create-task should pre-pick current assignee/project context; Day-off should default to next workday; Invite should default role per invoking user.
  - Effort: ~45 min spread across 5 dialogs.
  - Acceptance: opening a create dialog from a context already pre-fills everything derivable from that context; user types less.
  - Depends on: nothing.

- [ ] **Unified date/time picker with relative presets**
  - Why: Today DatePicker + TimePicker are separate and none offer "tomorrow", "next Monday", "end of week" shortcuts.
  - Effort: ~90 min. New primitive in `components/ui/` replacing both in CreateTaskModal and DayOffCreateDialog first.
  - Acceptance: one picker, keyboard-navigable, relative presets as a sidebar, absolute calendar in main view, optional time.
  - Depends on: nothing.

### Feedback, errors & recovery

- [ ] **Offline mutation queue**
  - Why: OfflineBanner already warns users but writes still fail. Queue them and replay on reconnect.
  - Effort: ~2 hours. React Query's `persister` + a custom network-aware retry policy.
  - Acceptance: flipping offline → make two writes → flip online → both writes replay in order without duplicates.
  - Depends on: none; complements the already-shipped OfflineBanner.

- [ ] **Copy-friendly error messages with codes**
  - Why: Today toasts say "Failed to load" with no handle for support. A short code makes bug reports actionable.
  - Effort: ~45 min. Centralize error envelopes in the API client and surface `err.code` in toasts.
  - Acceptance: every error toast includes a 4–6 char code users can copy, and the code maps back to a backend log line.
  - Depends on: minor backend alignment on error envelope shape (no new endpoint).

### Bulk & power-user actions

- [ ] **Duplicate task / duplicate project**
  - Why: Repeating work is tedious without this. Currently users copy-paste fields one by one.
  - Effort: ~40 min. Add a "Duplicate" action to the ⋯ menu on cards and the detail panel. Backend may need a `copyFromId` parameter or we can fetch + recreate client-side.
  - Acceptance: ⋯ → Duplicate opens the create dialog pre-filled with all fields except title (auto-appends "(copy)"); submit creates a new record.
  - Depends on: nothing for client-side clone; backend parameter optional.

### Mobile & responsive

- [ ] **Bottom sheet in place of Dialog on mobile**
  - Why: Full-height bottom sheet feels native on phones; centered Dialog wastes touch targets.
  - Effort: ~60 min. Extend the `Dialog` primitive to switch to a Sheet at `<sm` breakpoint.
  - Acceptance: CreateTaskModal, DayOffCreateDialog, ProfileEditDialog slide up from the bottom on ≤640px; desktop unchanged.
  - Depends on: nothing.

- [ ] **Sticky header shrinks on scroll**
  - Why: On mobile the fixed top bar + PageHeader + StatStrip eats ~200px before content shows.
  - Effort: ~30 min. Add scroll listener on main, collapse PageHeader description at >40px scroll.
  - Acceptance: scrolling past the first 40px collapses the description line and tightens padding; scrolling up expands again. Respects `prefers-reduced-motion`.
  - Depends on: nothing.

### Accessibility

- [ ] **Announce live regions beyond toast**
  - Why: Screen readers miss state changes like "Task marked done", timer tick, bulk operation progress.
  - Effort: ~45 min. A single `LiveAnnouncer` component in the root, and callsites push short messages via a context.
  - Acceptance: NVDA/VoiceOver announce status/priority/assignee changes and bulk-action results.
  - Depends on: nothing.

### Onboarding & discoverability

- [ ] **Empty-workspace home for non-owners**
  - Why: SetupChecklist covers OWNER. Admins and members on a brand-new workspace still see empty widgets.
  - Effort: ~30 min. A MemberDashboard variant that shows guidance when there are 0 projects or 0 tasks assigned.
  - Acceptance: on a fresh workspace, admins/members see prompts like "Your admin hasn't assigned any work yet" instead of empty stat cards.
  - Depends on: nothing.

### Notifications & attention

- [ ] **Per-user notification preferences**
  - Why: No way to turn off specific event types (day-off, deadlines, mentions).
  - Effort: ~2 hours. Profile settings section + localStorage-backed prefs consumed by the client-computed bell.
  - Acceptance: user can mute categories; NotificationCenter filters accordingly.
  - Depends on: the existing client-computed notification pipeline.

- [ ] **Mention badges in sidebar and tab headers**
  - Why: Sidebar already shows a count for day-offs and tasks. Extend to task-updates, comments-waiting-for-you, etc.
  - Effort: ~30 min per badge location.
  - Acceptance: unread / needs-action counts appear on the relevant nav item with the right color coding.
  - Depends on: nothing.

### Personalization

- [~] **Saved views** (see "Saved views on Projects/Admin Users" above).

- [ ] **Theme detection from system**
  - Why: ThemeToggle exists but no "system" option.
  - Effort: ~20 min. Add `system` to theme states + media-query listener.
  - Acceptance: picking "System" follows `prefers-color-scheme` and updates live as the OS changes.
  - Depends on: nothing.

### Data hygiene

- [ ] **Consistent number formatting**
  - Why: Hours render as `1.5h`, `1h 30m`, `90m` in different places.
  - Effort: ~30 min. Centralize `formatDuration` and sweep hand-rolled formatters.
  - Acceptance: every duration goes through the one helper; `1.5h` never appears.
  - Depends on: nothing.

- [ ] **Scheduled CSV / PDF reports**
  - Why: Admins export on demand; recurring weekly reports would save repetition.
  - Effort: ~3 hours incl. backend work to queue and email the export.
  - Acceptance: admin picks cadence + recipients on the Reports page; delivery starts next period.
  - Depends on: backend cron + email infra (already present for Gmail SMTP).

### Content & microcopy

- [ ] **Plain-language microcopy pass**
  - Why: "Priority" / "Severity" / "Tier" used inconsistently; empty-state copy varies in tone.
  - Effort: ~90 min, end-to-end audit. Feeds into the terminology-override system we already have.
  - Acceptance: one pass document of current strings → proposed strings → shipped. No jargon in user-facing surfaces.
  - Depends on: nothing.

- [ ] **Consistent verbs**
  - Why: "Add" / "Create" / "New" all used for the same action.
  - Effort: bundled with the microcopy pass.
  - Acceptance: one verb per action type across the app.

- [ ] **Help tooltips on jargon**
  - Why: New users don't know what "workspace code", "scope", "task update" mean.
  - Effort: ~45 min. Reuse the shipped `Tooltip` primitive next to these labels.
  - Acceptance: hover explains the term; tooltip dismisses on focus-out.
  - Depends on: nothing.

### Trust & transparency

- [ ] **Activity feed per project and per task**
  - Why: "Who changed this, when?" is answered nowhere right now.
  - Effort: ~4 hours incl. backend event table + client renderer. Significant scope.
  - Acceptance: project detail has a "History" tab; task detail a collapsed "Activity" section below comments.
  - Depends on: backend DDD event-sourcing decision; probably a new lightweight `events` bounded context.

### Admin & power-workspace

- [ ] **Bulk invite (CSV paste)**
  - Why: Inviting 20 engineers one at a time is painful.
  - Effort: ~60 min. Paste-area in the invite modal, parse email-per-line, fan out.
  - Acceptance: paste 20 emails, submit once, see per-row success/failure.
  - Depends on: existing single-invite endpoint; maybe a batch endpoint for fewer network calls.

- [ ] **Role-change audit log**
  - Why: Compliance will want to know who promoted whom and when.
  - Effort: ~2 hours incl. backend.
  - Acceptance: a settings section lists role changes with `{actor, target, from, to, at}`.
  - Depends on: new audit table in the `user` context or shared audit table.

- [ ] **Whole-workspace data export (GDPR-ready)**
  - Why: Big customers ask for portable exports; privacy regs require them.
  - Effort: ~half-day including backend zip-stream + download URL.
  - Acceptance: owner triggers export → gets a signed S3 URL via email/inbox → zip includes users, projects, tasks, attendance, day-offs in JSON + CSV.
  - Depends on: presign infrastructure (already there).

---

## P2 — polish and delight, do when prioritized by product

### Navigation & findability

- [ ] **Recent items menu**
  - Why: Quick jump to last 5 projects/tasks viewed — complements Cmd+K.
  - Effort: ~30 min. localStorage-backed ring buffer + sidebar section.
  - Depends on: nothing.

### Forms & data entry

- [ ] **@-mentions in comments and task updates**
  - Why: Tag teammates in updates; improves async coordination.
  - Effort: ~3 hours. Trigger input, user-search popover, render tagged users as pills, notify on save.
  - Depends on: notification pipeline (currently client-computed).

- [ ] **Markdown support with live preview**
  - Why: Task descriptions and comments benefit from headings, lists, code.
  - Effort: ~90 min. Add `react-markdown` + a "Write / Preview" toggle.
  - Depends on: none; don't ship without XSS sanitization.

### Bulk & power-user actions

- [ ] **Context menus (right-click)**
  - Why: Power users expect right-click on task rows / project cards. Reuses our DropdownMenu primitive.
  - Effort: ~60 min. Radix ContextMenu wrapper mirroring the ⋯ menu items.
  - Depends on: nothing.

### Mobile & responsive

- [ ] **Swipe actions on task rows**
  - Why: "Mark done" or "Delete" with a thumb swipe is standard on native apps.
  - Effort: ~90 min. Hammer/Framer-motion gesture handler on `TaskRow` mobile variant.
  - Depends on: nothing.

### Onboarding & discoverability

- [ ] **In-app help drawer indexed into `docs/`**
  - Why: Users shouldn't leave the app for docs; bundle key articles.
  - Effort: ~90 min. Right-side Sheet with search + article links.
  - Depends on: `docs/` markdown being re-used (build step to pull into client).

- [ ] **Sample-data toggle for new workspaces**
  - Why: Lets new admins explore the UI without needing to create everything.
  - Effort: ~2 hours. Server-side seeder + a profile-page toggle; careful to scope only to the caller's workspace.
  - Depends on: nothing architectural, but careful teardown.

### Notifications & attention

- [ ] **Digest emails (daily / weekly)**
  - Why: Managers prefer an end-of-day summary over per-event emails.
  - Effort: ~4 hours — backend scheduler + template + delivery.
  - Depends on: the real notification backend (otherwise we can't track what's already been seen).

### Personalization

- [ ] **Dashboard widget preferences**
  - Why: Let users hide widgets they don't care about and reorder the rest.
  - Effort: ~2 hours. Drag-to-reorder + hide toggles + localStorage persistence.
  - Depends on: nothing.

- [ ] **Density toggle (compact / comfortable)**
  - Why: Power users want more rows on screen; managers want readable cards.
  - Effort: ~30 min. CSS-var driven density factor read by list/card components.
  - Depends on: nothing.

### Data hygiene

- [ ] **Print styles on reports**
  - Why: Exec exports via "Print → Save as PDF" right now look bad.
  - Effort: ~45 min. Add a dedicated `@media print` stylesheet that collapses the sidebar, widens tables, strips hover states.
  - Depends on: nothing.

### Trust & transparency

- [ ] **Last-edited-by metadata on cards**
  - Why: Quick answer to "who touched this last?" without opening Activity.
  - Effort: ~20 min if the backend already returns `updatedBy` (it doesn't — ~1 hour with backend change).
  - Depends on: backend adding an `updatedBy` field to mutations.

- [ ] **Live indicators everywhere**
  - Why: `LiveDot` is on dashboard only; extend to attendance, reports, anywhere "current state" is being shown.
  - Effort: ~20 min sweep.
  - Depends on: nothing.

### Admin & power-workspace

- [ ] **Tenant settings "Preview as member"**
  - Why: Owners configuring branding / terminology can't see the member view without logging in as one.
  - Effort: ~60 min. Read-only mode that toggles a `previewRole` context value.
  - Depends on: nothing.

---

## Out of scope here (parked separately)

- **Color scheme migration** (navy/slate) — tracked by user feedback; requires token flip + sweep of hardcoded indigo/violet references.
- **Notification backend endpoint** — deliberately deferred until after SaaS cutover, per current risk posture. See the root `CLAUDE.md` constraint ("no prod-touching actions during SaaS migration").
- **Desktop app P0 security issues** from `Bug-Report-Go.md` — tracked in that document, not a UX item but blocks wider rollout.
- **Test coverage** on the new hooks (useSavedViews, useAutosaveDraft, useUndoableDelete, useUrlState, useMultiSelect, useUserTimezone) — good follow-up; not user-facing.

---

## How to pick up an item

1. Read the acceptance criteria — they're the definition of done.
2. Check the existing primitives listed in [../guides/TEAMMATE-ONBOARDING.md](../guides/TEAMMATE-ONBOARDING.md) before building new ones.
3. Run `npx tsc --noEmit` before committing. The frontend does not currently use ESLint (Next 16 removed `next lint`).
4. Keep scope tight — ship the acceptance criteria, not an ambient refactor.
