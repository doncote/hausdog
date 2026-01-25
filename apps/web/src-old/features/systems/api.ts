import { createServerFn } from '@tanstack/react-start'
import type { CreateSystemInput, UpdateSystemInput } from '@hausdog/domain/systems'
import { prisma } from '@/lib/db/client'
import { logger } from '@/lib/logger'
import { SystemService } from './service'

const getSystemService = () => new SystemService({ db: prisma, logger })

export const fetchSystemsForProperty = createServerFn({ method: 'GET' })
  .inputValidator((d: { propertyId: string; userId: string }) => d)
  .handler(async ({ data }) => {
    const service = getSystemService()
    return service.findAllForProperty(data.propertyId, data.userId)
  })

export const fetchSystem = createServerFn({ method: 'GET' })
  .inputValidator((d: { id: string; userId: string }) => d)
  .handler(async ({ data }) => {
    const service = getSystemService()
    return service.findById(data.id, data.userId)
  })

export const createSystem = createServerFn({ method: 'POST' })
  .inputValidator((d: { userId: string; input: CreateSystemInput }) => d)
  .handler(async ({ data }) => {
    const service = getSystemService()
    return service.create(data.userId, data.input)
  })

export const updateSystem = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string; userId: string; input: UpdateSystemInput }) => d)
  .handler(async ({ data }) => {
    const service = getSystemService()
    return service.update(data.id, data.userId, data.input)
  })

export const deleteSystem = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string; userId: string }) => d)
  .handler(async ({ data }) => {
    const service = getSystemService()
    await service.delete(data.id, data.userId)
    return { success: true }
  })
