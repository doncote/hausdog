import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PropertyServiceDeps } from './service'
import { PropertyService } from './service'

// Mock logger
const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

// Factory for a mock Prisma property record
function makePrismaProperty(overrides: Record<string, unknown> = {}) {
  return {
    id: 'prop-1',
    userId: 'user-1',
    name: 'My Home',
    streetAddress: '123 Main St',
    city: 'Springfield',
    state: 'CA',
    postalCode: '90210',
    country: 'US',
    county: null,
    neighborhood: null,
    latitude: 34.05,
    longitude: -118.24,
    timezone: 'America/Los_Angeles',
    plusCode: null,
    googlePlaceId: null,
    formattedAddress: '123 Main St, Springfield, CA 90210',
    googlePlaceData: null,
    yearBuilt: 1990,
    squareFeet: 2000,
    lotSquareFeet: 5000,
    bedrooms: 3,
    bathrooms: '2.5',
    stories: 2,
    propertyType: 'single_family',
    purchaseDate: null,
    purchasePrice: null,
    estimatedValue: '750000',
    lookupData: null,
    ingestToken: 'my-home-abc123',
    createdById: 'user-1',
    updatedById: 'user-1',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }
}

function makePrismaPropertyWithCounts(overrides: Record<string, unknown> = {}) {
  return {
    ...makePrismaProperty(overrides),
    _count: { items: 5, spaces: 2 },
  }
}

function makeService(dbOverrides: Record<string, unknown> = {}) {
  const mockDb = {
    property: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    ...dbOverrides,
  }
  const deps = {
    db: mockDb,
    logger: mockLogger,
  } as unknown as PropertyServiceDeps

  return { service: new PropertyService(deps), mockDb }
}

describe('PropertyService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('findAllForUser', () => {
    it('returns mapped domain properties', async () => {
      const { service, mockDb } = makeService()
      mockDb.property.findMany.mockResolvedValue([makePrismaProperty()])

      const result = await service.findAllForUser('user-1')

      expect(result).toHaveLength(1)
      expect(result[0]?.name).toBe('My Home')
      expect(result[0]?.bathrooms).toBe(2.5) // Decimal converted from string
      expect(result[0]?.estimatedValue).toBe(750000)
    })

    it('returns empty array when no properties', async () => {
      const { service, mockDb } = makeService()
      mockDb.property.findMany.mockResolvedValue([])

      const result = await service.findAllForUser('user-1')
      expect(result).toEqual([])
    })
  })

  describe('findById', () => {
    it('returns null when property not found', async () => {
      const { service, mockDb } = makeService()
      mockDb.property.findFirst.mockResolvedValue(null)

      const result = await service.findById('nonexistent', 'user-1')
      expect(result).toBeNull()
    })

    it('returns domain property when found', async () => {
      const { service, mockDb } = makeService()
      mockDb.property.findFirst.mockResolvedValue(makePrismaProperty())

      const result = await service.findById('prop-1', 'user-1')
      expect(result).not.toBeNull()
      expect(result?.id).toBe('prop-1')
      expect(result?.ingestToken).toBe('my-home-abc123')
    })

    it('queries with both id and userId in WHERE clause', async () => {
      const { service, mockDb } = makeService()
      mockDb.property.findFirst.mockResolvedValue(makePrismaProperty())

      await service.findById('prop-1', 'user-1')

      const whereArg = mockDb.property.findFirst.mock.calls[0][0].where
      expect(whereArg.id).toBe('prop-1')
      // accessibleWhere must include userId as an OR condition
      expect(whereArg.OR).toBeDefined()
      expect(whereArg.OR).toEqual(
        expect.arrayContaining([expect.objectContaining({ userId: 'user-1' })]),
      )
    })

    it('returns null when db returns null — simulates wrong-user access', async () => {
      const { service, mockDb } = makeService()
      // Prisma returns null when WHERE clause filters out the row (wrong userId)
      mockDb.property.findFirst.mockResolvedValue(null)

      const result = await service.findById('prop-1', 'user-2')
      expect(result).toBeNull()
    })

    it('does not return property owned by a different user', async () => {
      const { service, mockDb } = makeService()
      // Property exists for user-1; user-2 queries it
      // Correct behavior: db returns null because userId doesn't match
      mockDb.property.findFirst.mockResolvedValue(null)

      const result = await service.findById('prop-1', 'user-2')

      expect(result).toBeNull()
      // Verify the query was scoped to user-2, not user-1
      const whereArg = mockDb.property.findFirst.mock.calls[0][0].where
      expect(whereArg.OR).toEqual(
        expect.arrayContaining([expect.objectContaining({ userId: 'user-2' })]),
      )
    })
  })

  describe('create', () => {
    it('creates a property and returns domain object', async () => {
      const { service, mockDb } = makeService()
      mockDb.property.create.mockResolvedValue(makePrismaProperty())

      const result = await service.create('user-1', {
        name: 'My Home',
        formattedAddress: '123 Main St, Springfield, CA 90210',
      })

      expect(mockDb.property.create).toHaveBeenCalledOnce()
      expect(result.name).toBe('My Home')
    })

    it('generates an ingest token on creation', async () => {
      const { service, mockDb } = makeService()
      mockDb.property.create.mockResolvedValue(makePrismaProperty())

      await service.create('user-1', { name: 'My Home', formattedAddress: '123 Main St' })

      const createCall = mockDb.property.create.mock.calls[0][0]
      expect(createCall.data.ingestToken).toBeDefined()
      expect(typeof createCall.data.ingestToken).toBe('string')
    })
  })

  describe('findAllForUserWithCounts', () => {
    it('returns properties with item and space counts', async () => {
      const { service, mockDb } = makeService()
      mockDb.property.findMany.mockResolvedValue([makePrismaPropertyWithCounts()])

      const result = await service.findAllForUserWithCounts('user-1')

      expect(result).toHaveLength(1)
      expect(result[0]?._count).toEqual({ items: 5, spaces: 2 })
      expect(result[0]?.name).toBe('My Home')
    })

    it('returns empty array when no properties', async () => {
      const { service, mockDb } = makeService()
      mockDb.property.findMany.mockResolvedValue([])

      const result = await service.findAllForUserWithCounts('user-1')
      expect(result).toEqual([])
    })
  })

  describe('findPaginatedForUser', () => {
    it('returns paginated result with correct metadata', async () => {
      const { service, mockDb } = makeService()
      mockDb.property.findMany.mockResolvedValue([makePrismaPropertyWithCounts()])
      mockDb.property.count.mockResolvedValue(30)

      const result = await service.findPaginatedForUser('user-1', { page: 2, limit: 10 })

      expect(result.data).toHaveLength(1)
      expect(result.total).toBe(30)
      expect(result.page).toBe(2)
      expect(result.limit).toBe(10)
    })

    it('applies skip based on page and limit', async () => {
      const { service, mockDb } = makeService()
      mockDb.property.findMany.mockResolvedValue([])
      mockDb.property.count.mockResolvedValue(0)

      await service.findPaginatedForUser('user-1', { page: 3, limit: 5 })

      const call = mockDb.property.findMany.mock.calls[0][0]
      expect(call.skip).toBe(10)
      expect(call.take).toBe(5)
    })
  })

  describe('canWrite', () => {
    it('returns true when property record is found', async () => {
      const { service, mockDb } = makeService()
      mockDb.property.findFirst.mockResolvedValue({ id: 'prop-1' })

      const result = await service.canWrite('prop-1', 'user-1')

      expect(result).toBe(true)
    })

    it('returns false when no record found', async () => {
      const { service, mockDb } = makeService()
      mockDb.property.findFirst.mockResolvedValue(null)

      const result = await service.canWrite('prop-1', 'user-2')

      expect(result).toBe(false)
    })
  })

  describe('isOwner', () => {
    it('returns true when property belongs to user', async () => {
      const { service, mockDb } = makeService()
      mockDb.property.findFirst.mockResolvedValue({ id: 'prop-1' })

      const result = await service.isOwner('prop-1', 'user-1')

      expect(result).toBe(true)
    })

    it('returns false when user does not own property', async () => {
      const { service, mockDb } = makeService()
      mockDb.property.findFirst.mockResolvedValue(null)

      const result = await service.isOwner('prop-1', 'user-2')

      expect(result).toBe(false)
    })

    it('queries with both id and userId', async () => {
      const { service, mockDb } = makeService()
      mockDb.property.findFirst.mockResolvedValue(null)

      await service.isOwner('prop-1', 'user-1')

      expect(mockDb.property.findFirst).toHaveBeenCalledWith({
        where: { id: 'prop-1', userId: 'user-1' },
        select: { id: true },
      })
    })
  })

  describe('update', () => {
    it('updates and returns domain property when user can write', async () => {
      const { service, mockDb } = makeService()
      mockDb.property.findFirst.mockResolvedValue({ id: 'prop-1' }) // canWrite check
      mockDb.property.update.mockResolvedValue(makePrismaProperty({ name: 'Updated Home' }))

      const result = await service.update('prop-1', 'user-1', { name: 'Updated Home' })

      expect(mockDb.property.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'prop-1' } }),
      )
      expect(result.name).toBe('Updated Home')
    })

    it('throws Access denied when user cannot write', async () => {
      const { service, mockDb } = makeService()
      mockDb.property.findFirst.mockResolvedValue(null) // canWrite returns false

      await expect(service.update('prop-1', 'user-2', { name: 'Hacked' })).rejects.toThrow(
        'Access denied',
      )
      expect(mockDb.property.update).not.toHaveBeenCalled()
    })
  })

  describe('findByIngestToken', () => {
    it('returns null when token not found', async () => {
      const { service, mockDb } = makeService()
      mockDb.property.findUnique.mockResolvedValue(null)

      const result = await service.findByIngestToken('unknown-token')

      expect(result).toBeNull()
      expect(mockDb.property.findUnique).toHaveBeenCalledWith({
        where: { ingestToken: 'unknown-token' },
      })
    })

    it('returns domain property when token matches', async () => {
      const { service, mockDb } = makeService()
      mockDb.property.findUnique.mockResolvedValue(makePrismaProperty())

      const result = await service.findByIngestToken('my-home-abc123')

      expect(result).not.toBeNull()
      expect(result?.ingestToken).toBe('my-home-abc123')
    })
  })

  describe('delete', () => {
    it('calls db delete when user is owner', async () => {
      const { service, mockDb } = makeService()
      mockDb.property.findFirst.mockResolvedValue({ id: 'prop-1' }) // isOwner check
      mockDb.property.delete.mockResolvedValue(undefined)

      await service.delete('prop-1', 'user-1')

      expect(mockDb.property.delete).toHaveBeenCalledWith({ where: { id: 'prop-1' } })
    })

    it('throws when user is not the owner', async () => {
      const { service, mockDb } = makeService()
      mockDb.property.findFirst.mockResolvedValue(null) // isOwner returns false

      await expect(service.delete('prop-1', 'user-2')).rejects.toThrow('Access denied')
      expect(mockDb.property.delete).not.toHaveBeenCalled()
    })
  })
})
