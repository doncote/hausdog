import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { PropertyService } from '@/features/properties/service'
import { SpaceService } from '@/features/spaces/service'
import { UpdateSpaceSchema } from '@/features/spaces/types'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import type { AuthContext } from '../middleware/auth'

const spaceService = new SpaceService({ db: prisma, logger })
const propertyService = new PropertyService({ db: prisma, logger })

// Response schemas
const SpaceSchema = z.object({
  id: z.string().uuid(),
  propertyId: z.string().uuid(),
  name: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

const SpaceWithCountsSchema = SpaceSchema.extend({
  _count: z
    .object({
      items: z.number(),
    })
    .optional(),
})

const ErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
})

// Routes
const listSpaces = createRoute({
  method: 'get',
  path: '/properties/{propertyId}/spaces',
  tags: ['Spaces'],
  summary: 'List spaces for a property',
  request: {
    params: z.object({
      propertyId: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: 'List of spaces',
      content: {
        'application/json': {
          schema: z.array(SpaceWithCountsSchema),
        },
      },
    },
    404: {
      description: 'Property not found',
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
    },
  },
})

const getSpace = createRoute({
  method: 'get',
  path: '/spaces/{id}',
  tags: ['Spaces'],
  summary: 'Get a space',
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: 'Space details',
      content: {
        'application/json': {
          schema: SpaceSchema,
        },
      },
    },
    404: {
      description: 'Space not found',
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
    },
  },
})

const createSpace = createRoute({
  method: 'post',
  path: '/properties/{propertyId}/spaces',
  tags: ['Spaces'],
  summary: 'Create a space',
  request: {
    params: z.object({
      propertyId: z.string().uuid(),
    }),
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
      description: 'Space created',
      content: {
        'application/json': {
          schema: SpaceSchema,
        },
      },
    },
    404: {
      description: 'Property not found',
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
    },
  },
})

const updateSpace = createRoute({
  method: 'patch',
  path: '/spaces/{id}',
  tags: ['Spaces'],
  summary: 'Update a space',
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
    body: {
      content: {
        'application/json': {
          schema: UpdateSpaceSchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Space updated',
      content: {
        'application/json': {
          schema: SpaceSchema,
        },
      },
    },
    404: {
      description: 'Space not found',
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
    },
  },
})

const deleteSpace = createRoute({
  method: 'delete',
  path: '/spaces/{id}',
  tags: ['Spaces'],
  summary: 'Delete a space',
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
  },
  responses: {
    204: {
      description: 'Space deleted',
    },
    404: {
      description: 'Space not found',
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
    },
  },
})

// Create router
export const spacesRouter = new OpenAPIHono<{ Variables: AuthContext }>()

spacesRouter.openapi(listSpaces, async (c) => {
  const userId = c.get('userId')
  const { propertyId } = c.req.valid('param')

  const property = await propertyService.findById(propertyId, userId)
  if (!property) {
    return c.json({ error: 'not_found', message: 'Property not found' }, 404)
  }

  const spaces = await spaceService.findAllForProperty(propertyId)
  return c.json(
    spaces.map((s) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    })),
    200,
  )
})

spacesRouter.openapi(getSpace, async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.valid('param')
  const space = await spaceService.findById(id)

  if (!space) {
    return c.json({ error: 'not_found', message: 'Space not found' }, 404)
  }

  // Verify ownership through property
  const property = await propertyService.findById(space.propertyId, userId)
  if (!property) {
    return c.json({ error: 'not_found', message: 'Space not found' }, 404)
  }

  return c.json(
    {
      ...space,
      createdAt: space.createdAt.toISOString(),
      updatedAt: space.updatedAt.toISOString(),
    },
    200,
  )
})

spacesRouter.openapi(createSpace, async (c) => {
  const userId = c.get('userId')
  const { propertyId } = c.req.valid('param')
  const { name } = c.req.valid('json')

  const property = await propertyService.findById(propertyId, userId)
  if (!property) {
    return c.json({ error: 'not_found', message: 'Property not found' }, 404)
  }

  const space = await spaceService.create(userId, { propertyId, name })

  return c.json(
    {
      ...space,
      createdAt: space.createdAt.toISOString(),
      updatedAt: space.updatedAt.toISOString(),
    },
    201,
  )
})

spacesRouter.openapi(updateSpace, async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.valid('param')
  const input = c.req.valid('json')

  const existing = await spaceService.findById(id)
  if (!existing) {
    return c.json({ error: 'not_found', message: 'Space not found' }, 404)
  }

  // Verify ownership through property
  const property = await propertyService.findById(existing.propertyId, userId)
  if (!property) {
    return c.json({ error: 'not_found', message: 'Space not found' }, 404)
  }

  const space = await spaceService.update(id, userId, input)

  return c.json(
    {
      ...space,
      createdAt: space.createdAt.toISOString(),
      updatedAt: space.updatedAt.toISOString(),
    },
    200,
  )
})

spacesRouter.openapi(deleteSpace, async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.valid('param')

  const existing = await spaceService.findById(id)
  if (!existing) {
    return c.json({ error: 'not_found', message: 'Space not found' }, 404)
  }

  // Verify ownership through property
  const property = await propertyService.findById(existing.propertyId, userId)
  if (!property) {
    return c.json({ error: 'not_found', message: 'Space not found' }, 404)
  }

  await spaceService.delete(id)
  return c.body(null, 204)
})
