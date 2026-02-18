import { createServerFn } from '@tanstack/react-start'
import { consoleLogger as logger } from '@/lib/console-logger'
import { prisma } from '@/lib/db/client'
import { MaintenanceService } from './service'
import type {
  CompleteMaintenanceTaskInput,
  CreateMaintenanceTaskInput,
  UpdateMaintenanceTaskInput,
} from './types'

const getMaintenanceService = () => new MaintenanceService({ db: prisma, logger })

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
    const service = getMaintenanceService()
    return service.create(data.userId, data.input)
  })

export const updateMaintenanceTask = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string; userId: string; input: UpdateMaintenanceTaskInput }) => d)
  .handler(async ({ data }) => {
    const service = getMaintenanceService()
    return service.update(data.id, data.userId, data.input)
  })

export const completeMaintenanceTask = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string; userId: string; input: CompleteMaintenanceTaskInput }) => d)
  .handler(async ({ data }) => {
    const service = getMaintenanceService()
    return service.complete(data.id, data.userId, data.input)
  })

export const snoozeMaintenanceTask = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string; userId: string }) => d)
  .handler(async ({ data }) => {
    const service = getMaintenanceService()
    return service.snooze(data.id, data.userId)
  })

export const deleteMaintenanceTask = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const service = getMaintenanceService()
    await service.delete(data.id)
    return { success: true }
  })

export const triggerMaintenanceSuggestions = createServerFn({ method: 'POST' })
  .inputValidator((d: { itemId: string; userId: string }) => d)
  .handler(async ({ data }) => {
    const { tasks } = await import('@trigger.dev/sdk/v3')
    await tasks.trigger('suggest-maintenance', { itemId: data.itemId, userId: data.userId })
    return { success: true }
  })
