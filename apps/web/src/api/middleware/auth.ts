import { createMiddleware } from 'hono/factory'
import { HTTPException } from 'hono/http-exception'
import { ApiKeyService } from '@/features/api-keys'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'

export interface AuthContext {
  userId: string
  apiKeyId: string
  apiKeyName: string
}

const apiKeyService = new ApiKeyService({ db: prisma, logger })

/**
 * Middleware that validates API key from Authorization header.
 * Sets userId in context for downstream handlers.
 */
export const apiKeyAuth = createMiddleware<{ Variables: AuthContext }>(async (c, next) => {
  const authHeader = c.req.header('Authorization')

  if (!authHeader) {
    throw new HTTPException(401, { message: 'Missing Authorization header' })
  }

  const [scheme, key] = authHeader.split(' ')

  if (scheme?.toLowerCase() !== 'bearer' || !key) {
    throw new HTTPException(401, { message: 'Invalid Authorization header format. Use: Bearer <api_key>' })
  }

  const validatedKey = await apiKeyService.validate(key)

  if (!validatedKey) {
    throw new HTTPException(401, { message: 'Invalid API key' })
  }

  c.set('userId', validatedKey.userId)
  c.set('apiKeyId', validatedKey.id)
  c.set('apiKeyName', validatedKey.name)

  await next()
})
