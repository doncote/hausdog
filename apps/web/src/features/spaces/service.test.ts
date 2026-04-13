import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { SpaceServiceDeps } from './service'
import { SpaceService } from './service'

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

function makePrismaSpace(overrides: Record<string, unknown> = {}) {
  return {
    id: 'space-1',
    propertyId: 'prop-1',
    name: 'Kitchen',
    createdById: 'user-1',
    updatedById: 'user-1',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }
}

function makePrismaSpaceWithCounts(overrides: Record<string, unknown> = {}) {
  return {
    ...makePrismaSpace(overrides),
    _count: { items: 5 },
  }
}

function makeService(dbOverrides: Record<string, unknown> = {}) {
  const mockDb = {
    space: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    ...dbOverrides,
  }
  const deps = { db: mockDb, logger: mockLogger } as unknown as SpaceServiceDeps

  return { service: new SpaceService(deps), mockDb }
}

describe('SpaceService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('findAllForProperty', () => {
    it('returns spaces with item counts', async () => {
      const { service, mockDb } = makeService()
      mockDb.space.findMany.mockResolvedValue([makePrismaSpaceWithCounts()])

      const result = await service.findAllForProperty('prop-1')

      expect(result).toHaveLength(1)
      expect(result[0]?.name).toBe('Kitchen')
      expect(result[0]?._count?.items).toBe(5)
    })

    it('orders by name asc', async () => {
      const { service, mockDb } = makeService()
      mockDb.space.findMany.mockResolvedValue([])

      await service.findAllForProperty('prop-1')

      const call = mockDb.space.findMany.mock.calls[0][0]
      expect(call.orderBy).toEqual({ name: 'asc' })
    })
  })

  describe('findPaginatedForProperty', () => {
    it('returns paginated result with correct metadata', async () => {
      const { service, mockDb } = makeService()
      mockDb.space.findMany.mockResolvedValue([makePrismaSpaceWithCounts()])
      mockDb.space.count.mockResolvedValue(15)

      const result = await service.findPaginatedForProperty('prop-1', { page: 1, limit: 10 })

      expect(result.total).toBe(15)
      expect(result.pages).toBe(2)
      expect(result.hasMore).toBe(true)
    })

    it('applies correct skip for page 2', async () => {
      const { service, mockDb } = makeService()
      mockDb.space.findMany.mockResolvedValue([])
      mockDb.space.count.mockResolvedValue(0)

      await service.findPaginatedForProperty('prop-1', { page: 2, limit: 5 })

      const call = mockDb.space.findMany.mock.calls[0][0]
      expect(call.skip).toBe(5)
      expect(call.take).toBe(5)
    })
  })

  describe('findById', () => {
    it('returns null when not found', async () => {
      const { service, mockDb } = makeService()
      mockDb.space.findUnique.mockResolvedValue(null)

      const result = await service.findById('nonexistent')
      expect(result).toBeNull()
    })

    it('returns domain space when found', async () => {
      const { service, mockDb } = makeService()
      mockDb.space.findUnique.mockResolvedValue(makePrismaSpace())

      const result = await service.findById('space-1')
      expect(result?.id).toBe('space-1')
      expect(result?.name).toBe('Kitchen')
    })
  })

  describe('create', () => {
    it('sets createdById and updatedById', async () => {
      const { service, mockDb } = makeService()
      mockDb.space.create.mockResolvedValue(makePrismaSpace())

      await service.create('user-1', { propertyId: 'prop-1', name: 'Kitchen' })

      const call = mockDb.space.create.mock.calls[0][0]
      expect(call.data.createdById).toBe('user-1')
      expect(call.data.updatedById).toBe('user-1')
    })
  })

  describe('update', () => {
    it('updates name and sets updatedById', async () => {
      const { service, mockDb } = makeService()
      mockDb.space.update.mockResolvedValue(makePrismaSpace({ name: 'Living Room' }))

      await service.update('space-1', 'user-1', { name: 'Living Room' })

      const call = mockDb.space.update.mock.calls[0][0]
      expect(call.data.name).toBe('Living Room')
      expect(call.data.updatedById).toBe('user-1')
    })
  })

  describe('delete', () => {
    it('calls db delete with correct id', async () => {
      const { service, mockDb } = makeService()
      mockDb.space.delete.mockResolvedValue(undefined)

      await service.delete('space-1')

      expect(mockDb.space.delete).toHaveBeenCalledWith({ where: { id: 'space-1' } })
    })
  })
})
