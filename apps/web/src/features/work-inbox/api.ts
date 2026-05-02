import { createServerFn } from '@tanstack/react-start'
import type { IssuePriority, IssueStatus } from '@/lib/lattice-client'
import { getLatticeEpicChildren, listLatticeIssues } from '@/lib/lattice-client'

export interface FetchWorkIssuesInput {
  assignee?: string
  status?: IssueStatus[]
  priority?: IssuePriority
  team?: string
  limit?: number
}

export const fetchWorkIssues = createServerFn({ method: 'GET' })
  .inputValidator((d: FetchWorkIssuesInput) => d)
  .handler(async ({ data }) => {
    return listLatticeIssues({
      assignee: data.assignee,
      status: data.status,
      priority: data.priority,
      team: data.team,
      limit: data.limit ?? 50,
    })
  })

export const fetchEpicChildren = createServerFn({ method: 'GET' })
  .inputValidator((d: { epicId: string }) => d)
  .handler(async ({ data }) => {
    return getLatticeEpicChildren(data.epicId)
  })
