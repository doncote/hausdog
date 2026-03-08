import { createServerFn } from '@tanstack/react-start'
import { ActivityService } from '@/features/activity/service'
import { consoleLogger as logger } from '@/lib/console-logger'
import { prisma } from '@/lib/db/client'
import { parsePaginationParams } from '@/lib/pagination'
import { ItemService } from './service'
import type { CreateItemInput, UpdateItemInput } from './types'

const getItemService = () => new ItemService({ db: prisma, logger })
const getActivityService = () => new ActivityService(prisma)

export const fetchItemsForProperty = createServerFn({ method: 'GET' })
  .inputValidator((d: { propertyId: string }) => d)
  .handler(async ({ data }) => {
    const service = getItemService()
    return service.findAllForProperty(data.propertyId)
  })

export const fetchItemsForPropertyPaginated = createServerFn({ method: 'GET' })
  .inputValidator((d: { propertyId: string; page?: number; limit?: number }) => d)
  .handler(async ({ data }) => {
    const service = getItemService()
    const pagination = parsePaginationParams({ page: data.page, limit: data.limit })
    return service.findPaginatedForProperty(data.propertyId, pagination)
  })

export const fetchRootItemsForProperty = createServerFn({ method: 'GET' })
  .inputValidator((d: { propertyId: string }) => d)
  .handler(async ({ data }) => {
    const service = getItemService()
    return service.findRootItemsForProperty(data.propertyId)
  })

export const fetchItemsForSpace = createServerFn({ method: 'GET' })
  .inputValidator((d: { spaceId: string }) => d)
  .handler(async ({ data }) => {
    const service = getItemService()
    return service.findAllForSpace(data.spaceId)
  })

export const fetchItem = createServerFn({ method: 'GET' })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const service = getItemService()
    return service.findById(data.id)
  })

export const createItem = createServerFn({ method: 'POST' })
  .inputValidator((d: { userId: string; input: CreateItemInput }) => d)
  .handler(async ({ data }) => {
    const service = getItemService()
    const item = await service.create(data.userId, data.input)

    // Trigger AI maintenance suggestions in background
    try {
      const { tasks } = await import('@trigger.dev/sdk/v3')
      await tasks.trigger('suggest-maintenance', {
        itemId: item.id,
        userId: data.userId,
      })
      logger.info('Triggered maintenance suggestions', { itemId: item.id })
    } catch (err) {
      logger.warn('Failed to trigger maintenance suggestions', { itemId: item.id, error: err })
    }

    getActivityService()
      .record({
        propertyId: item.propertyId,
        userId: data.userId,
        action: 'created',
        entityType: 'item',
        entityId: item.id,
        entityName: item.name,
      })
      .catch(() => {})

    return item
  })

export const updateItem = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string; userId: string; input: UpdateItemInput }) => d)
  .handler(async ({ data }) => {
    const service = getItemService()
    const item = await service.update(data.id, data.userId, data.input)

    getActivityService()
      .record({
        propertyId: item.propertyId,
        userId: data.userId,
        action: 'updated',
        entityType: 'item',
        entityId: item.id,
        entityName: item.name,
      })
      .catch(() => {})

    return item
  })

export const deleteItem = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string; userId: string }) => d)
  .handler(async ({ data }) => {
    const service = getItemService()
    const item = await service.findById(data.id)
    await service.delete(data.id)

    if (item) {
      getActivityService()
        .record({
          propertyId: item.propertyId,
          userId: data.userId,
          action: 'deleted',
          entityType: 'item',
          entityId: data.id,
          entityName: item.name,
        })
        .catch(() => {})
    }

    return { success: true }
  })
