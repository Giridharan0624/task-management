export type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH'

export type TaskDomain = 'DEVELOPMENT' | 'DESIGNING' | 'MANAGEMENT' | 'RESEARCH'

// Domain-specific pipeline steps
export const DOMAIN_STATUSES: Record<TaskDomain, string[]> = {
  DEVELOPMENT: ['TODO', 'IN_PROGRESS', 'DEVELOPED', 'CODE_REVIEW', 'TESTING', 'DEBUGGING', 'FINAL_TESTING', 'DONE'],
  DESIGNING: ['TODO', 'IN_PROGRESS', 'WIREFRAME', 'DESIGN', 'REVIEW', 'REVISION', 'APPROVED', 'DONE'],
  MANAGEMENT: ['TODO', 'PLANNING', 'IN_PROGRESS', 'EXECUTION', 'REVIEW', 'DONE'],
  RESEARCH: ['TODO', 'IN_PROGRESS', 'RESEARCH', 'ANALYSIS', 'DOCUMENTATION', 'REVIEW', 'DONE'],
}

export const DOMAIN_LABELS: Record<TaskDomain, string> = {
  DEVELOPMENT: 'Development',
  DESIGNING: 'Designing',
  MANAGEMENT: 'Management',
  RESEARCH: 'Research',
}

export const DOMAIN_OPTIONS: { value: TaskDomain; label: string }[] = [
  { value: 'DEVELOPMENT', label: 'Development' },
  { value: 'DESIGNING', label: 'Designing' },
  { value: 'MANAGEMENT', label: 'Management' },
  { value: 'RESEARCH', label: 'Research' },
]

// All status labels across all domains
export const TASK_STATUS_LABEL: Record<string, string> = {
  TODO: 'To Do', IN_PROGRESS: 'In Progress',
  DEVELOPED: 'Developed', CODE_REVIEW: 'Code Review',
  TESTING: 'Testing', DEBUGGING: 'Debugging', FINAL_TESTING: 'Final Testing',
  WIREFRAME: 'Wireframe', DESIGN: 'Design', REVIEW: 'Review',
  REVISION: 'Revision', APPROVED: 'Approved',
  PLANNING: 'Planning', EXECUTION: 'Execution',
  RESEARCH: 'Research', ANALYSIS: 'Analysis', DOCUMENTATION: 'Documentation',
  TESTED: 'Tested',
  DONE: 'Done',
}

// Status colors for badges
export const TASK_STATUS_COLORS: Record<string, string> = {
  TODO: 'bg-amber-50 text-amber-700 ring-1 ring-inset ring-amber-200 dark:bg-amber-500/15 dark:text-amber-200 dark:ring-amber-500/25',
  IN_PROGRESS: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-500/25',
  DEVELOPED: 'bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/25',
  CODE_REVIEW: 'bg-purple-50 text-purple-700 ring-1 ring-inset ring-purple-200 dark:bg-purple-500/15 dark:text-purple-300 dark:ring-purple-500/25',
  TESTING: 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200 dark:bg-orange-500/15 dark:text-orange-200 dark:ring-orange-500/25',
  TESTED: 'bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-200 dark:bg-teal-500/15 dark:text-teal-300 dark:ring-teal-500/25',
  DEBUGGING: 'bg-red-50 text-red-700 ring-1 ring-inset ring-red-200 dark:bg-red-500/15 dark:text-red-300 dark:ring-red-500/25',
  FINAL_TESTING: 'bg-pink-50 text-pink-700 ring-1 ring-inset ring-pink-200 dark:bg-pink-500/15 dark:text-pink-300 dark:ring-pink-500/25',
  WIREFRAME: 'bg-slate-50 text-slate-700 ring-1 ring-inset ring-slate-200 dark:bg-slate-500/15 dark:text-slate-300 dark:ring-slate-500/25',
  DESIGN: 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-500/25',
  REVIEW: 'bg-cyan-50 text-cyan-700 ring-1 ring-inset ring-cyan-200 dark:bg-cyan-500/15 dark:text-cyan-300 dark:ring-cyan-500/25',
  REVISION: 'bg-rose-50 text-rose-700 ring-1 ring-inset ring-rose-200 dark:bg-rose-500/15 dark:text-rose-300 dark:ring-rose-500/25',
  APPROVED: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/25',
  PLANNING: 'bg-indigo-50 text-indigo-700 ring-1 ring-inset ring-indigo-200 dark:bg-indigo-500/15 dark:text-indigo-300 dark:ring-indigo-500/25',
  EXECUTION: 'bg-blue-50 text-blue-700 ring-1 ring-inset ring-blue-200 dark:bg-blue-500/15 dark:text-blue-300 dark:ring-blue-500/25',
  RESEARCH: 'bg-violet-50 text-violet-700 ring-1 ring-inset ring-violet-200 dark:bg-violet-500/15 dark:text-violet-300 dark:ring-violet-500/25',
  ANALYSIS: 'bg-teal-50 text-teal-700 ring-1 ring-inset ring-teal-200 dark:bg-teal-500/15 dark:text-teal-300 dark:ring-teal-500/25',
  DOCUMENTATION: 'bg-orange-50 text-orange-700 ring-1 ring-inset ring-orange-200 dark:bg-orange-500/15 dark:text-orange-200 dark:ring-orange-500/25',
  DONE: 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-500/25',
}

// Progress per domain (auto-calculated)
export function getStatusProgress(status: string, domain: TaskDomain = 'DEVELOPMENT'): number {
  const statuses = DOMAIN_STATUSES[domain]
  const idx = statuses.indexOf(status)
  if (idx === -1) return 0
  return Math.round((idx / (statuses.length - 1)) * 100)
}

// Get status options for a domain
export function getStatusOptions(domain: TaskDomain = 'DEVELOPMENT'): { value: string; label: string }[] {
  return DOMAIN_STATUSES[domain].map(s => ({ value: s, label: TASK_STATUS_LABEL[s] || s }))
}

// Legacy compatibility
export type TaskStatus = string
export const TASK_STATUS_OPTIONS = getStatusOptions('DEVELOPMENT')
export const TASK_STATUS_PROGRESS: Record<string, number> = {}
for (const [domain, statuses] of Object.entries(DOMAIN_STATUSES)) {
  for (const s of statuses) {
    TASK_STATUS_PROGRESS[s] = getStatusProgress(s, domain as TaskDomain)
  }
}

export interface Task {
  taskId: string
  projectId: string
  title: string
  description?: string
  status: string
  priority: TaskPriority
  domain: TaskDomain
  assignedTo: string[]
  assignedBy?: string
  createdBy: string
  deadline: string
  estimatedHours?: number
  createdAt: string
  updatedAt: string
}
