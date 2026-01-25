import { createServerFn } from '@tanstack/react-start'
import { prisma } from '@/lib/db/client'
import { logger } from '@/lib/logger'
import { SpaceService } from './service'
import type { CreateSpaceInput, UpdateSpaceInput } from './types'

const getSpaceService = () => new SpaceService({ db: prisma, logger })

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
    return service.create(data.userId, data.input)
  })

export const updateSpace = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string; userId: string; input: UpdateSpaceInput }) => d)
  .handler(async ({ data }) => {
    const service = getSpaceService()
    return service.update(data.id, data.userId, data.input)
  })

export const deleteSpace = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const service = getSpaceService()
    await service.delete(data.id)
    return { success: true }
  })
