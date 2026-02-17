import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { ApiKeyService } from '@/features/api-keys/service'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import type { AuthContext } from '../middleware/auth'

const apiKeyService = new ApiKeyService({ db: prisma, logger })

// Response schemas
const UserInfoSchema = z.object({
  userId: z.string().uuid(),
  apiKey: z.object({
    id: z.string().uuid(),
    name: z.string(),
  }),
})

const ApiKeySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  lastUsedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
})

const CreateApiKeyResponseSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  secret: z.string().describe('The API key secret. Only shown once at creation time.'),
  createdAt: z.string().datetime(),
})

const ErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
})

// Routes
const getMe = createRoute({
  method: 'get',
  path: '/auth/me',
  tags: ['Auth'],
  summary: 'Get current user info',
  description: 'Verify API key and return user information',
  responses: {
    200: {
      description: 'Current user info',
      content: {
        'application/json': {
          schema: UserInfoSchema,
        },
      },
    },
  },
})

const listApiKeys = createRoute({
  method: 'get',
  path: '/auth/keys',
  tags: ['Auth'],
  summary: 'List API keys',
  description: 'List all API keys for the current user',
  responses: {
    200: {
      description: 'List of API keys',
      content: {
        'application/json': {
          schema: z.array(ApiKeySchema),
        },
      },
    },
  },
})

const createApiKey = createRoute({
  method: 'post',
  path: '/auth/keys',
  tags: ['Auth'],
  summary: 'Create API key',
  description: 'Create a new API key. The secret is only shown once.',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string().min(1, 'Name is required'),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: 'API key created',
      content: {
        'application/json': {
          schema: CreateApiKeyResponseSchema,
        },
      },
    },
  },
})

const deleteApiKey = createRoute({
  method: 'delete',
  path: '/auth/keys/{id}',
  tags: ['Auth'],
  summary: 'Delete API key',
  description: 'Revoke an API key',
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
  },
  responses: {
    204: {
      description: 'API key deleted',
    },
    404: {
      description: 'API key not found',
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
    },
  },
})

// Create router
export const authRouter = new OpenAPIHono<{ Variables: AuthContext }>()

authRouter.openapi(getMe, async (c) => {
  const userId = c.get('userId')
  const apiKeyId = c.get('apiKeyId')
  const apiKeyName = c.get('apiKeyName')

  return c.json({
    userId,
    apiKey: {
      id: apiKeyId,
      name: apiKeyName,
    },
  })
})

authRouter.openapi(listApiKeys, async (c) => {
  const userId = c.get('userId')
  const keys = await apiKeyService.findAllForUser(userId)

  return c.json(
    keys.map((k) => ({
      id: k.id,
      name: k.name,
      lastUsedAt: k.lastUsedAt?.toISOString() ?? null,
      createdAt: k.createdAt.toISOString(),
    })),
  )
})

authRouter.openapi(createApiKey, async (c) => {
  const userId = c.get('userId')
  const { name } = c.req.valid('json')

  const key = await apiKeyService.create(userId, { name })

  return c.json(
    {
      id: key.id,
      name: key.name,
      secret: key.secret,
      createdAt: key.createdAt.toISOString(),
    },
    201,
  )
})

authRouter.openapi(deleteApiKey, async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.valid('param')

  const existing = await apiKeyService.findById(id)
  if (!existing || existing.userId !== userId) {
    return c.json({ error: 'not_found', message: 'API key not found' }, 404)
  }

  await apiKeyService.delete(id, userId)
  return c.body(null, 204)
})
