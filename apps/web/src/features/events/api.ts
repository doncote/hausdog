import { createServerFn } from '@tanstack/react-start'
import { PropertyService } from '@/features/properties/service'
import { consoleLogger as logger } from '@/lib/console-logger'
import { prisma } from '@/lib/db/client'
import { getSafeSession } from '@/lib/supabase'
import { EventService } from './service'
import type { CreateEventInput, UpdateEventInput } from './types'

const getEventService = () => new EventService({ db: prisma, logger })
const getPropertyService = () => new PropertyService({ db: prisma, logger })

export const fetchEventsForItem = createServerFn({ method: 'GET' })
  .inputValidator((d: { itemId: string }) => d)
  .handler(async ({ data }) => {
    const { user } = await getSafeSession()
    if (!user) throw new Error('Unauthorized')
    const item = await prisma.item.findUnique({
      where: { id: data.itemId },
      select: { propertyId: true },
    })
    if (!item) throw new Error('Item not found')
    const property = await getPropertyService().findById(item.propertyId, user.id)
    if (!property) throw new Error('Property not found or access denied')
    const service = getEventService()
    return service.findAllForItem(data.itemId)
  })

export const fetchEvent = createServerFn({ method: 'GET' })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const { user } = await getSafeSession()
    if (!user) throw new Error('Unauthorized')
    const service = getEventService()
    const event = await service.findById(data.id)
    if (!event) return null
    const item = await prisma.item.findUnique({
      where: { id: event.itemId },
      select: { propertyId: true },
    })
    if (!item) throw new Error('Item not found')
    const property = await getPropertyService().findById(item.propertyId, user.id)
    if (!property) throw new Error('Property not found or access denied')
    return event
  })

export const createEvent = createServerFn({ method: 'POST' })
  .inputValidator((d: { input: CreateEventInput }) => d)
  .handler(async ({ data }) => {
    const { user } = await getSafeSession()
    if (!user) throw new Error('Unauthorized')
    const item = await prisma.item.findUnique({
      where: { id: data.input.itemId },
      select: { propertyId: true },
    })
    if (!item) throw new Error('Item not found')
    if (!(await getPropertyService().canWrite(item.propertyId, user.id)))
      throw new Error('Property not found or access denied')
    const service = getEventService()
    return service.create(user.id, data.input)
  })

export const updateEvent = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string; input: UpdateEventInput }) => d)
  .handler(async ({ data }) => {
    const { user } = await getSafeSession()
    if (!user) throw new Error('Unauthorized')
    const existing = await prisma.event.findUnique({
      where: { id: data.id },
      select: { item: { select: { propertyId: true } } },
    })
    if (!existing) throw new Error('Event not found')
    if (!(await getPropertyService().canWrite(existing.item.propertyId, user.id)))
      throw new Error('Property not found or access denied')
    const service = getEventService()
    return service.update(data.id, user.id, data.input)
  })

export const deleteEvent = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const { user } = await getSafeSession()
    if (!user) throw new Error('Unauthorized')
    const existing = await prisma.event.findUnique({
      where: { id: data.id },
      select: { item: { select: { propertyId: true } } },
    })
    if (!existing) throw new Error('Event not found')
    if (!(await getPropertyService().canWrite(existing.item.propertyId, user.id)))
      throw new Error('Property not found or access denied')
    const service = getEventService()
    await service.delete(data.id)
    return { success: true }
  })
