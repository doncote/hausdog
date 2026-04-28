import { OpenAPIHono } from '@hono/zod-openapi'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockPrisma = vi.hoisted(() => ({
  property: { findMany: vi.fn() },
}))

vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))
vi.mock('@/lib/console-logger', () => ({
  consoleLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const mockMaintenanceService = vi.hoisted(() => ({
  findPaginatedForItem: vi.fn(),
  findUpcoming: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  complete: vi.fn(),
  snooze: vi.fn(),
  delete: vi.fn(),
  createFromAI: vi.fn(),
}))

const mockItemService = vi.hoisted(() => ({
  findById: vi.fn(),
}))

const mockPropertyService = vi.hoisted(() => ({
  findById: vi.fn(),
}))

vi.mock('@/features/maintenance/service', () => ({
  MaintenanceService: vi.fn().mockImplementation(() => mockMaintenanceService),
}))

vi.mock('@/features/items/service', () => ({
  ItemService: vi.fn().mockImplementation(() => mockItemService),
}))

vi.mock('@/features/properties/service', () => ({
  PropertyService: vi.fn().mockImplementation(() => mockPropertyService),
}))

import type { AuthContext } from '../middleware/auth'
import { maintenanceRouter } from './maintenance'

const USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const PROP_ID = '550e8400-e29b-41d4-a716-446655440000'
const ITEM_ID = '550e8400-e29b-41d4-a716-446655440001'
const TASK_ID = '550e8400-e29b-41d4-a716-446655440002'
const MISSING_ID = '12345678-1234-4234-8234-123456789012'

function makeApp() {
  const app = new OpenAPIHono<{ Variables: AuthContext }>()
  app.use('*', async (c, next) => {
    c.set('userId', USER_ID)
    c.set('apiKeyId', '550e8400-e29b-41d4-a716-446655440099')
    c.set('apiKeyName', 'test')
    await next()
  })
  app.route('/', maintenanceRouter)
  return app
}

function makeItem(overrides: Record<string, unknown> = {}) {
  return { id: ITEM_ID, propertyId: PROP_ID, name: 'HVAC Unit', ...overrides }
}

function makeProperty() {
  return { id: PROP_ID, userId: USER_ID, name: 'My Home' }
}

function makeTask(overrides: Record<string, unknown> = {}) {
  return {
    id: TASK_ID,
    propertyId: PROP_ID,
    itemId: ITEM_ID,
    name: 'Replace HVAC filter',
    description: null,
    intervalMonths: 3,
    nextDueDate: new Date('2026-04-01'),
    lastCompletedAt: null,
    source: 'manual',
    status: 'active',
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  }
}

function makePaginatedResult(tasks: ReturnType<typeof makeTask>[]) {
  return { data: tasks, total: tasks.length, page: 1, limit: 50, pages: 1, hasMore: false }
}

describe('GET /items/:itemId/maintenance', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns paginated maintenance tasks', async () => {
    mockItemService.findById.mockResolvedValue(makeItem())
    mockPropertyService.findById.mockResolvedValue(makeProperty())
    mockMaintenanceService.findPaginatedForItem.mockResolvedValue(makePaginatedResult([makeTask()]))

    const res = await makeApp().request(`/items/${ITEM_ID}/maintenance`)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].name).toBe('Replace HVAC filter')
  })

  it('returns 404 when item not found', async () => {
    mockItemService.findById.mockResolvedValue(null)

    const res = await makeApp().request(`/items/${MISSING_ID}/maintenance`)

    expect(res.status).toBe(404)
  })

  it('returns 404 when property not owned by user', async () => {
    mockItemService.findById.mockResolvedValue(makeItem())
    mockPropertyService.findById.mockResolvedValue(null)

    const res = await makeApp().request(`/items/${ITEM_ID}/maintenance`)

    expect(res.status).toBe(404)
  })

  it('does not call service when item not found', async () => {
    mockItemService.findById.mockResolvedValue(null)

    await makeApp().request(`/items/${MISSING_ID}/maintenance`)

    expect(mockMaintenanceService.findPaginatedForItem).not.toHaveBeenCalled()
  })

  it('serializes dates as ISO strings', async () => {
    mockItemService.findById.mockResolvedValue(makeItem())
    mockPropertyService.findById.mockResolvedValue(makeProperty())
    mockMaintenanceService.findPaginatedForItem.mockResolvedValue(makePaginatedResult([makeTask()]))

    const res = await makeApp().request(`/items/${ITEM_ID}/maintenance`)
    const body = await res.json()

    expect(body.data[0].nextDueDate).toBe('2026-04-01T00:00:00.000Z')
  })
})

describe('GET /maintenance/upcoming', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns empty array when user has no properties', async () => {
    mockPrisma.property.findMany.mockResolvedValue([])

    const res = await makeApp().request('/maintenance/upcoming')
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toEqual([])
    expect(mockMaintenanceService.findUpcoming).not.toHaveBeenCalled()
  })

  it('returns upcoming tasks for user properties', async () => {
    mockPrisma.property.findMany.mockResolvedValue([{ id: PROP_ID }])
    mockMaintenanceService.findUpcoming.mockResolvedValue([makeTask()])

    const res = await makeApp().request('/maintenance/upcoming')
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveLength(1)
    expect(body[0].name).toBe('Replace HVAC filter')
  })

  it('calls findUpcoming with property ids', async () => {
    mockPrisma.property.findMany.mockResolvedValue([{ id: PROP_ID }])
    mockMaintenanceService.findUpcoming.mockResolvedValue([])

    await makeApp().request('/maintenance/upcoming?limit=5')

    expect(mockMaintenanceService.findUpcoming).toHaveBeenCalledWith([PROP_ID], { limit: 5 })
  })
})

describe('GET /maintenance/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns task when found and owned', async () => {
    mockMaintenanceService.findById.mockResolvedValue(makeTask())
    mockPropertyService.findById.mockResolvedValue(makeProperty())

    const res = await makeApp().request(`/maintenance/${TASK_ID}`)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.id).toBe(TASK_ID)
  })

  it('returns 404 when task not found', async () => {
    mockMaintenanceService.findById.mockResolvedValue(null)

    const res = await makeApp().request(`/maintenance/${MISSING_ID}`)

    expect(res.status).toBe(404)
  })

  it('returns 404 when property not owned by user', async () => {
    mockMaintenanceService.findById.mockResolvedValue(makeTask())
    mockPropertyService.findById.mockResolvedValue(null)

    const res = await makeApp().request(`/maintenance/${TASK_ID}`)

    expect(res.status).toBe(404)
  })
})

describe('POST /items/:itemId/maintenance', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates task and returns 201', async () => {
    mockItemService.findById.mockResolvedValue(makeItem())
    mockPropertyService.findById.mockResolvedValue(makeProperty())
    mockMaintenanceService.create.mockResolvedValue(makeTask())

    const res = await makeApp().request(`/items/${ITEM_ID}/maintenance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Replace HVAC filter',
        intervalMonths: 3,
        nextDueDate: '2026-04-01T00:00:00.000Z',
      }),
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.name).toBe('Replace HVAC filter')
  })

  it('returns 404 when item not found', async () => {
    mockItemService.findById.mockResolvedValue(null)

    const res = await makeApp().request(`/items/${MISSING_ID}/maintenance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Task',
        intervalMonths: 3,
        nextDueDate: '2026-04-01T00:00:00.000Z',
      }),
    })

    expect(res.status).toBe(404)
  })

  it('returns 404 when property not owned by user', async () => {
    mockItemService.findById.mockResolvedValue(makeItem())
    mockPropertyService.findById.mockResolvedValue(null)

    const res = await makeApp().request(`/items/${ITEM_ID}/maintenance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Task',
        intervalMonths: 3,
        nextDueDate: '2026-04-01T00:00:00.000Z',
      }),
    })

    expect(res.status).toBe(404)
  })

  it('passes propertyId and itemId to service', async () => {
    mockItemService.findById.mockResolvedValue(makeItem())
    mockPropertyService.findById.mockResolvedValue(makeProperty())
    mockMaintenanceService.create.mockResolvedValue(makeTask())

    await makeApp().request(`/items/${ITEM_ID}/maintenance`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Replace HVAC filter',
        intervalMonths: 3,
        nextDueDate: '2026-04-01T00:00:00.000Z',
      }),
    })

    expect(mockMaintenanceService.create).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({ propertyId: PROP_ID, itemId: ITEM_ID }),
    )
  })
})

describe('PATCH /maintenance/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates task and returns 200', async () => {
    mockMaintenanceService.findById.mockResolvedValue(makeTask())
    mockPropertyService.findById.mockResolvedValue(makeProperty())
    mockMaintenanceService.update.mockResolvedValue(makeTask({ name: 'Updated Task' }))

    const res = await makeApp().request(`/maintenance/${TASK_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Task' }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.name).toBe('Updated Task')
  })

  it('returns 404 when task not found', async () => {
    mockMaintenanceService.findById.mockResolvedValue(null)

    const res = await makeApp().request(`/maintenance/${MISSING_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' }),
    })

    expect(res.status).toBe(404)
  })

  it('returns 404 when property not owned', async () => {
    mockMaintenanceService.findById.mockResolvedValue(makeTask())
    mockPropertyService.findById.mockResolvedValue(null)

    const res = await makeApp().request(`/maintenance/${TASK_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'paused' }),
    })

    expect(res.status).toBe(404)
  })
})

describe('POST /maintenance/:id/complete', () => {
  beforeEach(() => vi.clearAllMocks())

  it('completes task and returns 200', async () => {
    mockMaintenanceService.findById.mockResolvedValue(makeTask())
    mockPropertyService.findById.mockResolvedValue(makeProperty())
    mockMaintenanceService.complete.mockResolvedValue(
      makeTask({ lastCompletedAt: new Date('2026-04-01') }),
    )

    const res = await makeApp().request(`/maintenance/${TASK_ID}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: '2026-04-01T00:00:00.000Z' }),
    })

    expect(res.status).toBe(200)
  })

  it('returns 404 when task not found', async () => {
    mockMaintenanceService.findById.mockResolvedValue(null)

    const res = await makeApp().request(`/maintenance/${MISSING_ID}/complete`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ date: '2026-04-01T00:00:00.000Z' }),
    })

    expect(res.status).toBe(404)
  })
})

describe('POST /maintenance/:id/snooze', () => {
  beforeEach(() => vi.clearAllMocks())

  it('snoozes task and returns 200', async () => {
    mockMaintenanceService.findById.mockResolvedValue(makeTask())
    mockPropertyService.findById.mockResolvedValue(makeProperty())
    mockMaintenanceService.snooze.mockResolvedValue(makeTask({ nextDueDate: new Date('2026-07-01') }))

    const res = await makeApp().request(`/maintenance/${TASK_ID}/snooze`, { method: 'POST' })

    expect(res.status).toBe(200)
  })

  it('returns 404 when task not found', async () => {
    mockMaintenanceService.findById.mockResolvedValue(null)

    const res = await makeApp().request(`/maintenance/${MISSING_ID}/snooze`, { method: 'POST' })

    expect(res.status).toBe(404)
  })
})

describe('DELETE /maintenance/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes task and returns 204', async () => {
    mockMaintenanceService.findById.mockResolvedValue(makeTask())
    mockPropertyService.findById.mockResolvedValue(makeProperty())
    mockMaintenanceService.delete.mockResolvedValue(undefined)

    const res = await makeApp().request(`/maintenance/${TASK_ID}`, { method: 'DELETE' })

    expect(res.status).toBe(204)
    expect(mockMaintenanceService.delete).toHaveBeenCalledWith(TASK_ID)
  })

  it('returns 404 when task not found', async () => {
    mockMaintenanceService.findById.mockResolvedValue(null)

    const res = await makeApp().request(`/maintenance/${MISSING_ID}`, { method: 'DELETE' })

    expect(res.status).toBe(404)
  })

  it('returns 404 when property not owned', async () => {
    mockMaintenanceService.findById.mockResolvedValue(makeTask())
    mockPropertyService.findById.mockResolvedValue(null)

    const res = await makeApp().request(`/maintenance/${TASK_ID}`, { method: 'DELETE' })

    expect(res.status).toBe(404)
  })

  it('does not delete when ownership check fails', async () => {
    mockMaintenanceService.findById.mockResolvedValue(makeTask())
    mockPropertyService.findById.mockResolvedValue(null)

    await makeApp().request(`/maintenance/${TASK_ID}`, { method: 'DELETE' })

    expect(mockMaintenanceService.delete).not.toHaveBeenCalled()
  })
})
