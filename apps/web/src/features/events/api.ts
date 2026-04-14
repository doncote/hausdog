import { createServerFn } from '@tanstack/react-start'
import { PropertyService } from '@/features/properties/service'
import { consoleLogger as logger } from '@/lib/console-logger'
import { prisma } from '@/lib/db/client'
import { EventService } from './service'
import type { CreateEventInput, UpdateEventInput } from './types'

const getEventService = () => new EventService({ db: prisma, logger })
const getPropertyService = () => new PropertyService({ db: prisma, logger })

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
    const item = await prisma.item.findUnique({
      where: { id: data.input.itemId },
      select: { propertyId: true },
    })
    if (!item) throw new Error('Item not found')
    const property = await getPropertyService().findById(item.propertyId, data.userId)
    if (!property) throw new Error('Property not found or access denied')
    const service = getEventService()
    return service.create(data.userId, data.input)
  })

export const updateEvent = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string; userId: string; input: UpdateEventInput }) => d)
  .handler(async ({ data }) => {
    const existing = await prisma.event.findUnique({
      where: { id: data.id },
      select: { item: { select: { propertyId: true } } },
    })
    if (!existing) throw new Error('Event not found')
    const property = await getPropertyService().findById(existing.item.propertyId, data.userId)
    if (!property) throw new Error('Property not found or access denied')
    const service = getEventService()
    return service.update(data.id, data.userId, data.input)
  })

export const deleteEvent = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string; userId: string }) => d)
  .handler(async ({ data }) => {
    const existing = await prisma.event.findUnique({
      where: { id: data.id },
      select: { item: { select: { propertyId: true } } },
    })
    if (!existing) throw new Error('Event not found')
    const property = await getPropertyService().findById(existing.item.propertyId, data.userId)
    if (!property) throw new Error('Property not found or access denied')
    const service = getEventService()
    await service.delete(data.id)
    return { success: true }
  })
