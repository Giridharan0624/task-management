/** Tenant-aware terminology lookup.
 *
 * Base strings live here. Per-tenant overrides come from
 * `OrgSettings.terminology` on the `/orgs/current` response and are
 * merged on top at runtime via `useT()`. A tenant that has never edited
 * terminology gets the base strings; a tenant that renamed "Task" to
 * "Ticket" gets "Ticket" everywhere `t('task.singular')` is called.
 *
 * Key format: `{domain}.{subkey}` — e.g. `task.singular`, `task.plural`,
 * `project.singular`. The `terminology` dict key matches the full key
 * (e.g. `"task.singular": "Ticket"`).
 *
 * IMPORTANT: the override values from OrgSettings are plain strings with
 * no escaping or interpolation. Never pass them through dangerouslySetInnerHTML.
 */

export const BASE_TERMINOLOGY: Record<string, string> = {
  // Tasks
  'task.singular': 'Task',
  'task.plural': 'Tasks',
  'task.new': 'New task',
  'task.create': 'Create task',
  'task.my': 'My tasks',

  // Projects
  'project.singular': 'Project',
  'project.plural': 'Projects',
  'project.new': 'New project',
  'project.create': 'Create project',

  // Users / team
  'user.singular': 'User',
  'user.plural': 'Users',
  'user.employee_id': 'Employee ID',
  'user.role': 'Role',
  'user.invite': 'Invite',
  'user.team': 'Team',

  // Attendance / timer
  'attendance.sign_in': 'Sign in',
  'attendance.sign_out': 'Sign out',
  'attendance.today': 'Today',
  'attendance.report': 'Attendance report',

  // Day-off
  'dayoff.singular': 'Day off',
  'dayoff.plural': 'Day-offs',
  'dayoff.request': 'Request day off',
  'dayoff.approve': 'Approve',
  'dayoff.reject': 'Reject',

  // Nav
  'nav.dashboard': 'Dashboard',
  'nav.projects': 'Projects',
  'nav.my_tasks': 'My tasks',
  'nav.all_tasks': 'All tasks',
  'nav.attendance': 'Attendance',
  'nav.my_attendance': 'My Attendance',
  'nav.day_offs': 'Day offs',
  'nav.task_updates': 'Daily updates',
  'nav.reports': 'Reports',
  'nav.birthdays': 'Birthdays',
  'nav.settings': 'Settings',
  'nav.roles': 'Roles',
  'nav.team': 'Team',
}

/** Resolve a terminology key against tenant overrides. Falls back to
 * the base string, then to the key itself (surfaces missing keys in
 * the UI for easier debugging). */
export function translate(
  key: string,
  overrides: Record<string, string> | null | undefined,
): string {
  if (overrides && key in overrides) {
    const v = overrides[key]
    if (typeof v === 'string' && v.length > 0) return v
  }
  return BASE_TERMINOLOGY[key] ?? key
}
