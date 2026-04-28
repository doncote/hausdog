import { OpenAPIHono } from '@hono/zod-openapi'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({ prisma: {} }))
vi.mock('@/lib/console-logger', () => ({
  consoleLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const mockSpaceService = vi.hoisted(() => ({
  findPaginatedForProperty: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}))

const mockPropertyService = vi.hoisted(() => ({
  findById: vi.fn(),
}))

vi.mock('@/features/spaces/service', () => ({
  SpaceService: vi.fn().mockImplementation(() => mockSpaceService),
}))

vi.mock('@/features/properties/service', () => ({
  PropertyService: vi.fn().mockImplementation(() => mockPropertyService),
}))

import type { AuthContext } from '../middleware/auth'
import { spacesRouter } from './spaces'

const USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const PROP_ID = '550e8400-e29b-41d4-a716-446655440000'
const SPACE_ID = '550e8400-e29b-41d4-a716-446655440001'
const MISSING_ID = '12345678-1234-4234-8234-123456789012'

function makeApp() {
  const app = new OpenAPIHono<{ Variables: AuthContext }>()
  app.use('*', async (c, next) => {
    c.set('userId', USER_ID)
    c.set('apiKeyId', '550e8400-e29b-41d4-a716-446655440099')
    c.set('apiKeyName', 'test')
    await next()
  })
  app.route('/', spacesRouter)
  return app
}

function makeProperty() {
  return { id: PROP_ID, userId: USER_ID, name: 'My Home' }
}

function makeSpace(overrides: Record<string, unknown> = {}) {
  return {
    id: SPACE_ID,
    propertyId: PROP_ID,
    name: 'Kitchen',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  }
}

function makePaginatedResult(spaces: ReturnType<typeof makeSpace>[]) {
  return { data: spaces, total: spaces.length, page: 1, limit: 50, pages: 1, hasMore: false }
}

describe('GET /properties/:propertyId/spaces', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns paginated spaces', async () => {
    mockPropertyService.findById.mockResolvedValue(makeProperty())
    mockSpaceService.findPaginatedForProperty.mockResolvedValue(makePaginatedResult([makeSpace()]))

    const res = await makeApp().request(`/properties/${PROP_ID}/spaces`)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].name).toBe('Kitchen')
  })

  it('returns 404 when property not found', async () => {
    mockPropertyService.findById.mockResolvedValue(null)

    const res = await makeApp().request(`/properties/${MISSING_ID}/spaces`)

    expect(res.status).toBe(404)
  })

  it('does not list spaces when property not found', async () => {
    mockPropertyService.findById.mockResolvedValue(null)

    await makeApp().request(`/properties/${MISSING_ID}/spaces`)

    expect(mockSpaceService.findPaginatedForProperty).not.toHaveBeenCalled()
  })
})

describe('GET /spaces/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns space by id', async () => {
    mockSpaceService.findById.mockResolvedValue(makeSpace())
    mockPropertyService.findById.mockResolvedValue(makeProperty())

    const res = await makeApp().request(`/spaces/${SPACE_ID}`)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.id).toBe(SPACE_ID)
    expect(body.name).toBe('Kitchen')
  })

  it('returns 404 when space not found', async () => {
    mockSpaceService.findById.mockResolvedValue(null)

    const res = await makeApp().request(`/spaces/${MISSING_ID}`)

    expect(res.status).toBe(404)
  })

  it('returns 404 when property not owned by user', async () => {
    mockSpaceService.findById.mockResolvedValue(makeSpace())
    mockPropertyService.findById.mockResolvedValue(null)

    const res = await makeApp().request(`/spaces/${SPACE_ID}`)

    expect(res.status).toBe(404)
  })

  it('serializes dates as ISO strings', async () => {
    mockSpaceService.findById.mockResolvedValue(makeSpace())
    mockPropertyService.findById.mockResolvedValue(makeProperty())

    const res = await makeApp().request(`/spaces/${SPACE_ID}`)
    const body = await res.json()

    expect(body.createdAt).toBe('2026-01-01T00:00:00.000Z')
  })
})

describe('POST /properties/:propertyId/spaces', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates space and returns 201', async () => {
    mockPropertyService.findById.mockResolvedValue(makeProperty())
    mockSpaceService.create.mockResolvedValue(makeSpace())

    const res = await makeApp().request(`/properties/${PROP_ID}/spaces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Kitchen' }),
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.name).toBe('Kitchen')
  })

  it('returns 404 when property not found', async () => {
    mockPropertyService.findById.mockResolvedValue(null)

    const res = await makeApp().request(`/properties/${MISSING_ID}/spaces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Kitchen' }),
    })

    expect(res.status).toBe(404)
  })

  it('calls space service with propertyId and name', async () => {
    mockPropertyService.findById.mockResolvedValue(makeProperty())
    mockSpaceService.create.mockResolvedValue(makeSpace())

    await makeApp().request(`/properties/${PROP_ID}/spaces`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Garage' }),
    })

    expect(mockSpaceService.create).toHaveBeenCalledWith(USER_ID, { propertyId: PROP_ID, name: 'Garage' })
  })
})

describe('PATCH /spaces/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates space and returns 200', async () => {
    mockSpaceService.findById.mockResolvedValue(makeSpace())
    mockPropertyService.findById.mockResolvedValue(makeProperty())
    mockSpaceService.update.mockResolvedValue(makeSpace({ name: 'Living Room' }))

    const res = await makeApp().request(`/spaces/${SPACE_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Living Room' }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.name).toBe('Living Room')
  })

  it('returns 404 when space not found', async () => {
    mockSpaceService.findById.mockResolvedValue(null)

    const res = await makeApp().request(`/spaces/${MISSING_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Living Room' }),
    })

    expect(res.status).toBe(404)
  })

  it('returns 404 when property not owned by user', async () => {
    mockSpaceService.findById.mockResolvedValue(makeSpace())
    mockPropertyService.findById.mockResolvedValue(null)

    const res = await makeApp().request(`/spaces/${SPACE_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' }),
    })

    expect(res.status).toBe(404)
  })
})

describe('DELETE /spaces/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes space and returns 204', async () => {
    mockSpaceService.findById.mockResolvedValue(makeSpace())
    mockPropertyService.findById.mockResolvedValue(makeProperty())
    mockSpaceService.delete.mockResolvedValue(undefined)

    const res = await makeApp().request(`/spaces/${SPACE_ID}`, { method: 'DELETE' })

    expect(res.status).toBe(204)
    expect(mockSpaceService.delete).toHaveBeenCalledWith(SPACE_ID)
  })

  it('returns 404 when space not found', async () => {
    mockSpaceService.findById.mockResolvedValue(null)

    const res = await makeApp().request(`/spaces/${MISSING_ID}`, { method: 'DELETE' })

    expect(res.status).toBe(404)
  })

  it('returns 404 when property not owned by user', async () => {
    mockSpaceService.findById.mockResolvedValue(makeSpace())
    mockPropertyService.findById.mockResolvedValue(null)

    const res = await makeApp().request(`/spaces/${SPACE_ID}`, { method: 'DELETE' })

    expect(res.status).toBe(404)
  })

  it('does not delete when property not owned', async () => {
    mockSpaceService.findById.mockResolvedValue(makeSpace())
    mockPropertyService.findById.mockResolvedValue(null)

    await makeApp().request(`/spaces/${SPACE_ID}`, { method: 'DELETE' })

    expect(mockSpaceService.delete).not.toHaveBeenCalled()
  })
})
