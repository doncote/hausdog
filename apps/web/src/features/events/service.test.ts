import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { EventServiceDeps } from './service'
import { EventService } from './service'

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

function makePrismaEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: 'event-1',
    itemId: 'item-1',
    type: 'maintenance',
    date: new Date('2024-03-15'),
    description: 'Changed filter',
    cost: 50,
    performedBy: 'Bob',
    createdById: 'user-1',
    updatedById: 'user-1',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }
}

function makePrismaEventWithRelations(overrides: Record<string, unknown> = {}) {
  return {
    ...makePrismaEvent(overrides),
    item: { id: 'item-1', name: 'HVAC System' },
    _count: { documents: 2 },
  }
}

function makeService(dbOverrides: Record<string, unknown> = {}) {
  const mockDb = {
    event: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    ...dbOverrides,
  }
  const deps = { db: mockDb, logger: mockLogger } as unknown as EventServiceDeps

  return { service: new EventService(deps), mockDb }
}

describe('EventService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('findAllForItem', () => {
    it('orders by date desc', async () => {
      const { service, mockDb } = makeService()
      mockDb.event.findMany.mockResolvedValue([makePrismaEventWithRelations()])

      await service.findAllForItem('item-1')

      const call = mockDb.event.findMany.mock.calls[0][0]
      expect(call.where.itemId).toBe('item-1')
      expect(call.orderBy).toEqual({ date: 'desc' })
    })

    it('maps domain fields with relations', async () => {
      const { service, mockDb } = makeService()
      mockDb.event.findMany.mockResolvedValue([makePrismaEventWithRelations()])

      const result = await service.findAllForItem('item-1')

      expect(result[0]?.type).toBe('maintenance')
      expect(result[0]?.item?.name).toBe('HVAC System')
      expect(result[0]?._count?.documents).toBe(2)
    })

    it('converts cost to number', async () => {
      const { service, mockDb } = makeService()
      mockDb.event.findMany.mockResolvedValue([makePrismaEventWithRelations({ cost: 75.5 })])

      const result = await service.findAllForItem('item-1')

      expect(result[0]?.cost).toBe(75.5)
    })

    it('returns null cost when not set', async () => {
      const { service, mockDb } = makeService()
      mockDb.event.findMany.mockResolvedValue([makePrismaEventWithRelations({ cost: null })])

      const result = await service.findAllForItem('item-1')

      expect(result[0]?.cost).toBeNull()
    })
  })

  describe('findAllForItems', () => {
    it('returns empty map for empty itemIds array', async () => {
      const { service } = makeService()

      const result = await service.findAllForItems([])

      expect(result.size).toBe(0)
    })

    it('groups events by itemId', async () => {
      const { service, mockDb } = makeService()
      mockDb.event.findMany.mockResolvedValue([
        makePrismaEventWithRelations({ id: 'event-1', itemId: 'item-1' }),
        makePrismaEventWithRelations({ id: 'event-2', itemId: 'item-2' }),
        makePrismaEventWithRelations({ id: 'event-3', itemId: 'item-1' }),
      ])

      const result = await service.findAllForItems(['item-1', 'item-2'])

      expect(result.get('item-1')).toHaveLength(2)
      expect(result.get('item-2')).toHaveLength(1)
    })

    it('initializes empty arrays for items with no events', async () => {
      const { service, mockDb } = makeService()
      mockDb.event.findMany.mockResolvedValue([])

      const result = await service.findAllForItems(['item-1', 'item-2'])

      expect(result.get('item-1')).toEqual([])
      expect(result.get('item-2')).toEqual([])
    })
  })

  describe('findPaginatedForItem', () => {
    it('applies correct skip/take for pagination', async () => {
      const { service, mockDb } = makeService()
      mockDb.event.findMany.mockResolvedValue([])
      mockDb.event.count.mockResolvedValue(0)

      await service.findPaginatedForItem('item-1', { page: 3, limit: 5 })

      const call = mockDb.event.findMany.mock.calls[0][0]
      expect(call.skip).toBe(10)
      expect(call.take).toBe(5)
    })

    it('returns correct pagination metadata', async () => {
      const { service, mockDb } = makeService()
      mockDb.event.findMany.mockResolvedValue([makePrismaEventWithRelations()])
      mockDb.event.count.mockResolvedValue(30)

      const result = await service.findPaginatedForItem('item-1', { page: 2, limit: 10 })

      expect(result.total).toBe(30)
      expect(result.pages).toBe(3)
      expect(result.hasMore).toBe(true)
    })
  })

  describe('findById', () => {
    it('returns null when not found', async () => {
      const { service, mockDb } = makeService()
      mockDb.event.findUnique.mockResolvedValue(null)

      const result = await service.findById('nonexistent')
      expect(result).toBeNull()
    })

    it('returns domain event with relations when found', async () => {
      const { service, mockDb } = makeService()
      mockDb.event.findUnique.mockResolvedValue(makePrismaEventWithRelations())

      const result = await service.findById('event-1')
      expect(result?.id).toBe('event-1')
      expect(result?.item?.id).toBe('item-1')
    })
  })

  describe('create', () => {
    it('sets createdById and updatedById', async () => {
      const { service, mockDb } = makeService()
      mockDb.event.create.mockResolvedValue(makePrismaEvent())

      await service.create('user-1', {
        itemId: 'item-1',
        type: 'maintenance',
        date: new Date('2024-03-15'),
      })

      const call = mockDb.event.create.mock.calls[0][0]
      expect(call.data.createdById).toBe('user-1')
      expect(call.data.updatedById).toBe('user-1')
    })

    it('passes optional fields as null when omitted', async () => {
      const { service, mockDb } = makeService()
      mockDb.event.create.mockResolvedValue(makePrismaEvent())

      await service.create('user-1', {
        itemId: 'item-1',
        type: 'installation',
        date: new Date('2024-03-15'),
      })

      const call = mockDb.event.create.mock.calls[0][0]
      expect(call.data.cost).toBeNull()
      expect(call.data.description).toBeNull()
      expect(call.data.performedBy).toBeNull()
    })
  })

  describe('update', () => {
    it('sets updatedById and applies partial updates', async () => {
      const { service, mockDb } = makeService()
      mockDb.event.update.mockResolvedValue(makePrismaEvent({ cost: 100 }))

      await service.update('event-1', 'user-1', { cost: 100 })

      const call = mockDb.event.update.mock.calls[0][0]
      expect(call.data.updatedById).toBe('user-1')
      expect(call.data.cost).toBe(100)
    })
  })

  describe('delete', () => {
    it('calls db delete with correct id', async () => {
      const { service, mockDb } = makeService()
      mockDb.event.delete.mockResolvedValue(undefined)

      await service.delete('event-1')

      expect(mockDb.event.delete).toHaveBeenCalledWith({ where: { id: 'event-1' } })
    })
  })
})
