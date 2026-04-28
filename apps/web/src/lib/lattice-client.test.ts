import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { getLatticeEpicChildren, getLatticeIssue, listLatticeIssues } from './lattice-client'

vi.mock('./env', () => ({
  getServerEnv: vi.fn(),
}))

import { getServerEnv } from './env'

const BASE_URL = 'https://lattice.example.com'
const API_KEY = 'test-key-abc'

function mockEnv(configured = true) {
  vi.mocked(getServerEnv).mockReturnValue({
    LATTICE_API_URL: configured ? BASE_URL : undefined,
    LATTICE_API_KEY: configured ? API_KEY : undefined,
  } as ReturnType<typeof getServerEnv>)
}

function mockFetch(body: unknown, status = 200) {
  vi.stubGlobal(
    'fetch',
    vi.fn().mockResolvedValue({
      ok: status >= 200 && status < 300,
      status,
      statusText: status === 200 ? 'OK' : 'Server Error',
      json: () => Promise.resolve(body),
    }),
  )
}

const makeIssue = (overrides: Record<string, unknown> = {}) => ({
  id: 'issue-1',
  title: 'Test issue',
  status: 'ready',
  priority: 2,
  issue_type: 'task',
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  ...overrides,
})

describe('listLatticeIssues', () => {
  beforeEach(() => mockEnv())
  afterEach(() => vi.unstubAllGlobals())

  it('returns empty result when not configured', async () => {
    mockEnv(false)
    const result = await listLatticeIssues({})
    expect(result).toEqual({ count: 0, issues: [] })
  })

  it('does not call fetch when not configured', async () => {
    mockEnv(false)
    const spy = vi.fn()
    vi.stubGlobal('fetch', spy)
    await listLatticeIssues({})
    expect(spy).not.toHaveBeenCalled()
  })

  it('calls correct base URL with auth header', async () => {
    mockFetch({ count: 0, issues: [] })
    await listLatticeIssues({})
    const [url, opts] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
    expect(url).toContain(`${BASE_URL}/v1/issues`)
    expect(opts.headers).toEqual({ Authorization: `Bearer ${API_KEY}` })
  })

  it('serializes assignee query param', async () => {
    mockFetch({ count: 0, issues: [] })
    await listLatticeIssues({ assignee: 'user-42' })
    const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
    expect(url).toContain('assignee=user-42')
  })

  it('serializes priority=0 query param', async () => {
    mockFetch({ count: 0, issues: [] })
    await listLatticeIssues({ priority: 0 })
    const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
    expect(url).toContain('priority=0')
  })

  it('serializes limit query param', async () => {
    mockFetch({ count: 0, issues: [] })
    await listLatticeIssues({ limit: 25 })
    const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
    expect(url).toContain('limit=25')
  })

  it('serializes title_contains query param', async () => {
    mockFetch({ count: 0, issues: [] })
    await listLatticeIssues({ title_contains: 'pagination' })
    const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
    expect(url).toContain('title_contains=pagination')
  })

  it('appends status as repeated params for array input', async () => {
    mockFetch({ count: 0, issues: [] })
    await listLatticeIssues({ status: ['ready', 'in_progress'] })
    const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
    expect(url).toContain('status=ready')
    expect(url).toContain('status=in_progress')
  })

  it('accepts single status string', async () => {
    mockFetch({ count: 0, issues: [] })
    await listLatticeIssues({ status: 'backlog' })
    const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
    expect(url).toContain('status=backlog')
  })

  it('returns parsed result from API', async () => {
    const payload = { count: 2, issues: [makeIssue(), makeIssue({ id: 'issue-2' })] }
    mockFetch(payload)
    const result = await listLatticeIssues({})
    expect(result.count).toBe(2)
    expect(result.issues).toHaveLength(2)
  })

  it('throws on non-OK response', async () => {
    mockFetch({}, 500)
    await expect(listLatticeIssues({})).rejects.toThrow('Lattice API error: 500')
  })
})

describe('getLatticeIssue', () => {
  beforeEach(() => mockEnv())
  afterEach(() => vi.unstubAllGlobals())

  it('returns null when not configured', async () => {
    mockEnv(false)
    const result = await getLatticeIssue('issue-1')
    expect(result).toBeNull()
  })

  it('calls correct URL', async () => {
    mockFetch(makeIssue())
    await getLatticeIssue('abc123')
    const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`${BASE_URL}/v1/issues/abc123`)
  })

  it('returns issue on success', async () => {
    const issue = makeIssue({ id: 'xyz', title: 'My task' })
    mockFetch(issue)
    const result = await getLatticeIssue('xyz')
    expect(result?.id).toBe('xyz')
    expect(result?.title).toBe('My task')
  })

  it('returns null on 404', async () => {
    mockFetch({}, 404)
    const result = await getLatticeIssue('missing')
    expect(result).toBeNull()
  })

  it('throws on other error responses', async () => {
    mockFetch({}, 500)
    await expect(getLatticeIssue('issue-1')).rejects.toThrow('Lattice API error: 500')
  })
})

describe('getLatticeEpicChildren', () => {
  beforeEach(() => mockEnv())
  afterEach(() => vi.unstubAllGlobals())

  it('returns empty array when not configured', async () => {
    mockEnv(false)
    const result = await getLatticeEpicChildren('epic-1')
    expect(result).toEqual([])
  })

  it('calls correct URL', async () => {
    mockFetch([])
    await getLatticeEpicChildren('epic-99')
    const [url] = vi.mocked(fetch).mock.calls[0] as [string, RequestInit]
    expect(url).toBe(`${BASE_URL}/v1/issues/epic-99/children`)
  })

  it('handles array response shape', async () => {
    const children = [makeIssue({ id: 'child-1' }), makeIssue({ id: 'child-2' })]
    mockFetch(children)
    const result = await getLatticeEpicChildren('epic-1')
    expect(result).toHaveLength(2)
    expect(result[0]?.id).toBe('child-1')
  })

  it('handles wrapped { issues: [] } response shape', async () => {
    const children = [makeIssue({ id: 'child-1' })]
    mockFetch({ issues: children })
    const result = await getLatticeEpicChildren('epic-1')
    expect(result).toHaveLength(1)
    expect(result[0]?.id).toBe('child-1')
  })

  it('returns empty array on non-OK response', async () => {
    mockFetch({}, 503)
    const result = await getLatticeEpicChildren('epic-1')
    expect(result).toEqual([])
  })
})
