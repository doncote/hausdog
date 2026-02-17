import { createServerFn } from '@tanstack/react-start'
import { prisma } from '@/lib/db/client'
import { logger } from '@/lib/logger'
import { getSafeSession } from '@/lib/supabase'
import { ApiKeyService } from './service'

const getApiKeyService = () => new ApiKeyService({ db: prisma, logger })

async function requireUser() {
  const session = await getSafeSession()
  if (!session?.user?.id) {
    throw new Error('Not authenticated')
  }
  return session.user.id
}

export const fetchApiKeys = createServerFn({ method: 'GET' }).handler(async () => {
  const userId = await requireUser()
  const service = getApiKeyService()
  return service.findAllForUser(userId)
})

export const createApiKey = createServerFn({ method: 'POST' })
  .inputValidator((d: { name: string }) => d)
  .handler(async ({ data }) => {
    const userId = await requireUser()
    const service = getApiKeyService()
    return service.create(userId, { name: data.name })
  })

export const deleteApiKey = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const userId = await requireUser()
    const service = getApiKeyService()
    await service.delete(data.id, userId)
    return { success: true }
  })
