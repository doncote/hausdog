import { createServerFn } from '@tanstack/react-start'
import { ActivityService } from '@/features/activity/service'
import { PropertyService } from '@/features/properties/service'
import { consoleLogger as logger } from '@/lib/console-logger'
import { prisma } from '@/lib/db/client'
import { getSafeSession } from '@/lib/supabase'
import { SpaceService } from './service'
import type { CreateSpaceInput, UpdateSpaceInput } from './types'

const getSpaceService = () => new SpaceService({ db: prisma, logger })
const getActivityService = () => new ActivityService(prisma)
const getPropertyService = () => new PropertyService({ db: prisma, logger })

export const fetchSpacesForProperty = createServerFn({ method: 'GET' })
  .inputValidator((d: { propertyId: string }) => d)
  .handler(async ({ data }) => {
    const { user } = await getSafeSession()
    if (!user) throw new Error('Unauthorized')
    const property = await getPropertyService().findById(data.propertyId, user.id)
    if (!property) throw new Error('Property not found or access denied')
    const service = getSpaceService()
    return service.findAllForProperty(data.propertyId)
  })

export const fetchSpace = createServerFn({ method: 'GET' })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const { user } = await getSafeSession()
    if (!user) throw new Error('Unauthorized')
    const service = getSpaceService()
    const space = await service.findById(data.id)
    if (!space) return null
    const property = await getPropertyService().findById(space.propertyId, user.id)
    if (!property) throw new Error('Property not found or access denied')
    return space
  })

export const createSpace = createServerFn({ method: 'POST' })
  .inputValidator((d: { userId: string; input: CreateSpaceInput }) => d)
  .handler(async ({ data }) => {
    const property = await getPropertyService().findById(data.input.propertyId, data.userId)
    if (!property) throw new Error('Property not found or access denied')
    const service = getSpaceService()
    const space = await service.create(data.userId, data.input)

    getActivityService()
      .record({
        propertyId: space.propertyId,
        userId: data.userId,
        action: 'created',
        entityType: 'space',
        entityId: space.id,
        entityName: space.name,
      })
      .catch(() => {})

    return space
  })

export const updateSpace = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string; userId: string; input: UpdateSpaceInput }) => d)
  .handler(async ({ data }) => {
    const service = getSpaceService()
    const existing = await service.findById(data.id)
    if (!existing) throw new Error('Space not found')
    const property = await getPropertyService().findById(existing.propertyId, data.userId)
    if (!property) throw new Error('Property not found or access denied')
    const space = await service.update(data.id, data.userId, data.input)

    getActivityService()
      .record({
        propertyId: space.propertyId,
        userId: data.userId,
        action: 'updated',
        entityType: 'space',
        entityId: space.id,
        entityName: space.name,
      })
      .catch(() => {})

    return space
  })

export const deleteSpace = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string; userId: string }) => d)
  .handler(async ({ data }) => {
    const service = getSpaceService()
    const space = await service.findById(data.id)
    if (!space) throw new Error('Space not found')
    const property = await getPropertyService().findById(space.propertyId, data.userId)
    if (!property) throw new Error('Property not found or access denied')
    await service.delete(data.id)

    if (space) {
      getActivityService()
        .record({
          propertyId: space.propertyId,
          userId: data.userId,
          action: 'deleted',
          entityType: 'space',
          entityId: data.id,
          entityName: space.name,
        })
        .catch(() => {})
    }

    return { success: true }
  })
