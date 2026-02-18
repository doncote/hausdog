import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { PropertyService } from '@/features/properties/service'
import { CreatePropertySchema, UpdatePropertySchema } from '@/features/properties/types'
import { consoleLogger as logger } from '@/lib/console-logger'
import { prisma } from '@/lib/db'
import type { AuthContext } from '../middleware/auth'

const propertyService = new PropertyService({ db: prisma, logger })

// Response schemas
const PropertySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string(),
  streetAddress: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  postalCode: z.string().nullable(),
  country: z.string().nullable(),
  formattedAddress: z.string().nullable(),
  yearBuilt: z.number().nullable(),
  squareFeet: z.number().nullable(),
  bedrooms: z.number().nullable(),
  bathrooms: z.number().nullable(),
  propertyType: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

const PropertyWithCountsSchema = PropertySchema.extend({
  _count: z.object({
    items: z.number(),
    spaces: z.number(),
  }),
})

const ErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
})

// Routes
const listProperties = createRoute({
  method: 'get',
  path: '/properties',
  tags: ['Properties'],
  summary: 'List all properties',
  description: 'Returns all properties for the authenticated user',
  responses: {
    200: {
      description: 'List of properties',
      content: {
        'application/json': {
          schema: z.array(PropertyWithCountsSchema),
        },
      },
    },
  },
})

const getProperty = createRoute({
  method: 'get',
  path: '/properties/{id}',
  tags: ['Properties'],
  summary: 'Get a property',
  description: 'Returns a single property by ID',
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: 'Property details',
      content: {
        'application/json': {
          schema: PropertySchema,
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

const createProperty = createRoute({
  method: 'post',
  path: '/properties',
  tags: ['Properties'],
  summary: 'Create a property',
  description: 'Creates a new property for the authenticated user',
  request: {
    body: {
      content: {
        'application/json': {
          schema: CreatePropertySchema,
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Property created',
      content: {
        'application/json': {
          schema: PropertySchema,
        },
      },
    },
    400: {
      description: 'Invalid input',
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
    },
  },
})

const updateProperty = createRoute({
  method: 'patch',
  path: '/properties/{id}',
  tags: ['Properties'],
  summary: 'Update a property',
  description: 'Updates an existing property',
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
    body: {
      content: {
        'application/json': {
          schema: UpdatePropertySchema,
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Property updated',
      content: {
        'application/json': {
          schema: PropertySchema,
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

const deleteProperty = createRoute({
  method: 'delete',
  path: '/properties/{id}',
  tags: ['Properties'],
  summary: 'Delete a property',
  description: 'Deletes a property and all associated data',
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
  },
  responses: {
    204: {
      description: 'Property deleted',
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

// Create router
export const propertiesRouter = new OpenAPIHono<{ Variables: AuthContext }>()

propertiesRouter.openapi(listProperties, async (c) => {
  const userId = c.get('userId')
  const properties = await propertyService.findAllForUserWithCounts(userId)
  return c.json(
    properties.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })),
  )
})

propertiesRouter.openapi(getProperty, async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.valid('param')
  const property = await propertyService.findById(id, userId)

  if (!property) {
    return c.json({ error: 'not_found', message: 'Property not found' }, 404)
  }

  return c.json(
    {
      ...property,
      createdAt: property.createdAt.toISOString(),
      updatedAt: property.updatedAt.toISOString(),
    },
    200,
  )
})

propertiesRouter.openapi(createProperty, async (c) => {
  const userId = c.get('userId')
  const input = c.req.valid('json')
  const property = await propertyService.create(userId, input)

  return c.json(
    {
      ...property,
      createdAt: property.createdAt.toISOString(),
      updatedAt: property.updatedAt.toISOString(),
    },
    201,
  )
})

propertiesRouter.openapi(updateProperty, async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.valid('param')
  const input = c.req.valid('json')

  const existing = await propertyService.findById(id, userId)
  if (!existing) {
    return c.json({ error: 'not_found', message: 'Property not found' }, 404)
  }

  const property = await propertyService.update(id, userId, input)

  return c.json(
    {
      ...property,
      createdAt: property.createdAt.toISOString(),
      updatedAt: property.updatedAt.toISOString(),
    },
    200,
  )
})

propertiesRouter.openapi(deleteProperty, async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.valid('param')

  const existing = await propertyService.findById(id, userId)
  if (!existing) {
    return c.json({ error: 'not_found', message: 'Property not found' }, 404)
  }

  await propertyService.delete(id, userId)
  return c.body(null, 204)
})
