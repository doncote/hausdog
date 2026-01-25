import { createServerFn } from '@tanstack/react-start'
import type { CreateComponentInput, UpdateComponentInput } from '@hausdog/domain/components'
import { prisma } from '@/lib/db/client'
import { logger } from '@/lib/logger'
import { ComponentService } from './service'

const getComponentService = () => new ComponentService({ db: prisma, logger })

export const fetchComponentsForSystem = createServerFn({ method: 'GET' })
  .inputValidator((d: { systemId: string; userId: string }) => d)
  .handler(async ({ data }) => {
    const service = getComponentService()
    return service.findAllForSystem(data.systemId, data.userId)
  })

export const fetchComponent = createServerFn({ method: 'GET' })
  .inputValidator((d: { id: string; userId: string }) => d)
  .handler(async ({ data }) => {
    const service = getComponentService()
    return service.findById(data.id, data.userId)
  })

export const createComponent = createServerFn({ method: 'POST' })
  .inputValidator((d: { userId: string; input: CreateComponentInput }) => d)
  .handler(async ({ data }) => {
    const service = getComponentService()
    return service.create(data.userId, data.input)
  })

export const updateComponent = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string; userId: string; input: UpdateComponentInput }) => d)
  .handler(async ({ data }) => {
    const service = getComponentService()
    return service.update(data.id, data.userId, data.input)
  })

export const deleteComponent = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string; userId: string }) => d)
  .handler(async ({ data }) => {
    const service = getComponentService()
    await service.delete(data.id, data.userId)
    return { success: true }
  })
