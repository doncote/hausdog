import { createServerFn } from '@tanstack/react-start'
import { prisma } from '@/lib/db/client'
import { logger } from '@/lib/logger'
import { ItemService } from './service'
import type { CreateItemInput, UpdateItemInput } from './types'

const getItemService = () => new ItemService({ db: prisma, logger })

export const fetchItemsForProperty = createServerFn({ method: 'GET' })
  .inputValidator((d: { propertyId: string }) => d)
  .handler(async ({ data }) => {
    const service = getItemService()
    return service.findAllForProperty(data.propertyId)
  })

export const fetchRootItemsForProperty = createServerFn({ method: 'GET' })
  .inputValidator((d: { propertyId: string }) => d)
  .handler(async ({ data }) => {
    const service = getItemService()
    return service.findRootItemsForProperty(data.propertyId)
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
    return service.create(data.userId, data.input)
  })

export const updateItem = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string; userId: string; input: UpdateItemInput }) => d)
  .handler(async ({ data }) => {
    const service = getItemService()
    return service.update(data.id, data.userId, data.input)
  })

export const deleteItem = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const service = getItemService()
    await service.delete(data.id)
    return { success: true }
  })
