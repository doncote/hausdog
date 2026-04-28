import { OpenAPIHono } from '@hono/zod-openapi'
import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock deps before importing the router
vi.mock('@/lib/db', () => ({ prisma: {} }))
vi.mock('@/lib/console-logger', () => ({
  consoleLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const mockService = vi.hoisted(() => ({
  findAllForUser: vi.fn(),
  isSlugTaken: vi.fn(),
  create: vi.fn(),
  findById: vi.fn(),
  update: vi.fn(),
  isCategoryInUse: vi.fn(),
  delete: vi.fn(),
}))

vi.mock('@/features/categories/service', () => ({
  CategoryService: vi.fn().mockImplementation(() => mockService),
}))

import type { AuthContext } from '../middleware/auth'
import { categoriesRouter } from './categories'

const USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const CAT_ID = '550e8400-e29b-41d4-a716-446655440000'

function makeApp() {
  const app = new OpenAPIHono<{ Variables: AuthContext }>()
  app.use('*', async (c, next) => {
    c.set('userId', USER_ID)
    c.set('apiKeyId', 'key-1')
    c.set('apiKeyName', 'test')
    await next()
  })
  app.route('/', categoriesRouter)
  return app
}

function makeCategory(overrides: Record<string, unknown> = {}) {
  return {
    id: CAT_ID,
    slug: 'appliances',
    name: 'Appliances',
    icon: '🏠',
    isSystem: false,
    userId: USER_ID,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  }
}

describe('GET /categories', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns list of categories', async () => {
    const cats = [makeCategory(), makeCategory({ id: '550e8400-e29b-41d4-a716-446655440001', slug: 'tools', name: 'Tools' })]
    mockService.findAllForUser.mockResolvedValue(cats)

    const res = await makeApp().request('/categories')
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveLength(2)
    expect(body[0].slug).toBe('appliances')
  })

  it('calls service with userId from context', async () => {
    mockService.findAllForUser.mockResolvedValue([])

    await makeApp().request('/categories')

    expect(mockService.findAllForUser).toHaveBeenCalledWith(USER_ID)
  })

  it('serializes dates as ISO strings', async () => {
    mockService.findAllForUser.mockResolvedValue([makeCategory()])

    const res = await makeApp().request('/categories')
    const body = await res.json()

    expect(body[0].createdAt).toBe('2026-01-01T00:00:00.000Z')
  })
})

describe('POST /categories', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates category and returns 201', async () => {
    mockService.isSlugTaken.mockResolvedValue(false)
    mockService.create.mockResolvedValue(makeCategory())

    const res = await makeApp().request('/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'appliances', name: 'Appliances' }),
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.slug).toBe('appliances')
  })

  it('returns 409 when slug is already taken', async () => {
    mockService.isSlugTaken.mockResolvedValue(true)

    const res = await makeApp().request('/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'appliances', name: 'Appliances' }),
    })

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toBe('conflict')
  })

  it('does not call create when slug is taken', async () => {
    mockService.isSlugTaken.mockResolvedValue(true)

    await makeApp().request('/categories', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ slug: 'appliances', name: 'Appliances' }),
    })

    expect(mockService.create).not.toHaveBeenCalled()
  })
})

describe('PATCH /categories/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates category and returns 200', async () => {
    const existing = makeCategory()
    const updated = makeCategory({ name: 'New Name' })
    mockService.findById.mockResolvedValue(existing)
    mockService.update.mockResolvedValue(updated)

    const res = await makeApp().request('/categories/550e8400-e29b-41d4-a716-446655440000', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Name' }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.name).toBe('New Name')
  })

  it('returns 404 when category not found', async () => {
    mockService.findById.mockResolvedValue(null)

    const res = await makeApp().request('/categories/12345678-1234-4234-8234-123456789012', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Name' }),
    })

    expect(res.status).toBe(404)
  })

  it('returns 403 when trying to modify a system category', async () => {
    mockService.findById.mockResolvedValue(makeCategory({ isSystem: true }))

    const res = await makeApp().request('/categories/550e8400-e29b-41d4-a716-446655440000', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Name' }),
    })

    expect(res.status).toBe(403)
  })

  it('returns 403 when category belongs to another user', async () => {
    mockService.findById.mockResolvedValue(makeCategory({ userId: 'other-user' }))

    const res = await makeApp().request('/categories/550e8400-e29b-41d4-a716-446655440000', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Name' }),
    })

    expect(res.status).toBe(403)
  })
})

describe('DELETE /categories/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes category and returns 204', async () => {
    mockService.findById.mockResolvedValue(makeCategory())
    mockService.isCategoryInUse.mockResolvedValue(false)
    mockService.delete.mockResolvedValue(undefined)

    const res = await makeApp().request('/categories/550e8400-e29b-41d4-a716-446655440000', { method: 'DELETE' })

    expect(res.status).toBe(204)
    expect(mockService.delete).toHaveBeenCalledWith(CAT_ID)
  })

  it('returns 404 when category not found', async () => {
    mockService.findById.mockResolvedValue(null)

    const res = await makeApp().request('/categories/550e8400-e29b-41d4-a716-446655440000', { method: 'DELETE' })

    expect(res.status).toBe(404)
  })

  it('returns 403 for system categories', async () => {
    mockService.findById.mockResolvedValue(makeCategory({ isSystem: true }))

    const res = await makeApp().request('/categories/550e8400-e29b-41d4-a716-446655440000', { method: 'DELETE' })

    expect(res.status).toBe(403)
  })

  it('returns 403 when category belongs to another user', async () => {
    mockService.findById.mockResolvedValue(makeCategory({ userId: 'other-user' }))

    const res = await makeApp().request('/categories/550e8400-e29b-41d4-a716-446655440000', { method: 'DELETE' })

    expect(res.status).toBe(403)
  })

  it('returns 409 when category is in use by items', async () => {
    mockService.findById.mockResolvedValue(makeCategory())
    mockService.isCategoryInUse.mockResolvedValue(true)

    const res = await makeApp().request('/categories/550e8400-e29b-41d4-a716-446655440000', { method: 'DELETE' })

    expect(res.status).toBe(409)
    const body = await res.json()
    expect(body.error).toBe('conflict')
  })

  it('does not delete when category is in use', async () => {
    mockService.findById.mockResolvedValue(makeCategory())
    mockService.isCategoryInUse.mockResolvedValue(true)

    await makeApp().request('/categories/550e8400-e29b-41d4-a716-446655440000', { method: 'DELETE' })

    expect(mockService.delete).not.toHaveBeenCalled()
  })
})
