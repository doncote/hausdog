import { createServerFn } from '@tanstack/react-start'
import { prisma } from '@/lib/db/client'
import { logger } from '@/lib/logger'
import { PropertyService } from './service'
import type { CreatePropertyInput, UpdatePropertyInput } from './types'

const getPropertyService = () => new PropertyService({ db: prisma, logger })

export const fetchProperties = createServerFn({ method: 'GET' })
  .inputValidator((d: string) => d)
  .handler(async ({ data: userId }) => {
    const service = getPropertyService()
    return service.findAllForUserWithCounts(userId)
  })

export const fetchProperty = createServerFn({ method: 'GET' })
  .inputValidator((d: { id: string; userId: string }) => d)
  .handler(async ({ data }) => {
    const service = getPropertyService()
    return service.findById(data.id, data.userId)
  })

export const createProperty = createServerFn({ method: 'POST' })
  .inputValidator((d: { userId: string; input: CreatePropertyInput }) => d)
  .handler(async ({ data }) => {
    const service = getPropertyService()
    return service.create(data.userId, data.input)
  })

export const updateProperty = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string; userId: string; input: UpdatePropertyInput }) => d)
  .handler(async ({ data }) => {
    const service = getPropertyService()
    return service.update(data.id, data.userId, data.input)
  })

export const deleteProperty = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string; userId: string }) => d)
  .handler(async ({ data }) => {
    const service = getPropertyService()
    await service.delete(data.id, data.userId)
    return { success: true }
  })
