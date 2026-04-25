/** Permission metadata catalog — friendly labels + destructive flag.
 *
 * Mirrors backend/src/contexts/org/domain/permissions.py. When you add a
 * permission constant on the backend, add an entry here too. Permissions
 * not listed get a humanized fallback derived from the ID.
 */

export interface PermissionMeta {
  /** Human-readable label shown to admins in the role editor. */
  label: string
  /** One-line description for tooltips / hover (optional). */
  description?: string
  /** Mark destructive (delete-style) actions in the UI so they stand out. */
  destructive?: boolean
}

export const PERMISSION_META: Record<string, PermissionMeta> = {
  // Settings & roles
  'settings.view': { label: 'View settings' },
  'settings.edit': {
    label: 'Edit organization settings',
    description: 'Branding, terminology, features, locale.',
  },
  'role.manage': {
    label: 'Manage roles',
    description: 'Create, edit, delete custom roles.',
  },
  'billing.view': { label: 'View billing' },

  // Users
  'user.list': { label: 'List users' },
  'user.progress.view': { label: 'View user progress' },
  'user.invite': { label: 'Invite users' },
  'user.create': { label: 'Create users directly' },
  'user.update.any': { label: 'Edit any user' },
  'user.update.own': { label: 'Edit own profile' },
  'user.delete': { label: 'Delete users', destructive: true },
  'user.role.manage': { label: 'Change user roles' },

  // Projects
  'project.create': { label: 'Create projects' },
  'project.list.all': { label: 'List all projects' },
  'project.members.list': { label: 'List project members' },
  'project.members.manage': { label: 'Manage project members' },
  'project.edit': { label: 'Edit projects' },
  'project.delete': { label: 'Delete projects', destructive: true },

  // Tasks
  'task.create': { label: 'Create tasks' },
  'task.list': { label: 'List tasks' },
  'task.view.all': { label: 'View all tasks' },
  'task.update.any': { label: 'Edit any task' },
  'task.update.own': { label: 'Edit own tasks' },
  'task.delete.any': { label: 'Delete any task', destructive: true },
  'task.manage': { label: 'Full task management' },
  'task.assign': { label: 'Assign tasks', description: 'Re-assign existing tasks to other members.' },

  // Comments
  'comment.create': { label: 'Add comments' },
  'comment.list': { label: 'View comments' },

  // Day-offs
  'dayoff.request': { label: 'Request days off' },
  'dayoff.request.list.all': { label: 'View all day-off requests' },
  'dayoff.approve': { label: 'Approve day-offs' },
  'dayoff.reject': { label: 'Reject day-offs' },

  // Attendance
  'attendance.report.view': { label: 'View attendance reports' },

  // Activity
  'activity.report.view': { label: 'View activity reports' },
  'activity.summary.generate': { label: 'Generate activity summaries' },

  // Daily updates
  'taskupdate.list.all': { label: 'View all daily updates' },
}

/** Friendly labels for the domain prefix groupings. */
export const DOMAIN_LABEL: Record<string, string> = {
  settings: 'Organization',
  role: 'Roles',
  billing: 'Billing',
  user: 'Users',
  project: 'Projects',
  task: 'Tasks',
  comment: 'Comments',
  dayoff: 'Day-offs',
  attendance: 'Attendance',
  activity: 'Activity',
  taskupdate: 'Daily updates',
}

/** Get the metadata for a permission ID. Always returns a label —
 * unknown permissions fall back to a humanized form of the ID. */
export function metaFor(permissionId: string): PermissionMeta {
  const known = PERMISSION_META[permissionId]
  if (known) return known
  // Fallback: take the last segment, replace separators with spaces,
  // capitalize. Better than showing the raw id when a new backend
  // permission ships before this catalog gets updated.
  const last = permissionId.split('.').slice(-1)[0] ?? permissionId
  return {
    label: last.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
  }
}

/** Domain-prefix label, falling back to a humanized form. */
export function domainLabel(domain: string): string {
  return (
    DOMAIN_LABEL[domain] ??
    domain.charAt(0).toUpperCase() + domain.slice(1)
  )
}
