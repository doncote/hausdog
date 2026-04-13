import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CategoryServiceDeps } from './service'
import { CategoryService } from './service'

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

function makePrismaCategory(overrides: Record<string, unknown> = {}) {
  return {
    id: 'cat-1',
    slug: 'appliances',
    name: 'Appliances',
    icon: 'refrigerator',
    isSystem: false,
    userId: 'user-1',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }
}

function makeService(dbOverrides: Record<string, unknown> = {}) {
  const mockDb = {
    category: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    item: {
      count: vi.fn(),
    },
    ...dbOverrides,
  }
  const deps = { db: mockDb, logger: mockLogger } as unknown as CategoryServiceDeps

  return { service: new CategoryService(deps), mockDb }
}

describe('CategoryService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('findAllForUser', () => {
    it('returns system and user categories', async () => {
      const { service, mockDb } = makeService()
      mockDb.category.findMany.mockResolvedValue([
        makePrismaCategory({ isSystem: true, userId: null }),
        makePrismaCategory({ id: 'cat-2', slug: 'hvac', name: 'HVAC' }),
      ])

      const result = await service.findAllForUser('user-1')

      expect(result).toHaveLength(2)
      expect(result[0]?.isSystem).toBe(true)
    })

    it('queries with system and user OR clause', async () => {
      const { service, mockDb } = makeService()
      mockDb.category.findMany.mockResolvedValue([])

      await service.findAllForUser('user-1')

      expect(mockDb.category.findMany).toHaveBeenCalledWith({
        where: { OR: [{ isSystem: true }, { userId: 'user-1' }] },
        orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
      })
    })
  })

  describe('findById', () => {
    it('returns null when not found', async () => {
      const { service, mockDb } = makeService()
      mockDb.category.findUnique.mockResolvedValue(null)

      const result = await service.findById('nonexistent')
      expect(result).toBeNull()
    })

    it('returns mapped category when found', async () => {
      const { service, mockDb } = makeService()
      mockDb.category.findUnique.mockResolvedValue(makePrismaCategory())

      const result = await service.findById('cat-1')
      expect(result?.id).toBe('cat-1')
      expect(result?.slug).toBe('appliances')
      expect(result?.name).toBe('Appliances')
    })
  })

  describe('create', () => {
    it('creates a category with isSystem=false and userId', async () => {
      const { service, mockDb } = makeService()
      mockDb.category.create.mockResolvedValue(makePrismaCategory())

      await service.create('user-1', { slug: 'appliances', name: 'Appliances', icon: 'refrigerator' })

      const createCall = mockDb.category.create.mock.calls[0][0]
      expect(createCall.data.isSystem).toBe(false)
      expect(createCall.data.userId).toBe('user-1')
      expect(createCall.data.slug).toBe('appliances')
    })

    it('sets icon to null when not provided', async () => {
      const { service, mockDb } = makeService()
      mockDb.category.create.mockResolvedValue(makePrismaCategory({ icon: null }))

      await service.create('user-1', { slug: 'tools', name: 'Tools' })

      const createCall = mockDb.category.create.mock.calls[0][0]
      expect(createCall.data.icon).toBeNull()
    })
  })

  describe('update', () => {
    it('only patches provided fields', async () => {
      const { service, mockDb } = makeService()
      mockDb.category.update.mockResolvedValue(makePrismaCategory({ name: 'Big Appliances' }))

      await service.update('cat-1', { name: 'Big Appliances' })

      const updateCall = mockDb.category.update.mock.calls[0][0]
      expect(updateCall.data.name).toBe('Big Appliances')
      expect(updateCall.data.icon).toBeUndefined()
    })
  })

  describe('delete', () => {
    it('calls db delete with correct id', async () => {
      const { service, mockDb } = makeService()
      mockDb.category.delete.mockResolvedValue(undefined)

      await service.delete('cat-1')

      expect(mockDb.category.delete).toHaveBeenCalledWith({ where: { id: 'cat-1' } })
    })
  })

  describe('isSlugTaken', () => {
    it('returns true when slug exists', async () => {
      const { service, mockDb } = makeService()
      mockDb.category.count.mockResolvedValue(1)

      const result = await service.isSlugTaken('appliances', 'user-1')
      expect(result).toBe(true)
    })

    it('returns false when slug is available', async () => {
      const { service, mockDb } = makeService()
      mockDb.category.count.mockResolvedValue(0)

      const result = await service.isSlugTaken('new-slug', 'user-1')
      expect(result).toBe(false)
    })
  })

  describe('isCategoryInUse', () => {
    it('returns true when items reference this category', async () => {
      const { service, mockDb } = makeService()
      mockDb.item.count.mockResolvedValue(3)

      const result = await service.isCategoryInUse('appliances')
      expect(result).toBe(true)
    })

    it('returns false when no items use this category', async () => {
      const { service, mockDb } = makeService()
      mockDb.item.count.mockResolvedValue(0)

      const result = await service.isCategoryInUse('appliances')
      expect(result).toBe(false)
    })
  })
})
