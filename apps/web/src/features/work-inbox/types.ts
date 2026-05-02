export type { IssuePriority, IssueStatus, IssueType, LatticeIssue } from '@/lib/lattice-client'

export interface WorkFilters {
  assignee?: string
  status?: string[]
  priority?: number
  team?: string
  limit?: number
}

export const STATUS_OPTIONS = [
  { value: 'in_progress', label: 'In Progress' },
  { value: 'review', label: 'Review' },
  { value: 'ready', label: 'Ready' },
  { value: 'backlog', label: 'Backlog' },
  { value: 'draft', label: 'Draft' },
] as const

export const PRIORITY_LABELS: Record<number, string> = {
  0: 'P0',
  1: 'P1',
  2: 'P2',
  3: 'P3',
  4: 'P4',
}

export const PRIORITY_COLORS: Record<number, string> = {
  0: 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400',
  1: 'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400',
  2: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/20 dark:text-yellow-400',
  3: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
  4: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
}

export const STATUS_COLORS: Record<string, string> = {
  in_progress: 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400',
  review: 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400',
  ready: 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400',
  backlog: 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400',
  draft: 'bg-gray-100 text-gray-500 dark:bg-gray-800 dark:text-gray-500',
  closed: 'bg-gray-100 text-gray-400 dark:bg-gray-800 dark:text-gray-600',
}
