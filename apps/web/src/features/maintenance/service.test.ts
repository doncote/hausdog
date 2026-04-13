import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { MaintenanceServiceDeps } from './service'
import { MaintenanceService } from './service'

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

function makePrismaTask(overrides: Record<string, unknown> = {}) {
  return {
    id: 'task-1',
    propertyId: 'prop-1',
    itemId: 'item-1',
    name: 'Change HVAC Filter',
    description: 'Replace air filter',
    intervalMonths: 3,
    nextDueDate: new Date('2024-04-01'),
    lastCompletedAt: null,
    source: 'user_created',
    status: 'active',
    createdById: 'user-1',
    updatedById: 'user-1',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }
}

function makePrismaTaskWithRelations(overrides: Record<string, unknown> = {}) {
  return {
    ...makePrismaTask(overrides),
    property: { id: 'prop-1', name: 'My Home' },
    item: { id: 'item-1', name: 'HVAC System' },
  }
}

function makeService(dbOverrides: Record<string, unknown> = {}) {
  const mockDb = {
    maintenanceTask: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findUniqueOrThrow: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    event: {
      create: vi.fn(),
    },
    ...dbOverrides,
  }
  const deps = { db: mockDb, logger: mockLogger } as unknown as MaintenanceServiceDeps

  return { service: new MaintenanceService(deps), mockDb }
}

describe('MaintenanceService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('findAllForProperty', () => {
    it('excludes dismissed tasks', async () => {
      const { service, mockDb } = makeService()
      mockDb.maintenanceTask.findMany.mockResolvedValue([makePrismaTaskWithRelations()])

      await service.findAllForProperty('prop-1')

      const call = mockDb.maintenanceTask.findMany.mock.calls[0][0]
      expect(call.where.status).toEqual({ not: 'dismissed' })
    })

    it('returns tasks ordered by nextDueDate asc', async () => {
      const { service, mockDb } = makeService()
      mockDb.maintenanceTask.findMany.mockResolvedValue([])

      await service.findAllForProperty('prop-1')

      const call = mockDb.maintenanceTask.findMany.mock.calls[0][0]
      expect(call.orderBy).toEqual({ nextDueDate: 'asc' })
    })

    it('maps domain fields correctly', async () => {
      const { service, mockDb } = makeService()
      mockDb.maintenanceTask.findMany.mockResolvedValue([makePrismaTaskWithRelations()])

      const result = await service.findAllForProperty('prop-1')

      expect(result[0]?.name).toBe('Change HVAC Filter')
      expect(result[0]?.intervalMonths).toBe(3)
      expect(result[0]?.property?.name).toBe('My Home')
    })
  })

  describe('findUpcoming', () => {
    it('queries only active tasks for given propertyIds', async () => {
      const { service, mockDb } = makeService()
      mockDb.maintenanceTask.findMany.mockResolvedValue([])

      await service.findUpcoming(['prop-1', 'prop-2'])

      const call = mockDb.maintenanceTask.findMany.mock.calls[0][0]
      expect(call.where.propertyId).toEqual({ in: ['prop-1', 'prop-2'] })
      expect(call.where.status).toBe('active')
    })

    it('uses default limit of 20', async () => {
      const { service, mockDb } = makeService()
      mockDb.maintenanceTask.findMany.mockResolvedValue([])

      await service.findUpcoming(['prop-1'])

      const call = mockDb.maintenanceTask.findMany.mock.calls[0][0]
      expect(call.take).toBe(20)
    })

    it('uses custom limit when provided', async () => {
      const { service, mockDb } = makeService()
      mockDb.maintenanceTask.findMany.mockResolvedValue([])

      await service.findUpcoming(['prop-1'], { limit: 5 })

      const call = mockDb.maintenanceTask.findMany.mock.calls[0][0]
      expect(call.take).toBe(5)
    })
  })

  describe('create', () => {
    it('creates task with status active and source user_created', async () => {
      const { service, mockDb } = makeService()
      mockDb.maintenanceTask.create.mockResolvedValue(makePrismaTask())

      await service.create('user-1', {
        propertyId: 'prop-1',
        name: 'Change HVAC Filter',
        intervalMonths: 3,
        nextDueDate: new Date('2024-04-01'),
      })

      const call = mockDb.maintenanceTask.create.mock.calls[0][0]
      expect(call.data.status).toBe('active')
      expect(call.data.source).toBe('user_created')
      expect(call.data.createdById).toBe('user-1')
    })
  })

  describe('complete', () => {
    it('calculates nextDueDate from completion date + intervalMonths', async () => {
      const { service, mockDb } = makeService()
      const task = makePrismaTask({ intervalMonths: 3 })
      mockDb.maintenanceTask.findUniqueOrThrow.mockResolvedValue(task)
      mockDb.maintenanceTask.update.mockResolvedValue(task)
      mockDb.event.create.mockResolvedValue({})

      const completionDate = new Date('2024-01-15')
      await service.complete('task-1', 'user-1', { date: completionDate })

      const updateCall = mockDb.maintenanceTask.update.mock.calls[0][0]
      const expectedNext = new Date('2024-01-15')
      expectedNext.setMonth(expectedNext.getMonth() + 3)
      expect(updateCall.data.nextDueDate.getMonth()).toBe(expectedNext.getMonth())
    })

    it('creates an event record when task has an itemId', async () => {
      const { service, mockDb } = makeService()
      const task = makePrismaTask({ itemId: 'item-1' })
      mockDb.maintenanceTask.findUniqueOrThrow.mockResolvedValue(task)
      mockDb.maintenanceTask.update.mockResolvedValue(task)
      mockDb.event.create.mockResolvedValue({})

      await service.complete('task-1', 'user-1', {
        date: new Date('2024-01-15'),
        cost: 50,
      })

      expect(mockDb.event.create).toHaveBeenCalledOnce()
      const eventCall = mockDb.event.create.mock.calls[0][0]
      expect(eventCall.data.itemId).toBe('item-1')
      expect(eventCall.data.type).toBe('maintenance')
      expect(eventCall.data.cost).toBe(50)
    })

    it('does not create event when task has no itemId', async () => {
      const { service, mockDb } = makeService()
      const task = makePrismaTask({ itemId: null })
      mockDb.maintenanceTask.findUniqueOrThrow.mockResolvedValue(task)
      mockDb.maintenanceTask.update.mockResolvedValue(task)

      await service.complete('task-1', 'user-1', { date: new Date('2024-01-15') })

      expect(mockDb.event.create).not.toHaveBeenCalled()
    })
  })

  describe('createFromAI', () => {
    it('skips suggestions that already exist', async () => {
      const { service, mockDb } = makeService()
      mockDb.maintenanceTask.findMany.mockResolvedValue([
        { name: 'Change HVAC Filter' },
      ])
      mockDb.maintenanceTask.create.mockResolvedValue(makePrismaTask())

      const result = await service.createFromAI('user-1', 'prop-1', null, [
        { name: 'Change HVAC Filter', intervalMonths: 3 },
        { name: 'Clean Gutters', intervalMonths: 6 },
      ])

      // Only "Clean Gutters" should be created
      expect(mockDb.maintenanceTask.create).toHaveBeenCalledOnce()
      expect(result).toHaveLength(1)
    })

    it('uses lastEventDate for nextDueDate when provided', async () => {
      const { service, mockDb } = makeService()
      mockDb.maintenanceTask.findMany.mockResolvedValue([])
      mockDb.maintenanceTask.create.mockResolvedValue(makePrismaTask())

      const lastDone = new Date('2024-01-01')
      await service.createFromAI(
        'user-1',
        'prop-1',
        null,
        [{ name: 'Change HVAC Filter', intervalMonths: 3 }],
        { 'Change HVAC Filter': lastDone },
      )

      const createCall = mockDb.maintenanceTask.create.mock.calls[0][0]
      const expectedNext = new Date(lastDone.getTime() + 3 * 30 * 24 * 60 * 60 * 1000)
      expect(createCall.data.nextDueDate.getTime()).toBeCloseTo(expectedNext.getTime(), -3)
    })
  })

  describe('snooze', () => {
    it('advances nextDueDate by intervalMonths', async () => {
      const { service, mockDb } = makeService()
      const task = makePrismaTask({
        intervalMonths: 6,
        nextDueDate: new Date('2024-03-01'),
      })
      mockDb.maintenanceTask.findUniqueOrThrow.mockResolvedValue(task)
      mockDb.maintenanceTask.update.mockResolvedValue(task)

      await service.snooze('task-1', 'user-1')

      const updateCall = mockDb.maintenanceTask.update.mock.calls[0][0]
      const expectedDate = new Date('2024-03-01')
      expectedDate.setMonth(expectedDate.getMonth() + 6)
      expect(updateCall.data.nextDueDate.getMonth()).toBe(expectedDate.getMonth())
    })
  })

  describe('delete', () => {
    it('calls db delete with correct id', async () => {
      const { service, mockDb } = makeService()
      mockDb.maintenanceTask.delete.mockResolvedValue(undefined)

      await service.delete('task-1')

      expect(mockDb.maintenanceTask.delete).toHaveBeenCalledWith({ where: { id: 'task-1' } })
    })
  })
})
