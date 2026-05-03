import { createServerFn } from '@tanstack/react-start'
import { ActivityService } from '@/features/activity/service'
import { PropertyService } from '@/features/properties/service'
import { consoleLogger as logger } from '@/lib/console-logger'
import { prisma } from '@/lib/db/client'
import { getSafeSession } from '@/lib/supabase'
import { parsePaginationParams } from '@/lib/pagination'
import { ItemService } from './service'
import type { CreateItemInput, UpdateItemInput } from './types'

const getItemService = () => new ItemService({ db: prisma, logger })
const getActivityService = () => new ActivityService(prisma)
const getPropertyService = () => new PropertyService({ db: prisma, logger })

export const fetchItemsForProperty = createServerFn({ method: 'GET' })
  .inputValidator((d: { propertyId: string }) => d)
  .handler(async ({ data }) => {
    const { user } = await getSafeSession()
    if (!user) throw new Error('Unauthorized')
    const property = await getPropertyService().findById(data.propertyId, user.id)
    if (!property) throw new Error('Property not found or access denied')
    const service = getItemService()
    return service.findAllForProperty(data.propertyId)
  })

export const fetchItemsForPropertyPaginated = createServerFn({ method: 'GET' })
  .inputValidator((d: { propertyId: string; page?: number; limit?: number }) => d)
  .handler(async ({ data }) => {
    const { user } = await getSafeSession()
    if (!user) throw new Error('Unauthorized')
    const property = await getPropertyService().findById(data.propertyId, user.id)
    if (!property) throw new Error('Property not found or access denied')
    const service = getItemService()
    const pagination = parsePaginationParams({ page: data.page, limit: data.limit })
    return service.findPaginatedForProperty(data.propertyId, pagination)
  })

export const fetchRootItemsForProperty = createServerFn({ method: 'GET' })
  .inputValidator((d: { propertyId: string }) => d)
  .handler(async ({ data }) => {
    const { user } = await getSafeSession()
    if (!user) throw new Error('Unauthorized')
    const property = await getPropertyService().findById(data.propertyId, user.id)
    if (!property) throw new Error('Property not found or access denied')
    const service = getItemService()
    return service.findRootItemsForProperty(data.propertyId)
  })

export const fetchItemsForSpace = createServerFn({ method: 'GET' })
  .inputValidator((d: { spaceId: string }) => d)
  .handler(async ({ data }) => {
    const { user } = await getSafeSession()
    if (!user) throw new Error('Unauthorized')
    const space = await prisma.space.findUnique({
      where: { id: data.spaceId },
      select: { propertyId: true },
    })
    if (!space) throw new Error('Space not found')
    const property = await getPropertyService().findById(space.propertyId, user.id)
    if (!property) throw new Error('Property not found or access denied')
    const service = getItemService()
    return service.findAllForSpace(data.spaceId)
  })

export const fetchItem = createServerFn({ method: 'GET' })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const { user } = await getSafeSession()
    if (!user) throw new Error('Unauthorized')
    const service = getItemService()
    const item = await service.findById(data.id)
    if (!item) return null
    const property = await getPropertyService().findById(item.propertyId, user.id)
    if (!property) throw new Error('Property not found or access denied')
    return item
  })

export const createItem = createServerFn({ method: 'POST' })
  .inputValidator((d: { input: CreateItemInput }) => d)
  .handler(async ({ data }) => {
    const { user } = await getSafeSession()
    if (!user) throw new Error('Unauthorized')
    if (!(await getPropertyService().canWrite(data.input.propertyId, user.id)))
      throw new Error('Property not found or access denied')
    const service = getItemService()
    const item = await service.create(user.id, data.input)

    // Trigger AI maintenance suggestions in background
    try {
      const { tasks } = await import('@trigger.dev/sdk/v3')
      await tasks.trigger('suggest-maintenance', {
        itemId: item.id,
        userId: user.id,
      })
      logger.info('Triggered maintenance suggestions', { itemId: item.id })
    } catch (err) {
      logger.warn('Failed to trigger maintenance suggestions', { itemId: item.id, error: err })
    }

    getActivityService()
      .record({
        propertyId: item.propertyId,
        userId: user.id,
        action: 'created',
        entityType: 'item',
        entityId: item.id,
        entityName: item.name,
      })
      .catch(() => {})

    return item
  })

export const updateItem = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string; input: UpdateItemInput }) => d)
  .handler(async ({ data }) => {
    const { user } = await getSafeSession()
    if (!user) throw new Error('Unauthorized')
    const service = getItemService()
    const existing = await service.findById(data.id)
    if (!existing) throw new Error('Item not found')
    if (!(await getPropertyService().canWrite(existing.propertyId, user.id)))
      throw new Error('Property not found or access denied')
    const item = await service.update(data.id, user.id, data.input)

    getActivityService()
      .record({
        propertyId: item.propertyId,
        userId: user.id,
        action: 'updated',
        entityType: 'item',
        entityId: item.id,
        entityName: item.name,
      })
      .catch(() => {})

    return item
  })

export const deleteItem = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const { user } = await getSafeSession()
    if (!user) throw new Error('Unauthorized')
    const service = getItemService()
    const item = await service.findById(data.id)
    if (!item) throw new Error('Item not found')
    if (!(await getPropertyService().canWrite(item.propertyId, user.id)))
      throw new Error('Property not found or access denied')
    await service.delete(data.id)

    if (item) {
      getActivityService()
        .record({
          propertyId: item.propertyId,
          userId: user.id,
          action: 'deleted',
          entityType: 'item',
          entityId: data.id,
          entityName: item.name,
        })
        .catch(() => {})
    }

    return { success: true }
  })
