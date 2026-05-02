import { OpenAPIHono } from '@hono/zod-openapi'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({ prisma: {} }))
vi.mock('@/lib/console-logger', () => ({
  consoleLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const mockItemService = vi.hoisted(() => ({
  findPaginatedForProperty: vi.fn(),
  findPaginatedForSpace: vi.fn(),
  findById: vi.fn(),
  findChildrenForItem: vi.fn(),
  create: vi.fn(),
  update: vi.fn(),
  delete: vi.fn(),
}))

const mockPropertyService = vi.hoisted(() => ({
  findById: vi.fn(),
  canWrite: vi.fn(),
}))

const mockSpaceService = vi.hoisted(() => ({
  findById: vi.fn(),
}))

vi.mock('@/features/items/service', () => ({
  ItemService: vi.fn().mockImplementation(() => mockItemService),
}))

vi.mock('@/features/properties/service', () => ({
  PropertyService: vi.fn().mockImplementation(() => mockPropertyService),
}))

vi.mock('@/features/spaces/service', () => ({
  SpaceService: vi.fn().mockImplementation(() => mockSpaceService),
}))

import type { AuthContext } from '../middleware/auth'
import { itemsRouter } from './items'

const USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const PROP_ID = '550e8400-e29b-41d4-a716-446655440000'
const SPACE_ID = '550e8400-e29b-41d4-a716-446655440001'
const ITEM_ID = '550e8400-e29b-41d4-a716-446655440002'
const CHILD_ID = '550e8400-e29b-41d4-a716-446655440003'
const MISSING_ID = '12345678-1234-4234-8234-123456789012'

function makeApp() {
  const app = new OpenAPIHono<{ Variables: AuthContext }>()
  app.use('*', async (c, next) => {
    c.set('userId', USER_ID)
    c.set('apiKeyId', '550e8400-e29b-41d4-a716-446655440099')
    c.set('apiKeyName', 'test')
    await next()
  })
  app.route('/', itemsRouter)
  return app
}

function makeProperty() {
  return { id: PROP_ID, userId: USER_ID, name: 'My Home' }
}

function makeSpace(overrides: Record<string, unknown> = {}) {
  return { id: SPACE_ID, propertyId: PROP_ID, name: 'Kitchen', ...overrides }
}

function makeItem(overrides: Record<string, unknown> = {}) {
  return {
    id: ITEM_ID,
    propertyId: PROP_ID,
    spaceId: null,
    parentId: null,
    name: 'Refrigerator',
    description: null,
    category: 'appliances',
    manufacturer: 'Samsung',
    model: 'RF28',
    serialNumber: null,
    acquiredDate: null,
    warrantyExpires: null,
    purchasePrice: null,
    notes: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  }
}

function makePaginatedResult(items: ReturnType<typeof makeItem>[]) {
  return { data: items, total: items.length, page: 1, limit: 50, pages: 1, hasMore: false }
}

describe('GET /properties/:propertyId/items', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns paginated items for property', async () => {
    mockPropertyService.findById.mockResolvedValue(makeProperty())
    mockItemService.findPaginatedForProperty.mockResolvedValue(makePaginatedResult([makeItem()]))

    const res = await makeApp().request(`/properties/${PROP_ID}/items`)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].name).toBe('Refrigerator')
  })

  it('returns 404 when property not found', async () => {
    mockPropertyService.findById.mockResolvedValue(null)

    const res = await makeApp().request(`/properties/${MISSING_ID}/items`)

    expect(res.status).toBe(404)
  })

  it('filters by spaceId when provided', async () => {
    mockPropertyService.findById.mockResolvedValue(makeProperty())
    mockSpaceService.findById.mockResolvedValue(makeSpace())
    mockItemService.findPaginatedForSpace.mockResolvedValue(makePaginatedResult([makeItem()]))

    await makeApp().request(`/properties/${PROP_ID}/items?spaceId=${SPACE_ID}`)

    expect(mockItemService.findPaginatedForSpace).toHaveBeenCalledWith(SPACE_ID, expect.any(Object))
    expect(mockItemService.findPaginatedForProperty).not.toHaveBeenCalled()
  })

  it('returns 404 when space not found for spaceId filter', async () => {
    mockPropertyService.findById.mockResolvedValue(makeProperty())
    mockSpaceService.findById.mockResolvedValue(null)

    const res = await makeApp().request(`/properties/${PROP_ID}/items?spaceId=${SPACE_ID}`)

    expect(res.status).toBe(404)
  })

  it('returns 404 when space belongs to different property', async () => {
    mockPropertyService.findById.mockResolvedValue(makeProperty())
    mockSpaceService.findById.mockResolvedValue(makeSpace({ propertyId: MISSING_ID }))

    const res = await makeApp().request(`/properties/${PROP_ID}/items?spaceId=${SPACE_ID}`)

    expect(res.status).toBe(404)
  })
})

describe('GET /items/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns item by id', async () => {
    mockItemService.findById.mockResolvedValue(makeItem())
    mockPropertyService.findById.mockResolvedValue(makeProperty())

    const res = await makeApp().request(`/items/${ITEM_ID}`)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.id).toBe(ITEM_ID)
    expect(body.name).toBe('Refrigerator')
  })

  it('returns 404 when item not found', async () => {
    mockItemService.findById.mockResolvedValue(null)

    const res = await makeApp().request(`/items/${MISSING_ID}`)

    expect(res.status).toBe(404)
  })

  it('returns 404 when property not owned by user', async () => {
    mockItemService.findById.mockResolvedValue(makeItem())
    mockPropertyService.findById.mockResolvedValue(null)

    const res = await makeApp().request(`/items/${ITEM_ID}`)

    expect(res.status).toBe(404)
  })

  it('serializes null date fields', async () => {
    mockItemService.findById.mockResolvedValue(makeItem())
    mockPropertyService.findById.mockResolvedValue(makeProperty())

    const res = await makeApp().request(`/items/${ITEM_ID}`)
    const body = await res.json()

    expect(body.acquiredDate).toBeNull()
    expect(body.warrantyExpires).toBeNull()
  })
})

describe('GET /items/:id/children', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns children of item', async () => {
    mockItemService.findById.mockResolvedValue(makeItem())
    mockPropertyService.findById.mockResolvedValue(makeProperty())
    mockItemService.findChildrenForItem.mockResolvedValue([
      makeItem({ id: CHILD_ID, name: 'Ice Maker' }),
    ])

    const res = await makeApp().request(`/items/${ITEM_ID}/children`)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveLength(1)
    expect(body[0].name).toBe('Ice Maker')
  })

  it('returns 404 when item not found', async () => {
    mockItemService.findById.mockResolvedValue(null)

    const res = await makeApp().request(`/items/${MISSING_ID}/children`)

    expect(res.status).toBe(404)
  })

  it('returns 404 when property not owned by user', async () => {
    mockItemService.findById.mockResolvedValue(makeItem())
    mockPropertyService.findById.mockResolvedValue(null)

    const res = await makeApp().request(`/items/${ITEM_ID}/children`)

    expect(res.status).toBe(404)
  })
})

describe('POST /properties/:propertyId/items', () => {
  beforeEach(() => vi.clearAllMocks())

  it('creates item and returns 201', async () => {
    mockPropertyService.canWrite.mockResolvedValue(true)
    mockItemService.create.mockResolvedValue(makeItem())

    const res = await makeApp().request(`/properties/${PROP_ID}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Refrigerator', category: 'appliances' }),
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.name).toBe('Refrigerator')
  })

  it('returns 404 when property not found', async () => {
    mockPropertyService.canWrite.mockResolvedValue(false)

    const res = await makeApp().request(`/properties/${MISSING_ID}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Refrigerator', category: 'appliances' }),
    })

    expect(res.status).toBe(404)
  })

  it('passes propertyId to service', async () => {
    mockPropertyService.canWrite.mockResolvedValue(true)
    mockItemService.create.mockResolvedValue(makeItem())

    await makeApp().request(`/properties/${PROP_ID}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Dishwasher', category: 'appliances' }),
    })

    expect(mockItemService.create).toHaveBeenCalledWith(
      USER_ID,
      expect.objectContaining({
        propertyId: PROP_ID,
        name: 'Dishwasher',
      }),
    )
  })
})

describe('PATCH /items/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates item and returns 200', async () => {
    mockItemService.findById.mockResolvedValue(makeItem())
    mockPropertyService.canWrite.mockResolvedValue(true)
    mockItemService.update.mockResolvedValue(makeItem({ name: 'Updated Fridge' }))

    const res = await makeApp().request(`/items/${ITEM_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Fridge' }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.name).toBe('Updated Fridge')
  })

  it('returns 404 when item not found', async () => {
    mockItemService.findById.mockResolvedValue(null)

    const res = await makeApp().request(`/items/${MISSING_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' }),
    })

    expect(res.status).toBe(404)
  })

  it('returns 404 when property not owned by user', async () => {
    mockItemService.findById.mockResolvedValue(makeItem())
    mockPropertyService.canWrite.mockResolvedValue(false)

    const res = await makeApp().request(`/items/${ITEM_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated' }),
    })

    expect(res.status).toBe(404)
  })
})

describe('DELETE /items/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes item and returns 204', async () => {
    mockItemService.findById.mockResolvedValue(makeItem())
    mockPropertyService.canWrite.mockResolvedValue(true)
    mockItemService.delete.mockResolvedValue(undefined)

    const res = await makeApp().request(`/items/${ITEM_ID}`, { method: 'DELETE' })

    expect(res.status).toBe(204)
    expect(mockItemService.delete).toHaveBeenCalledWith(ITEM_ID)
  })

  it('returns 404 when item not found', async () => {
    mockItemService.findById.mockResolvedValue(null)

    const res = await makeApp().request(`/items/${MISSING_ID}`, { method: 'DELETE' })

    expect(res.status).toBe(404)
  })

  it('returns 404 when property not owned by user', async () => {
    mockItemService.findById.mockResolvedValue(makeItem())
    mockPropertyService.canWrite.mockResolvedValue(false)

    const res = await makeApp().request(`/items/${ITEM_ID}`, { method: 'DELETE' })

    expect(res.status).toBe(404)
  })

  it('does not delete when ownership check fails', async () => {
    mockItemService.findById.mockResolvedValue(makeItem())
    mockPropertyService.canWrite.mockResolvedValue(false)

    await makeApp().request(`/items/${ITEM_ID}`, { method: 'DELETE' })

    expect(mockItemService.delete).not.toHaveBeenCalled()
  })
})
