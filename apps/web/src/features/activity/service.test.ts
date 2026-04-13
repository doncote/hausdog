import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ActivityService } from './service'
import type { RecordActivityInput } from './types'

function makePrismaActivity(overrides: Record<string, unknown> = {}) {
  return {
    id: 'act-1',
    propertyId: 'prop-1',
    userId: 'user-1',
    action: 'created',
    entityType: 'item',
    entityId: 'item-1',
    entityName: 'My Item',
    metadata: null,
    createdAt: new Date('2024-01-01'),
    ...overrides,
  }
}

function makeService(dbOverrides: Record<string, unknown> = {}) {
  const mockDb = {
    propertyActivity: {
      create: vi.fn(),
      findMany: vi.fn(),
    },
    ...dbOverrides,
  }

  return { service: new ActivityService(mockDb as never), mockDb }
}

describe('ActivityService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('record', () => {
    it('creates an activity record with all required fields', async () => {
      const { service, mockDb } = makeService()
      mockDb.propertyActivity.create.mockResolvedValue(makePrismaActivity())

      const input: RecordActivityInput = {
        propertyId: 'prop-1',
        userId: 'user-1',
        action: 'created',
        entityType: 'item',
        entityId: 'item-1',
        entityName: 'My Item',
      }

      await service.record(input)

      expect(mockDb.propertyActivity.create).toHaveBeenCalledOnce()
      const createCall = mockDb.propertyActivity.create.mock.calls[0][0]
      expect(createCall.data.propertyId).toBe('prop-1')
      expect(createCall.data.userId).toBe('user-1')
      expect(createCall.data.action).toBe('created')
      expect(createCall.data.entityType).toBe('item')
      expect(createCall.data.entityId).toBe('item-1')
      expect(createCall.data.entityName).toBe('My Item')
    })

    it('sets entityName to null when not provided', async () => {
      const { service, mockDb } = makeService()
      mockDb.propertyActivity.create.mockResolvedValue(makePrismaActivity({ entityName: null }))

      await service.record({
        propertyId: 'prop-1',
        userId: 'user-1',
        action: 'deleted',
        entityType: 'document',
        entityId: 'doc-1',
      })

      const createCall = mockDb.propertyActivity.create.mock.calls[0][0]
      expect(createCall.data.entityName).toBeNull()
    })

    it('passes metadata when provided', async () => {
      const { service, mockDb } = makeService()
      mockDb.propertyActivity.create.mockResolvedValue(makePrismaActivity())

      const metadata = { key: 'value', count: 3 }
      await service.record({
        propertyId: 'prop-1',
        userId: 'user-1',
        action: 'updated',
        entityType: 'item',
        entityId: 'item-1',
        metadata,
      })

      const createCall = mockDb.propertyActivity.create.mock.calls[0][0]
      expect(createCall.data.metadata).toEqual(metadata)
    })
  })

  describe('findRecent', () => {
    it('returns mapped activity events', async () => {
      const { service, mockDb } = makeService()
      mockDb.propertyActivity.findMany.mockResolvedValue([
        makePrismaActivity(),
        makePrismaActivity({ id: 'act-2', action: 'deleted', entityType: 'document' }),
      ])

      const result = await service.findRecent('prop-1')

      expect(result).toHaveLength(2)
      expect(result[0]?.id).toBe('act-1')
      expect(result[0]?.action).toBe('created')
      expect(result[0]?.entityType).toBe('item')
      expect(result[1]?.id).toBe('act-2')
      expect(result[1]?.action).toBe('deleted')
    })

    it('queries by propertyId ordered by desc createdAt', async () => {
      const { service, mockDb } = makeService()
      mockDb.propertyActivity.findMany.mockResolvedValue([])

      await service.findRecent('prop-1')

      expect(mockDb.propertyActivity.findMany).toHaveBeenCalledWith({
        where: { propertyId: 'prop-1' },
        orderBy: { createdAt: 'desc' },
        take: 50,
      })
    })

    it('uses custom limit when provided', async () => {
      const { service, mockDb } = makeService()
      mockDb.propertyActivity.findMany.mockResolvedValue([])

      await service.findRecent('prop-1', 10)

      const findCall = mockDb.propertyActivity.findMany.mock.calls[0][0]
      expect(findCall.take).toBe(10)
    })

    it('returns empty array when no activity', async () => {
      const { service, mockDb } = makeService()
      mockDb.propertyActivity.findMany.mockResolvedValue([])

      const result = await service.findRecent('prop-1')
      expect(result).toEqual([])
    })

    it('maps metadata correctly including null', async () => {
      const { service, mockDb } = makeService()
      const metadata = { reason: 'test' }
      mockDb.propertyActivity.findMany.mockResolvedValue([
        makePrismaActivity({ metadata }),
        makePrismaActivity({ id: 'act-2', metadata: null }),
      ])

      const result = await service.findRecent('prop-1')

      expect(result[0]?.metadata).toEqual(metadata)
      expect(result[1]?.metadata).toBeNull()
    })
  })
})
