import { createServerFn } from '@tanstack/react-start'
import { ActivityService } from '@/features/activity/service'
import { consoleLogger as logger } from '@/lib/console-logger'
import { prisma } from '@/lib/db/client'
import { SpaceService } from './service'
import type { CreateSpaceInput, UpdateSpaceInput } from './types'

const getSpaceService = () => new SpaceService({ db: prisma, logger })
const getActivityService = () => new ActivityService(prisma)

export const fetchSpacesForProperty = createServerFn({ method: 'GET' })
  .inputValidator((d: { propertyId: string }) => d)
  .handler(async ({ data }) => {
    const service = getSpaceService()
    return service.findAllForProperty(data.propertyId)
  })

export const fetchSpace = createServerFn({ method: 'GET' })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const service = getSpaceService()
    return service.findById(data.id)
  })

export const createSpace = createServerFn({ method: 'POST' })
  .inputValidator((d: { userId: string; input: CreateSpaceInput }) => d)
  .handler(async ({ data }) => {
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
