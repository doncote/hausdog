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

function makeService() {
  const mockDb = {
    item: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
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

  describe('delete', () => {
    it('calls db delete with correct id', async () => {
      const { service, mockDb } = makeService()
      mockDb.item.delete.mockResolvedValue(undefined)

      await service.delete('item-1')

      expect(mockDb.item.delete).toHaveBeenCalledWith({ where: { id: 'item-1' } })
    })
  })
})
