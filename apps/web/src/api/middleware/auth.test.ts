import { Hono } from 'hono'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({ prisma: {} }))
vi.mock('@/lib/console-logger', () => ({
  consoleLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const mockValidate = vi.hoisted(() => vi.fn())

vi.mock('@/features/api-keys/service', () => ({
  ApiKeyService: vi.fn().mockImplementation(() => ({
    validate: mockValidate,
  })),
}))

import { apiKeyAuth } from './auth'
import type { AuthContext } from './auth'

function makeApp() {
  const app = new Hono<{ Variables: AuthContext }>()
  app.use('*', apiKeyAuth)
  app.get('/test', (c) =>
    c.json({
      userId: c.get('userId'),
      apiKeyId: c.get('apiKeyId'),
      apiKeyName: c.get('apiKeyName'),
    }),
  )
  return app
}

const VALID_KEY = {
  id: '550e8400-e29b-41d4-a716-446655440001',
  userId: 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11',
  name: 'my-key',
}

describe('apiKeyAuth middleware', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 401 when Authorization header is missing', async () => {
    const res = await makeApp().request('/test')
    expect(res.status).toBe(401)
  })

  it('returns 401 when scheme is not Bearer', async () => {
    const res = await makeApp().request('/test', {
      headers: { Authorization: 'Basic abc123' },
    })
    expect(res.status).toBe(401)
  })

  it('returns 401 when Authorization header has no key after Bearer', async () => {
    const res = await makeApp().request('/test', {
      headers: { Authorization: 'Bearer' },
    })
    expect(res.status).toBe(401)
  })

  it('returns 401 when API key is invalid', async () => {
    mockValidate.mockResolvedValue(null)

    const res = await makeApp().request('/test', {
      headers: { Authorization: 'Bearer hd_invalid' },
    })
    expect(res.status).toBe(401)
  })

  it('calls validate with the key from the Authorization header', async () => {
    mockValidate.mockResolvedValue(VALID_KEY)

    await makeApp().request('/test', {
      headers: { Authorization: 'Bearer hd_mykey' },
    })

    expect(mockValidate).toHaveBeenCalledWith('hd_mykey')
  })

  it('returns 200 and sets context variables on valid key', async () => {
    mockValidate.mockResolvedValue(VALID_KEY)

    const res = await makeApp().request('/test', {
      headers: { Authorization: 'Bearer hd_validkey' },
    })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.userId).toBe(VALID_KEY.userId)
    expect(body.apiKeyId).toBe(VALID_KEY.id)
    expect(body.apiKeyName).toBe(VALID_KEY.name)
  })

  it('is case-insensitive for the Bearer scheme', async () => {
    mockValidate.mockResolvedValue(VALID_KEY)

    const res = await makeApp().request('/test', {
      headers: { Authorization: 'BEARER hd_validkey' },
    })
    expect(res.status).toBe(200)
  })
})
