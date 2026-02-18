import { createServerFn } from '@tanstack/react-start'

async function getApiKeyService() {
  const { prisma } = await import('@/lib/db/client')
  const { consoleLogger: logger } = await import('@/lib/console-logger')
  const { ApiKeyService } = await import('./service')
  return new ApiKeyService({ db: prisma, logger })
}

async function requireUser() {
  const { getSafeSession } = await import('@/lib/supabase')
  const session = await getSafeSession()
  if (!session?.user?.id) {
    throw new Error('Not authenticated')
  }
  return session.user.id
}

export const fetchApiKeys = createServerFn({ method: 'GET' }).handler(async () => {
  const userId = await requireUser()
  const service = await getApiKeyService()
  return service.findAllForUser(userId)
})

export const createApiKey = createServerFn({ method: 'POST' })
  .inputValidator((d: { name: string }) => d)
  .handler(async ({ data }) => {
    const userId = await requireUser()
    const service = await getApiKeyService()
    return service.create(userId, { name: data.name })
  })

export const deleteApiKey = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const userId = await requireUser()
    const service = await getApiKeyService()
    await service.delete(data.id, userId)
    return { success: true }
  })
