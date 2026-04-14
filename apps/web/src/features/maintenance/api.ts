import { createServerFn } from '@tanstack/react-start'
import { ActivityService } from '@/features/activity/service'
import { PropertyService } from '@/features/properties/service'
import { consoleLogger as logger } from '@/lib/console-logger'
import { prisma } from '@/lib/db/client'
import { MaintenanceService } from './service'
import type {
  CompleteMaintenanceTaskInput,
  CreateMaintenanceTaskInput,
  UpdateMaintenanceTaskInput,
} from './types'

const getMaintenanceService = () => new MaintenanceService({ db: prisma, logger })
const getActivityService = () => new ActivityService(prisma)
const getPropertyService = () => new PropertyService({ db: prisma, logger })

export const fetchMaintenanceTasksForProperty = createServerFn({ method: 'GET' })
  .inputValidator((d: { propertyId: string }) => d)
  .handler(async ({ data }) => {
    const service = getMaintenanceService()
    return service.findAllForProperty(data.propertyId)
  })

export const fetchMaintenanceTasksForItem = createServerFn({ method: 'GET' })
  .inputValidator((d: { itemId: string }) => d)
  .handler(async ({ data }) => {
    const service = getMaintenanceService()
    return service.findAllForItem(data.itemId)
  })

export const fetchUpcomingMaintenanceTasks = createServerFn({ method: 'GET' })
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data }) => {
    const properties = await prisma.property.findMany({
      where: { userId: data.userId },
      select: { id: true },
    })
    const propertyIds = properties.map((p) => p.id)

    if (propertyIds.length === 0) {
      return []
    }

    const service = getMaintenanceService()
    return service.findUpcoming(propertyIds)
  })

export const fetchMaintenanceTask = createServerFn({ method: 'GET' })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const service = getMaintenanceService()
    return service.findById(data.id)
  })

export const createMaintenanceTask = createServerFn({ method: 'POST' })
  .inputValidator((d: { userId: string; input: CreateMaintenanceTaskInput }) => d)
  .handler(async ({ data }) => {
    const property = await getPropertyService().findById(data.input.propertyId, data.userId)
    if (!property) throw new Error('Property not found or access denied')
    const service = getMaintenanceService()
    const task = await service.create(data.userId, data.input)

    getActivityService()
      .record({
        propertyId: task.propertyId,
        userId: data.userId,
        action: 'created',
        entityType: 'maintenance_task',
        entityId: task.id,
        entityName: task.name,
      })
      .catch(() => {})

    return task
  })

export const updateMaintenanceTask = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string; userId: string; input: UpdateMaintenanceTaskInput }) => d)
  .handler(async ({ data }) => {
    const service = getMaintenanceService()
    const existing = await service.findById(data.id)
    if (!existing) throw new Error('Maintenance task not found')
    const property = await getPropertyService().findById(existing.propertyId, data.userId)
    if (!property) throw new Error('Property not found or access denied')
    return service.update(data.id, data.userId, data.input)
  })

export const completeMaintenanceTask = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string; userId: string; input: CompleteMaintenanceTaskInput }) => d)
  .handler(async ({ data }) => {
    const service = getMaintenanceService()
    const task = await service.complete(data.id, data.userId, data.input)

    getActivityService()
      .record({
        propertyId: task.propertyId,
        userId: data.userId,
        action: 'completed',
        entityType: 'maintenance_task',
        entityId: task.id,
        entityName: task.name,
      })
      .catch(() => {})

    return task
  })

export const snoozeMaintenanceTask = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string; userId: string }) => d)
  .handler(async ({ data }) => {
    const service = getMaintenanceService()
    return service.snooze(data.id, data.userId)
  })

export const deleteMaintenanceTask = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string; userId: string }) => d)
  .handler(async ({ data }) => {
    const service = getMaintenanceService()
    const task = await service.findById(data.id)
    if (!task) throw new Error('Maintenance task not found')
    const property = await getPropertyService().findById(task.propertyId, data.userId)
    if (!property) throw new Error('Property not found or access denied')
    await service.delete(data.id)

    if (task) {
      getActivityService()
        .record({
          propertyId: task.propertyId,
          userId: data.userId,
          action: 'deleted',
          entityType: 'maintenance_task',
          entityId: data.id,
          entityName: task.name,
        })
        .catch(() => {})
    }

    return { success: true }
  })

export const triggerMaintenanceSuggestions = createServerFn({ method: 'POST' })
  .inputValidator((d: { itemId: string; userId: string }) => d)
  .handler(async ({ data }) => {
    try {
      const { tasks } = await import('@trigger.dev/sdk/v3')
      await tasks.trigger('suggest-maintenance', {
        itemId: data.itemId,
        userId: data.userId,
      })
      logger.info('Triggered maintenance suggestions', { itemId: data.itemId })
      return { success: true, method: 'trigger' as const }
    } catch (err) {
      // Trigger.dev not available — run inline instead
      logger.warn('Trigger.dev unavailable, running suggestions inline', { error: err })
      const { suggestMaintenanceWithClaude } = await import('@/lib/llm/claude')
      const { MaintenanceService } = await import('./service')

      const service = new MaintenanceService({ db: prisma, logger })

      const item = await prisma.item.findUnique({
        where: { id: data.itemId },
        select: {
          id: true,
          propertyId: true,
          name: true,
          category: true,
          manufacturer: true,
          model: true,
          acquiredDate: true,
          notes: true,
        },
      })

      if (!item) throw new Error('Item not found')

      const suggestions = await suggestMaintenanceWithClaude({
        name: item.name,
        category: item.category,
        manufacturer: item.manufacturer,
        model: item.model,
        acquiredDate: item.acquiredDate,
        notes: item.notes,
      })

      await service.createFromAI(data.userId, item.propertyId, item.id, suggestions)

      return { success: true, method: 'inline' as const, count: suggestions.length }
    }
  })
