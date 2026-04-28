import { OpenAPIHono } from '@hono/zod-openapi'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({ prisma: {} }))
vi.mock('@/lib/console-logger', () => ({
  consoleLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const mockEnv = vi.hoisted(() => ({
  getServerEnv: vi.fn(),
}))

vi.mock('@/lib/env', () => ({
  getServerEnv: mockEnv.getServerEnv,
}))

const mockLatticeClient = vi.hoisted(() => ({
  listIssues: vi.fn(),
}))

vi.mock('../services/lattice-client', () => ({
  createLatticeClient: vi.fn(() => mockLatticeClient),
}))

import type { AuthContext } from '../middleware/auth'
import { workRouter } from './work'

const USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const COMPANY_ID = USER_ID

function makeApp(userId = USER_ID) {
  const app = new OpenAPIHono<{ Variables: AuthContext }>()
  app.use('*', async (c, next) => {
    c.set('userId', userId)
    c.set('apiKeyId', '550e8400-e29b-41d4-a716-446655440099')
    c.set('apiKeyName', 'test')
    await next()
  })
  app.route('/', workRouter)
  return app
}

function makeIssue(overrides: Record<string, unknown> = {}) {
  return {
    id: 'issue-1',
    title: 'Fix the bug',
    status: 'in_progress',
    priority: 1,
    issue_type: 'bug',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

describe('GET /companies/:companyId/work/issues', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 403 when userId does not match companyId', async () => {
    const res = await makeApp('different-user-id').request(`/companies/${COMPANY_ID}/work/issues`)

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.error).toBe('forbidden')
  })

  it('returns 503 when Lattice is not configured', async () => {
    mockEnv.getServerEnv.mockReturnValue({ LATTICE_API_URL: null, LATTICE_API_KEY: null })

    const res = await makeApp().request(`/companies/${COMPANY_ID}/work/issues`)

    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.error).toBe('not_configured')
  })

  it('returns 503 when only LATTICE_API_URL is set', async () => {
    mockEnv.getServerEnv.mockReturnValue({
      LATTICE_API_URL: 'https://lattice.example.com',
      LATTICE_API_KEY: null,
    })

    const res = await makeApp().request(`/companies/${COMPANY_ID}/work/issues`)

    expect(res.status).toBe(503)
  })

  it('returns issues list when configured and authorized', async () => {
    mockEnv.getServerEnv.mockReturnValue({
      LATTICE_API_URL: 'https://lattice.example.com',
      LATTICE_API_KEY: 'test-key',
    })
    mockLatticeClient.listIssues.mockResolvedValue([makeIssue()])

    const res = await makeApp().request(`/companies/${COMPANY_ID}/work/issues`)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.issues).toHaveLength(1)
    expect(body.issues[0].id).toBe('issue-1')
  })

  it('tags listIssues with org label for company', async () => {
    mockEnv.getServerEnv.mockReturnValue({
      LATTICE_API_URL: 'https://lattice.example.com',
      LATTICE_API_KEY: 'test-key',
    })
    mockLatticeClient.listIssues.mockResolvedValue([])

    await makeApp().request(`/companies/${COMPANY_ID}/work/issues`)

    expect(mockLatticeClient.listIssues).toHaveBeenCalledWith(
      expect.objectContaining({ labels_any: [`org:${COMPANY_ID}`] }),
    )
  })

  it('splits comma-separated status values', async () => {
    mockEnv.getServerEnv.mockReturnValue({
      LATTICE_API_URL: 'https://lattice.example.com',
      LATTICE_API_KEY: 'test-key',
    })
    mockLatticeClient.listIssues.mockResolvedValue([])

    await makeApp().request(`/companies/${COMPANY_ID}/work/issues?status=in_progress,review`)

    expect(mockLatticeClient.listIssues).toHaveBeenCalledWith(
      expect.objectContaining({ status: ['in_progress', 'review'] }),
    )
  })

  it('passes assignee and priority filters to client', async () => {
    mockEnv.getServerEnv.mockReturnValue({
      LATTICE_API_URL: 'https://lattice.example.com',
      LATTICE_API_KEY: 'test-key',
    })
    mockLatticeClient.listIssues.mockResolvedValue([])

    await makeApp().request(`/companies/${COMPANY_ID}/work/issues?assignee=user-1&priority=2`)

    expect(mockLatticeClient.listIssues).toHaveBeenCalledWith(
      expect.objectContaining({ assignee: 'user-1', priority: 2 }),
    )
  })

  it('defaults limit to 50 when not provided', async () => {
    mockEnv.getServerEnv.mockReturnValue({
      LATTICE_API_URL: 'https://lattice.example.com',
      LATTICE_API_KEY: 'test-key',
    })
    mockLatticeClient.listIssues.mockResolvedValue([])

    await makeApp().request(`/companies/${COMPANY_ID}/work/issues`)

    expect(mockLatticeClient.listIssues).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 50 }),
    )
  })

  it('passes cursor to client when provided', async () => {
    mockEnv.getServerEnv.mockReturnValue({
      LATTICE_API_URL: 'https://lattice.example.com',
      LATTICE_API_KEY: 'test-key',
    })
    mockLatticeClient.listIssues.mockResolvedValue([])

    await makeApp().request(`/companies/${COMPANY_ID}/work/issues?cursor=abc123`)

    expect(mockLatticeClient.listIssues).toHaveBeenCalledWith(
      expect.objectContaining({ cursor: 'abc123' }),
    )
  })
})
