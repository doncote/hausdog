import { createServerFn } from '@tanstack/react-start'
import { prisma } from '@/lib/db/client'
import { logger } from '@/lib/logger'
import { EventService } from './service'
import type { CreateEventInput, UpdateEventInput } from './types'

const getEventService = () => new EventService({ db: prisma, logger })

export const fetchEventsForItem = createServerFn({ method: 'GET' })
  .inputValidator((d: { itemId: string }) => d)
  .handler(async ({ data }) => {
    const service = getEventService()
    return service.findAllForItem(data.itemId)
  })

export const fetchEvent = createServerFn({ method: 'GET' })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const service = getEventService()
    return service.findById(data.id)
  })

export const createEvent = createServerFn({ method: 'POST' })
  .inputValidator((d: { userId: string; input: CreateEventInput }) => d)
  .handler(async ({ data }) => {
    const service = getEventService()
    return service.create(data.userId, data.input)
  })

export const updateEvent = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string; userId: string; input: UpdateEventInput }) => d)
  .handler(async ({ data }) => {
    const service = getEventService()
    return service.update(data.id, data.userId, data.input)
  })

export const deleteEvent = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const service = getEventService()
    await service.delete(data.id)
    return { success: true }
  })
