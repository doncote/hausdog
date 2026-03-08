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

function makeService(dbOverrides: Record<string, unknown> = {}) {
  const mockDb = {
    property: {
      findMany: vi.fn(),
      findFirst: vi.fn(),
      findUnique: vi.fn(),
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

  describe('delete', () => {
    it('calls db delete with correct id', async () => {
      const { service, mockDb } = makeService()
      mockDb.property.delete.mockResolvedValue(undefined)

      await service.delete('prop-1', 'user-1')

      expect(mockDb.property.delete).toHaveBeenCalledWith({ where: { id: 'prop-1' } })
    })
  })
})
