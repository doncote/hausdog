import { getServerEnv } from './env'

export type IssueStatus = 'draft' | 'backlog' | 'ready' | 'in_progress' | 'review' | 'closed'
export type IssuePriority = 0 | 1 | 2 | 3 | 4
export type IssueType = 'task' | 'bug' | 'feature' | 'epic' | 'chore'

export interface LatticeIssue {
  id: string
  title: string
  description?: string
  status: IssueStatus
  priority: IssuePriority
  issue_type: IssueType
  assignee?: string
  labels?: string[]
  team?: string
  is_blocked?: boolean
  created_at: string
  updated_at: string
}

export interface ListIssuesParams {
  assignee?: string
  status?: IssueStatus | IssueStatus[]
  labels_any?: string[]
  priority?: IssuePriority
  team?: string
  limit?: number
  title_contains?: string
}

export interface ListIssuesResult {
  count: number
  issues: LatticeIssue[]
}

function getLatticeConfig(): { url: string; key: string } | null {
  const env = getServerEnv()
  if (!env.LATTICE_API_URL || !env.LATTICE_API_KEY) return null
  return { url: env.LATTICE_API_URL, key: env.LATTICE_API_KEY }
}

export async function listLatticeIssues(params: ListIssuesParams): Promise<ListIssuesResult> {
  const config = getLatticeConfig()
  if (!config) {
    return { count: 0, issues: [] }
  }

  const query = new URLSearchParams()
  if (params.assignee) query.set('assignee', params.assignee)
  if (params.priority !== undefined) query.set('priority', String(params.priority))
  if (params.team) query.set('team', params.team)
  if (params.limit) query.set('limit', String(params.limit))
  if (params.title_contains) query.set('title_contains', params.title_contains)

  const statusArr = params.status
    ? Array.isArray(params.status)
      ? params.status
      : [params.status]
    : []
  for (const s of statusArr) {
    query.append('status', s)
  }
  for (const l of params.labels_any ?? []) {
    query.append('labels_any', l)
  }

  const res = await fetch(`${config.url}/v1/issues?${query}`, {
    headers: { Authorization: `Bearer ${config.key}` },
  })

  if (!res.ok) {
    throw new Error(`Lattice API error: ${res.status} ${res.statusText}`)
  }

  return res.json() as Promise<ListIssuesResult>
}

export async function getLatticeIssue(id: string): Promise<LatticeIssue | null> {
  const config = getLatticeConfig()
  if (!config) return null

  const res = await fetch(`${config.url}/v1/issues/${id}`, {
    headers: { Authorization: `Bearer ${config.key}` },
  })

  if (res.status === 404) return null
  if (!res.ok) throw new Error(`Lattice API error: ${res.status} ${res.statusText}`)

  return res.json() as Promise<LatticeIssue>
}

export async function getLatticeEpicChildren(epicId: string): Promise<LatticeIssue[]> {
  const config = getLatticeConfig()
  if (!config) return []

  const res = await fetch(`${config.url}/v1/issues/${epicId}/children`, {
    headers: { Authorization: `Bearer ${config.key}` },
  })

  if (!res.ok) return []

  const data = (await res.json()) as { issues?: LatticeIssue[] } | LatticeIssue[]
  return Array.isArray(data) ? data : (data.issues ?? [])
}
