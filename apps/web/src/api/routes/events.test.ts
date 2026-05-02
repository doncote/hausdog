import { OpenAPIHono } from '@hono/zod-openapi'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({ prisma: {} }))
vi.mock('@/lib/console-logger', () => ({
  consoleLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const mockEventService = vi.hoisted(() => ({
  findPaginatedForItem: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}))

const mockItemService = vi.hoisted(() => ({
  findById: vi.fn(),
}))

const mockPropertyService = vi.hoisted(() => ({
  findById: vi.fn(),
  canWrite: vi.fn(),
}))

vi.mock('@/features/events/service', () => ({
  EventService: vi.fn().mockImplementation(() => mockEventService),
}))

vi.mock('@/features/items/service', () => ({
  ItemService: vi.fn().mockImplementation(() => mockItemService),
}))

vi.mock('@/features/properties/service', () => ({
  PropertyService: vi.fn().mockImplementation(() => mockPropertyService),
}))

import type { AuthContext } from '../middleware/auth'
import { eventsRouter } from './events'

const USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const PROP_ID = '550e8400-e29b-41d4-a716-446655440000'
const ITEM_ID = '550e8400-e29b-41d4-a716-446655440001'
const EVENT_ID = '550e8400-e29b-41d4-a716-446655440002'
const MISSING_ID = '12345678-1234-4234-8234-123456789012'

function makeApp() {
  const app = new OpenAPIHono<{ Variables: AuthContext }>()
  app.use('*', async (c, next) => {
    c.set('userId', USER_ID)
    c.set('apiKeyId', '550e8400-e29b-41d4-a716-446655440099')
    c.set('apiKeyName', 'test')
    await next()
  })
  app.route('/', eventsRouter)
  return app
}

function makeProperty() {
  return { id: PROP_ID, userId: USER_ID, name: 'My Home' }
}

function makeItem() {
  return { id: ITEM_ID, propertyId: PROP_ID, name: 'Refrigerator' }
}

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: EVENT_ID,
    itemId: ITEM_ID,
    type: 'maintenance',
    date: new Date('2026-03-01'),
    description: 'Annual checkup',
    cost: null,
    performedBy: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  }
}

function makePaginatedResult(events: ReturnType<typeof makeEvent>[]) {
  return { data: events, total: events.length, page: 1, limit: 50, pages: 1, hasMore: false }
}

describe('GET /items/:itemId/events', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns paginated events', async () => {
    mockItemService.findById.mockResolvedValue(makeItem())
    mockPropertyService.findById.mockResolvedValue(makeProperty())
    mockEventService.findPaginatedForItem.mockResolvedValue(makePaginatedResult([makeEvent()]))

    const res = await makeApp().request(`/items/${ITEM_ID}/events`)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].type).toBe('maintenance')
  })

  it('returns 404 when item not found', async () => {
    mockItemService.findById.mockResolvedValue(null)

    const res = await makeApp().request(`/items/${MISSING_ID}/events`)

    expect(res.status).toBe(404)
  })

  it('returns 404 when property not owned by user', async () => {
    mockItemService.findById.mockResolvedValue(makeItem())
    mockPropertyService.findById.mockResolvedValue(null)

    const res = await makeApp().request(`/items/${ITEM_ID}/events`)

    expect(res.status).toBe(404)
  })
})

describe('GET /events/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns event by id', async () => {
    mockEventService.findById.mockResolvedValue(makeEvent())
    mockItemService.findById.mockResolvedValue(makeItem())
    mockPropertyService.findById.mockResolvedValue(makeProperty())

    const res = await makeApp().request(`/events/${EVENT_ID}`)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.id).toBe(EVENT_ID)
    expect(body.type).toBe('maintenance')
  })

  it('returns 404 when event not found', async () => {
    mockEventService.findById.mockResolvedValue(null)

    const res = await makeApp().request(`/events/${MISSING_ID}`)

    expect(res.status).toBe(404)
  })

  it('returns 404 when item not found', async () => {
    mockEventService.findById.mockResolvedValue(makeEvent())
    mockItemService.findById.mockResolvedValue(null)

    const res = await makeApp().request(`/events/${EVENT_ID}`)

    expect(res.status).toBe(404)
  })

  it('returns 404 when property not owned by user', async () => {
    mockEventService.findById.mockResolvedValue(makeEvent())
    mockItemService.findById.mockResolvedValue(makeItem())
    mockPropertyService.findById.mockResolvedValue(null)

    const res = await makeApp().request(`/events/${EVENT_ID}`)

    expect(res.status).toBe(404)
  })

  it('serializes dates as ISO strings', async () => {
    mockEventService.findById.mockResolvedValue(makeEvent())
    mockItemService.findById.mockResolvedValue(makeItem())
    mockPropertyService.findById.mockResolvedValue(makeProperty())

    const res = await makeApp().request(`/events/${EVENT_ID}`)
    const body = await res.json()

    expect(body.date).toBe('2026-03-01T00:00:00.000Z')
    expect(body.createdAt).toBe('2026-01-01T00:00:00.000Z')
  })
})

describe('POST /items/:itemId/events', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates event and returns 201', async () => {
    mockItemService.findById.mockResolvedValue(makeItem())
    mockPropertyService.canWrite.mockResolvedValue(true)
    mockEventService.create.mockResolvedValue(makeEvent())

    const res = await makeApp().request(`/items/${ITEM_ID}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'maintenance', date: '2026-03-01T00:00:00.000Z' }),
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.type).toBe('maintenance')
  })

  it('returns 404 when item not found', async () => {
    mockItemService.findById.mockResolvedValue(null)

    const res = await makeApp().request(`/items/${MISSING_ID}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'maintenance', date: '2026-03-01T00:00:00.000Z' }),
    })

    expect(res.status).toBe(404)
  })

  it('returns 404 when property not owned by user', async () => {
    mockItemService.findById.mockResolvedValue(makeItem())
    mockPropertyService.canWrite.mockResolvedValue(false)

    const res = await makeApp().request(`/items/${ITEM_ID}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type: 'maintenance', date: '2026-03-01T00:00:00.000Z' }),
    })

    expect(res.status).toBe(404)
  })
})

describe('PATCH /events/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates event and returns 200', async () => {
    mockEventService.findById.mockResolvedValue(makeEvent())
    mockItemService.findById.mockResolvedValue(makeItem())
    mockPropertyService.canWrite.mockResolvedValue(true)
    mockEventService.update.mockResolvedValue(makeEvent({ description: 'Updated checkup' }))

    const res = await makeApp().request(`/events/${EVENT_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'Updated checkup' }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.description).toBe('Updated checkup')
  })

  it('returns 404 when event not found', async () => {
    mockEventService.findById.mockResolvedValue(null)

    const res = await makeApp().request(`/events/${MISSING_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'Updated' }),
    })

    expect(res.status).toBe(404)
  })

  it('returns 404 when property not owned by user', async () => {
    mockEventService.findById.mockResolvedValue(makeEvent())
    mockItemService.findById.mockResolvedValue(makeItem())
    mockPropertyService.canWrite.mockResolvedValue(false)

    const res = await makeApp().request(`/events/${EVENT_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ description: 'Updated' }),
    })

    expect(res.status).toBe(404)
  })
})

describe('DELETE /events/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes event and returns 204', async () => {
    mockEventService.findById.mockResolvedValue(makeEvent())
    mockItemService.findById.mockResolvedValue(makeItem())
    mockPropertyService.canWrite.mockResolvedValue(true)
    mockEventService.delete.mockResolvedValue(undefined)

    const res = await makeApp().request(`/events/${EVENT_ID}`, { method: 'DELETE' })

    expect(res.status).toBe(204)
    expect(mockEventService.delete).toHaveBeenCalledWith(EVENT_ID)
  })

  it('returns 404 when event not found', async () => {
    mockEventService.findById.mockResolvedValue(null)

    const res = await makeApp().request(`/events/${MISSING_ID}`, { method: 'DELETE' })

    expect(res.status).toBe(404)
  })

  it('returns 404 when property not owned by user', async () => {
    mockEventService.findById.mockResolvedValue(makeEvent())
    mockItemService.findById.mockResolvedValue(makeItem())
    mockPropertyService.canWrite.mockResolvedValue(false)

    const res = await makeApp().request(`/events/${EVENT_ID}`, { method: 'DELETE' })

    expect(res.status).toBe(404)
  })

  it('does not delete when ownership check fails', async () => {
    mockEventService.findById.mockResolvedValue(makeEvent())
    mockItemService.findById.mockResolvedValue(makeItem())
    mockPropertyService.canWrite.mockResolvedValue(false)

    await makeApp().request(`/events/${EVENT_ID}`, { method: 'DELETE' })

    expect(mockEventService.delete).not.toHaveBeenCalled()
  })
})
