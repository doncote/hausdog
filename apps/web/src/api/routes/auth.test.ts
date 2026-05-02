import { OpenAPIHono } from '@hono/zod-openapi'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({ prisma: {} }))
vi.mock('@/lib/console-logger', () => ({
  consoleLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const mockService = vi.hoisted(() => ({
  findAllForUser: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('@/features/api-keys/service', () => ({
  ApiKeyService: vi.fn().mockImplementation(() => mockService),
}))

import type { AuthContext } from '../middleware/auth'
import { authRouter } from './auth'

const USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const API_KEY_ID = '550e8400-e29b-41d4-a716-446655440000'
const KEY_ID_2 = '550e8400-e29b-41d4-a716-446655440001'

function makeApp() {
  const app = new OpenAPIHono<{ Variables: AuthContext }>()
  app.use('*', async (c, next) => {
    c.set('userId', USER_ID)
    c.set('apiKeyId', API_KEY_ID)
    c.set('apiKeyName', 'default')
    await next()
  })
  app.route('/', authRouter)
  return app
}

function makeApiKey(overrides: Record<string, unknown> = {}) {
  return {
    id: API_KEY_ID,
    name: 'default',
    userId: USER_ID,
    lastUsedAt: new Date('2026-01-15'),
    createdAt: new Date('2026-01-01'),
    ...overrides,
  }
}

describe('GET /auth/me', () => {
  it('returns userId and apiKey info from context', async () => {
    const res = await makeApp().request('/auth/me')
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.userId).toBe(USER_ID)
    expect(body.apiKey.id).toBe(API_KEY_ID)
    expect(body.apiKey.name).toBe('default')
  })

  it('does not call the service', async () => {
    await makeApp().request('/auth/me')

    expect(mockService.findAllForUser).not.toHaveBeenCalled()
    expect(mockService.findById).not.toHaveBeenCalled()
  })
})

describe('GET /auth/keys', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns list of API keys', async () => {
    mockService.findAllForUser.mockResolvedValue([
      makeApiKey(),
      makeApiKey({ id: KEY_ID_2, name: 'ci' }),
    ])

    const res = await makeApp().request('/auth/keys')
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveLength(2)
    expect(body[0].name).toBe('default')
    expect(body[1].name).toBe('ci')
  })

  it('calls service with userId from context', async () => {
    mockService.findAllForUser.mockResolvedValue([])

    await makeApp().request('/auth/keys')

    expect(mockService.findAllForUser).toHaveBeenCalledWith(USER_ID)
  })

  it('serializes dates as ISO strings', async () => {
    mockService.findAllForUser.mockResolvedValue([makeApiKey()])

    const res = await makeApp().request('/auth/keys')
    const body = await res.json()

    expect(body[0].createdAt).toBe('2026-01-01T00:00:00.000Z')
    expect(body[0].lastUsedAt).toBe('2026-01-15T00:00:00.000Z')
  })

  it('serializes null lastUsedAt', async () => {
    mockService.findAllForUser.mockResolvedValue([makeApiKey({ lastUsedAt: null })])

    const res = await makeApp().request('/auth/keys')
    const body = await res.json()

    expect(body[0].lastUsedAt).toBeNull()
  })
})

describe('POST /auth/keys', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates key and returns 201 with secret', async () => {
    mockService.create.mockResolvedValue({
      ...makeApiKey(),
      secret: 'sk_live_abc123',
    })

    const res = await makeApp().request('/auth/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'My Key' }),
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.secret).toBe('sk_live_abc123')
    expect(body.name).toBe('default')
  })

  it('calls service with userId and name', async () => {
    mockService.create.mockResolvedValue({ ...makeApiKey(), secret: 'sk_x' })

    await makeApp().request('/auth/keys', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Deploy Key' }),
    })

    expect(mockService.create).toHaveBeenCalledWith(USER_ID, { name: 'Deploy Key' })
  })
})

describe('DELETE /auth/keys/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes key and returns 204', async () => {
    mockService.findById.mockResolvedValue(makeApiKey())
    mockService.delete.mockResolvedValue(undefined)

    const res = await makeApp().request(`/auth/keys/${API_KEY_ID}`, { method: 'DELETE' })

    expect(res.status).toBe(204)
    expect(mockService.delete).toHaveBeenCalledWith(API_KEY_ID, USER_ID)
  })

  it('returns 404 when key not found', async () => {
    mockService.findById.mockResolvedValue(null)

    const res = await makeApp().request(`/auth/keys/${API_KEY_ID}`, { method: 'DELETE' })

    expect(res.status).toBe(404)
  })

  it('returns 404 when key belongs to another user', async () => {
    mockService.findById.mockResolvedValue(makeApiKey({ userId: 'other-user' }))

    const res = await makeApp().request(`/auth/keys/${API_KEY_ID}`, { method: 'DELETE' })

    expect(res.status).toBe(404)
  })

  it('does not delete when key belongs to another user', async () => {
    mockService.findById.mockResolvedValue(makeApiKey({ userId: 'other-user' }))

    await makeApp().request(`/auth/keys/${API_KEY_ID}`, { method: 'DELETE' })

    expect(mockService.delete).not.toHaveBeenCalled()
  })
})
