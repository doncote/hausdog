import { OpenAPIHono } from '@hono/zod-openapi'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({ prisma: {} }))
vi.mock('@/lib/console-logger', () => ({
  consoleLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const mockService = vi.hoisted(() => ({
  findPaginatedForUser: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}))

const mockActivityService = vi.hoisted(() => ({
  findRecent: vi.fn(),
}))

vi.mock('@/features/properties/service', () => ({
  PropertyService: vi.fn().mockImplementation(() => mockService),
}))

vi.mock('@/features/activity/service', () => ({
  ActivityService: vi.fn().mockImplementation(() => mockActivityService),
}))

import type { AuthContext } from '../middleware/auth'
import { propertiesRouter } from './properties'

const USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const PROP_ID = '550e8400-e29b-41d4-a716-446655440000'
const MISSING_ID = '12345678-1234-4234-8234-123456789012'

function makeApp() {
  const app = new OpenAPIHono<{ Variables: AuthContext }>()
  app.use('*', async (c, next) => {
    c.set('userId', USER_ID)
    c.set('apiKeyId', '550e8400-e29b-41d4-a716-446655440099')
    c.set('apiKeyName', 'test')
    await next()
  })
  app.route('/', propertiesRouter)
  return app
}

function makeProperty(overrides: Record<string, unknown> = {}) {
  return {
    id: PROP_ID,
    userId: USER_ID,
    name: 'My Home',
    streetAddress: '123 Main St',
    city: 'Springfield',
    state: 'IL',
    postalCode: '62701',
    country: 'US',
    formattedAddress: '123 Main St, Springfield, IL 62701',
    yearBuilt: 1990,
    squareFeet: 1800,
    bedrooms: 3,
    bathrooms: 2,
    propertyType: 'single_family',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  }
}

function makePaginatedResult(properties: ReturnType<typeof makeProperty>[]) {
  return {
    data: properties,
    total: properties.length,
    page: 1,
    limit: 50,
    pages: 1,
    hasMore: false,
  }
}

describe('GET /properties', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns paginated properties', async () => {
    mockService.findPaginatedForUser.mockResolvedValue(makePaginatedResult([makeProperty()]))

    const res = await makeApp().request('/properties')
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].name).toBe('My Home')
    expect(body.total).toBe(1)
  })

  it('calls service with userId from context', async () => {
    mockService.findPaginatedForUser.mockResolvedValue(makePaginatedResult([]))

    await makeApp().request('/properties')

    expect(mockService.findPaginatedForUser).toHaveBeenCalledWith(USER_ID, expect.any(Object))
  })

  it('passes pagination params to service', async () => {
    mockService.findPaginatedForUser.mockResolvedValue(makePaginatedResult([]))

    await makeApp().request('/properties?page=2&limit=25')

    const [, pagination] = mockService.findPaginatedForUser.mock.calls[0]
    expect(pagination.page).toBe(2)
    expect(pagination.limit).toBe(25)
  })

  it('serializes dates as ISO strings', async () => {
    mockService.findPaginatedForUser.mockResolvedValue(makePaginatedResult([makeProperty()]))

    const res = await makeApp().request('/properties')
    const body = await res.json()

    expect(body.data[0].createdAt).toBe('2026-01-01T00:00:00.000Z')
  })
})

describe('GET /properties/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns property by id', async () => {
    mockService.findById.mockResolvedValue(makeProperty())

    const res = await makeApp().request(`/properties/${PROP_ID}`)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.id).toBe(PROP_ID)
    expect(body.name).toBe('My Home')
  })

  it('calls service with id and userId', async () => {
    mockService.findById.mockResolvedValue(makeProperty())

    await makeApp().request(`/properties/${PROP_ID}`)

    expect(mockService.findById).toHaveBeenCalledWith(PROP_ID, USER_ID)
  })

  it('returns 404 when property not found', async () => {
    mockService.findById.mockResolvedValue(null)

    const res = await makeApp().request(`/properties/${MISSING_ID}`)

    expect(res.status).toBe(404)
  })
})

describe('POST /properties', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates property and returns 201', async () => {
    mockService.create.mockResolvedValue(makeProperty())

    const res = await makeApp().request('/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'My Home' }),
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.name).toBe('My Home')
  })

  it('calls service with userId and input', async () => {
    mockService.create.mockResolvedValue(makeProperty())

    await makeApp().request('/properties', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'New Place', city: 'Chicago' }),
    })

    expect(mockService.create).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ name: 'New Place', city: 'Chicago' }),
    )
  })
})

describe('PATCH /properties/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates property and returns 200', async () => {
    mockService.findById.mockResolvedValue(makeProperty())
    mockService.update.mockResolvedValue(makeProperty({ name: 'Updated Home' }))

    const res = await makeApp().request(`/properties/${PROP_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Home' }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.name).toBe('Updated Home')
  })

  it('returns 404 when property not found', async () => {
    mockService.findById.mockResolvedValue(null)

    const res = await makeApp().request(`/properties/${MISSING_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' }),
    })

    expect(res.status).toBe(404)
  })

  it('does not call update when property not found', async () => {
    mockService.findById.mockResolvedValue(null)

    await makeApp().request(`/properties/${MISSING_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' }),
    })

    expect(mockService.update).not.toHaveBeenCalled()
  })
})

describe('DELETE /properties/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes property and returns 204', async () => {
    mockService.findById.mockResolvedValue(makeProperty())
    mockService.delete.mockResolvedValue(undefined)

    const res = await makeApp().request(`/properties/${PROP_ID}`, { method: 'DELETE' })

    expect(res.status).toBe(204)
    expect(mockService.delete).toHaveBeenCalledWith(PROP_ID, USER_ID)
  })

  it('returns 404 when property not found', async () => {
    mockService.findById.mockResolvedValue(null)

    const res = await makeApp().request(`/properties/${MISSING_ID}`, { method: 'DELETE' })

    expect(res.status).toBe(404)
  })

  it('does not call delete when property not found', async () => {
    mockService.findById.mockResolvedValue(null)

    await makeApp().request(`/properties/${MISSING_ID}`, { method: 'DELETE' })

    expect(mockService.delete).not.toHaveBeenCalled()
  })
})

describe('GET /properties/:id/activity', () => {
  beforeEach(() => vi.clearAllMocks())

  function makeActivity(overrides: Record<string, unknown> = {}) {
    return {
      id: 'act-001',
      propertyId: PROP_ID,
      userId: USER_ID,
      action: 'created',
      entityType: 'item',
      entityId: 'item-001',
      entityName: 'Water Heater',
      metadata: null,
      createdAt: new Date('2026-01-15'),
      ...overrides,
    }
  }

  it('returns activity list for accessible property', async () => {
    mockService.findById.mockResolvedValue(makeProperty())
    mockActivityService.findRecent.mockResolvedValue([makeActivity()])

    const res = await makeApp().request(`/properties/${PROP_ID}/activity`)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveLength(1)
    expect(body[0].action).toBe('created')
    expect(body[0].createdAt).toBe('2026-01-15T00:00:00.000Z')
  })

  it('returns 404 when property not accessible', async () => {
    mockService.findById.mockResolvedValue(null)

    const res = await makeApp().request(`/properties/${MISSING_ID}/activity`)

    expect(res.status).toBe(404)
    expect(mockActivityService.findRecent).not.toHaveBeenCalled()
  })

  it('passes limit query param to service', async () => {
    mockService.findById.mockResolvedValue(makeProperty())
    mockActivityService.findRecent.mockResolvedValue([])

    await makeApp().request(`/properties/${PROP_ID}/activity?limit=10`)

    expect(mockActivityService.findRecent).toHaveBeenCalledWith(PROP_ID, 10)
  })

  it('uses default limit of 50 when not specified', async () => {
    mockService.findById.mockResolvedValue(makeProperty())
    mockActivityService.findRecent.mockResolvedValue([])

    await makeApp().request(`/properties/${PROP_ID}/activity`)

    expect(mockActivityService.findRecent).toHaveBeenCalledWith(PROP_ID, 50)
  })
})
