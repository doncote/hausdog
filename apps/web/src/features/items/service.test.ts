import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ItemServiceDeps } from './service'
import { ItemService } from './service'

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

function makePrismaItem(overrides: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    propertyId: 'prop-1',
    spaceId: null,
    parentId: null,
    name: 'HVAC System',
    description: 'Main HVAC unit',
    category: 'hvac',
    manufacturer: 'Carrier',
    model: 'Central Air 5000',
    serialNumber: 'SN123456',
    acquiredDate: null,
    warrantyExpires: null,
    purchasePrice: '3500',
    notes: null,
    createdById: 'user-1',
    updatedById: 'user-1',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }
}

function makePrismaItemWithRelations(overrides: Record<string, unknown> = {}) {
  return {
    ...makePrismaItem(overrides),
    space: null,
    parent: null,
    _count: { events: 0, documents: 0, children: 0 },
  }
}

function makeService() {
  const mockDb = {
    item: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
  }
  const deps = {
    db: mockDb,
    logger: mockLogger,
  } as unknown as ItemServiceDeps

  return { service: new ItemService(deps), mockDb }
}

describe('ItemService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('findAllForProperty', () => {
    it('returns mapped domain items with relations', async () => {
      const { service, mockDb } = makeService()
      const prismaItem = {
        ...makePrismaItem(),
        space: { id: 'space-1', name: 'Kitchen' },
        parent: null,
        _count: { events: 2, documents: 1, children: 0 },
      }
      mockDb.item.findMany.mockResolvedValue([prismaItem])

      const result = await service.findAllForProperty('prop-1')

      expect(result).toHaveLength(1)
      expect(result[0]?.name).toBe('HVAC System')
      expect(result[0]?.space?.name).toBe('Kitchen')
      expect(result[0]?.purchasePrice).toBe(3500)
    })

    it('returns empty array when no items', async () => {
      const { service, mockDb } = makeService()
      mockDb.item.findMany.mockResolvedValue([])

      const result = await service.findAllForProperty('prop-1')
      expect(result).toEqual([])
    })
  })

  describe('findById', () => {
    it('returns null when not found', async () => {
      const { service, mockDb } = makeService()
      mockDb.item.findUnique.mockResolvedValue(null)

      const result = await service.findById('nonexistent')
      expect(result).toBeNull()
    })

    it('returns domain item with relations', async () => {
      const { service, mockDb } = makeService()
      mockDb.item.findUnique.mockResolvedValue({
        ...makePrismaItem(),
        space: null,
        parent: null,
        children: [],
        _count: { events: 0, documents: 0, children: 0 },
      })

      const result = await service.findById('item-1')
      expect(result?.id).toBe('item-1')
      expect(result?.manufacturer).toBe('Carrier')
    })
  })

  describe('create', () => {
    it('creates item with correct data', async () => {
      const { service, mockDb } = makeService()
      mockDb.item.create.mockResolvedValue(makePrismaItem())

      const result = await service.create('user-1', {
        propertyId: 'prop-1',
        name: 'HVAC System',
        category: 'hvac',
      })

      expect(mockDb.item.create).toHaveBeenCalledOnce()
      expect(result.name).toBe('HVAC System')
      expect(result.purchasePrice).toBe(3500)
    })
  })

  describe('findRootItemsForProperty', () => {
    it('queries with parentId: null filter', async () => {
      const { service, mockDb } = makeService()
      mockDb.item.findMany.mockResolvedValue([])

      await service.findRootItemsForProperty('prop-1')

      expect(mockDb.item.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { propertyId: 'prop-1', parentId: null } }),
      )
    })

    it('returns mapped items', async () => {
      const { service, mockDb } = makeService()
      mockDb.item.findMany.mockResolvedValue([makePrismaItemWithRelations()])

      const result = await service.findRootItemsForProperty('prop-1')

      expect(result).toHaveLength(1)
      expect(result[0]?.id).toBe('item-1')
    })
  })

  describe('findAllForSpace', () => {
    it('queries by spaceId', async () => {
      const { service, mockDb } = makeService()
      mockDb.item.findMany.mockResolvedValue([])

      await service.findAllForSpace('space-1')

      expect(mockDb.item.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { spaceId: 'space-1' } }),
      )
    })

    it('returns mapped items', async () => {
      const { service, mockDb } = makeService()
      mockDb.item.findMany.mockResolvedValue([makePrismaItemWithRelations({ spaceId: 'space-1' })])

      const result = await service.findAllForSpace('space-1')

      expect(result).toHaveLength(1)
    })
  })

  describe('findChildrenForItem', () => {
    it('queries by parentId', async () => {
      const { service, mockDb } = makeService()
      mockDb.item.findMany.mockResolvedValue([])

      await service.findChildrenForItem('item-1')

      expect(mockDb.item.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { parentId: 'item-1' } }),
      )
    })

    it('returns children sorted by name', async () => {
      const { service, mockDb } = makeService()
      mockDb.item.findMany.mockResolvedValue([makePrismaItemWithRelations()])

      await service.findChildrenForItem('item-parent')

      const call = mockDb.item.findMany.mock.calls[0][0]
      expect(call.orderBy).toEqual({ name: 'asc' })
    })
  })

  describe('findPaginatedForProperty', () => {
    it('returns paginated result with correct metadata', async () => {
      const { service, mockDb } = makeService()
      mockDb.item.findMany.mockResolvedValue([makePrismaItemWithRelations()])
      mockDb.item.count.mockResolvedValue(25)

      const result = await service.findPaginatedForProperty('prop-1', { page: 2, limit: 10 })

      expect(result.data).toHaveLength(1)
      expect(result.total).toBe(25)
      expect(result.page).toBe(2)
      expect(result.limit).toBe(10)
    })

    it('applies skip based on page and limit', async () => {
      const { service, mockDb } = makeService()
      mockDb.item.findMany.mockResolvedValue([])
      mockDb.item.count.mockResolvedValue(0)

      await service.findPaginatedForProperty('prop-1', { page: 3, limit: 5 })

      const call = mockDb.item.findMany.mock.calls[0][0]
      expect(call.skip).toBe(10)
      expect(call.take).toBe(5)
    })
  })

  describe('findPaginatedForSpace', () => {
    it('returns paginated result filtered by spaceId', async () => {
      const { service, mockDb } = makeService()
      mockDb.item.findMany.mockResolvedValue([makePrismaItemWithRelations()])
      mockDb.item.count.mockResolvedValue(3)

      const result = await service.findPaginatedForSpace('space-1', { page: 1, limit: 10 })

      expect(result.data).toHaveLength(1)
      expect(result.total).toBe(3)
    })

    it('scopes query to spaceId', async () => {
      const { service, mockDb } = makeService()
      mockDb.item.findMany.mockResolvedValue([])
      mockDb.item.count.mockResolvedValue(0)

      await service.findPaginatedForSpace('space-2', { page: 1, limit: 10 })

      const call = mockDb.item.findMany.mock.calls[0][0]
      expect(call.where).toEqual({ spaceId: 'space-2' })
    })
  })

  describe('update', () => {
    it('updates item with provided fields', async () => {
      const { service, mockDb } = makeService()
      mockDb.item.update.mockResolvedValue(makePrismaItem({ name: 'Updated HVAC' }))

      const result = await service.update('item-1', 'user-1', { name: 'Updated HVAC' })

      expect(mockDb.item.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'item-1' } }),
      )
      expect(result.name).toBe('Updated HVAC')
    })

    it('sets updatedById to userId', async () => {
      const { service, mockDb } = makeService()
      mockDb.item.update.mockResolvedValue(makePrismaItem())

      await service.update('item-1', 'user-42', { name: 'Test' })

      const call = mockDb.item.update.mock.calls[0][0]
      expect(call.data.updatedById).toBe('user-42')
    })
  })

  describe('delete', () => {
    it('calls db delete with correct id', async () => {
      const { service, mockDb } = makeService()
      mockDb.item.delete.mockResolvedValue(undefined)

      await service.delete('item-1')

      expect(mockDb.item.delete).toHaveBeenCalledWith({ where: { id: 'item-1' } })
    })
  })
})
