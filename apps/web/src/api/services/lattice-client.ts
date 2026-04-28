export interface LatticeIssueFilters {
  status?: string[]
  assignee?: string
  priority?: number
  labels_any?: string[]
  limit?: number
  cursor?: string
}

export interface LatticeIssue {
  id: string
  title: string
  description?: string
  status: string
  priority: number
  issue_type: string
  assignee?: string
  labels?: string[]
  team?: string
  created_at: string
  updated_at: string
}

export function createLatticeClient(baseUrl: string, apiKey: string) {
  const headers = { Authorization: `Bearer ${apiKey}` }

  async function listIssues(filters: LatticeIssueFilters): Promise<LatticeIssue[]> {
    const query = new URLSearchParams()
    if (filters.assignee) query.set('assignee', filters.assignee)
    if (filters.priority !== undefined) query.set('priority', String(filters.priority))
    if (filters.limit) query.set('limit', String(filters.limit))
    if (filters.cursor) query.set('cursor', filters.cursor)
    for (const s of filters.status ?? []) query.append('status', s)
    for (const l of filters.labels_any ?? []) query.append('labels_any', l)

    const res = await fetch(`${baseUrl}/v1/issues?${query}`, { headers })
    if (!res.ok) throw new Error(`Lattice API error: ${res.status} ${res.statusText}`)

    const data = (await res.json()) as { issues?: LatticeIssue[] } | LatticeIssue[]
    return Array.isArray(data) ? data : (data.issues ?? [])
  }

  async function getIssue(id: string): Promise<LatticeIssue> {
    const res = await fetch(`${baseUrl}/v1/issues/${id}`, { headers })
    if (!res.ok) throw new Error(`Lattice API error: ${res.status} ${res.statusText}`)
    return res.json() as Promise<LatticeIssue>
  }

  return { listIssues, getIssue }
}
