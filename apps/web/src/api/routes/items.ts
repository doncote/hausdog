import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { ItemService } from '@/features/items/service'
import { PropertyService } from '@/features/properties/service'
import { prisma } from '@/lib/db'
import { consoleLogger as logger } from '@/lib/console-logger'
import type { AuthContext } from '../middleware/auth'

const itemService = new ItemService({ db: prisma, logger })
const propertyService = new PropertyService({ db: prisma, logger })

// Response schemas
const ItemSchema = z.object({
  id: z.string().uuid(),
  propertyId: z.string().uuid(),
  spaceId: z.string().uuid().nullable(),
  parentId: z.string().uuid().nullable(),
  name: z.string(),
  category: z.string(),
  manufacturer: z.string().nullable(),
  model: z.string().nullable(),
  serialNumber: z.string().nullable(),
  acquiredDate: z.string().datetime().nullable(),
  warrantyExpires: z.string().datetime().nullable(),
  purchasePrice: z.number().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

const ItemWithRelationsSchema = ItemSchema.extend({
  space: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
    })
    .nullable()
    .optional(),
  parent: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
    })
    .nullable()
    .optional(),
  _count: z
    .object({
      events: z.number(),
      documents: z.number(),
      children: z.number(),
    })
    .optional(),
})

const ErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
})

// Routes
const listItems = createRoute({
  method: 'get',
  path: '/properties/{propertyId}/items',
  tags: ['Items'],
  summary: 'List items for a property',
  request: {
    params: z.object({
      propertyId: z.string().uuid(),
    }),
    query: z.object({
      spaceId: z.string().uuid().optional(),
      category: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: 'List of items',
      content: {
        'application/json': {
          schema: z.array(ItemWithRelationsSchema),
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

const getItem = createRoute({
  method: 'get',
  path: '/items/{id}',
  tags: ['Items'],
  summary: 'Get an item',
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: 'Item details',
      content: {
        'application/json': {
          schema: ItemWithRelationsSchema,
        },
      },
    },
    404: {
      description: 'Item not found',
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
    },
  },
})

const getItemChildren = createRoute({
  method: 'get',
  path: '/items/{id}/children',
  tags: ['Items'],
  summary: 'Get child items',
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: 'List of child items',
      content: {
        'application/json': {
          schema: z.array(ItemWithRelationsSchema),
        },
      },
    },
    404: {
      description: 'Item not found',
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
    },
  },
})

const createItem = createRoute({
  method: 'post',
  path: '/properties/{propertyId}/items',
  tags: ['Items'],
  summary: 'Create an item',
  request: {
    params: z.object({
      propertyId: z.string().uuid(),
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            spaceId: z.string().uuid().optional(),
            parentId: z.string().uuid().optional(),
            name: z.string().min(1, 'Name is required'),
            category: z.string().min(1, 'Category is required'),
            manufacturer: z.string().optional(),
            model: z.string().optional(),
            serialNumber: z.string().optional(),
            acquiredDate: z.string().datetime().optional(),
            warrantyExpires: z.string().datetime().optional(),
            purchasePrice: z.number().positive().optional(),
            notes: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Item created',
      content: {
        'application/json': {
          schema: ItemSchema,
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

const updateItem = createRoute({
  method: 'patch',
  path: '/items/{id}',
  tags: ['Items'],
  summary: 'Update an item',
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            spaceId: z.string().uuid().nullable().optional(),
            parentId: z.string().uuid().nullable().optional(),
            name: z.string().min(1).optional(),
            category: z.string().min(1).optional(),
            manufacturer: z.string().nullable().optional(),
            model: z.string().nullable().optional(),
            serialNumber: z.string().nullable().optional(),
            acquiredDate: z.string().datetime().nullable().optional(),
            warrantyExpires: z.string().datetime().nullable().optional(),
            purchasePrice: z.number().positive().nullable().optional(),
            notes: z.string().nullable().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Item updated',
      content: {
        'application/json': {
          schema: ItemSchema,
        },
      },
    },
    404: {
      description: 'Item not found',
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
    },
  },
})

const deleteItem = createRoute({
  method: 'delete',
  path: '/items/{id}',
  tags: ['Items'],
  summary: 'Delete an item',
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
  },
  responses: {
    204: {
      description: 'Item deleted',
    },
    404: {
      description: 'Item not found',
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
    },
  },
})

// Helper to serialize dates
function serializeItem(item: any) {
  return {
    ...item,
    acquiredDate: item.acquiredDate?.toISOString() ?? null,
    warrantyExpires: item.warrantyExpires?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }
}

// Create router
export const itemsRouter = new OpenAPIHono<{ Variables: AuthContext }>()

itemsRouter.openapi(listItems, async (c) => {
  const userId = c.get('userId')
  const { propertyId } = c.req.valid('param')
  const { spaceId } = c.req.valid('query')

  const property = await propertyService.findById(propertyId, userId)
  if (!property) {
    return c.json({ error: 'not_found', message: 'Property not found' }, 404)
  }

  const items = spaceId
    ? await itemService.findAllForSpace(spaceId)
    : await itemService.findAllForProperty(propertyId)

  return c.json(items.map(serializeItem), 200)
})

itemsRouter.openapi(getItem, async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.valid('param')
  const item = await itemService.findById(id)

  if (!item) {
    return c.json({ error: 'not_found', message: 'Item not found' }, 404)
  }

  // Verify ownership through property
  const property = await propertyService.findById(item.propertyId, userId)
  if (!property) {
    return c.json({ error: 'not_found', message: 'Item not found' }, 404)
  }

  return c.json(serializeItem(item), 200)
})

itemsRouter.openapi(getItemChildren, async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.valid('param')

  const item = await itemService.findById(id)
  if (!item) {
    return c.json({ error: 'not_found', message: 'Item not found' }, 404)
  }

  // Verify ownership through property
  const property = await propertyService.findById(item.propertyId, userId)
  if (!property) {
    return c.json({ error: 'not_found', message: 'Item not found' }, 404)
  }

  const children = await itemService.findChildrenForItem(id)
  return c.json(children.map(serializeItem), 200)
})

itemsRouter.openapi(createItem, async (c) => {
  const userId = c.get('userId')
  const { propertyId } = c.req.valid('param')
  const body = c.req.valid('json')

  const property = await propertyService.findById(propertyId, userId)
  if (!property) {
    return c.json({ error: 'not_found', message: 'Property not found' }, 404)
  }

  const item = await itemService.create(userId, {
    propertyId,
    ...body,
    acquiredDate: body.acquiredDate ? new Date(body.acquiredDate) : undefined,
    warrantyExpires: body.warrantyExpires ? new Date(body.warrantyExpires) : undefined,
  })

  return c.json(serializeItem(item), 201)
})

itemsRouter.openapi(updateItem, async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.valid('param')
  const body = c.req.valid('json')

  const existing = await itemService.findById(id)
  if (!existing) {
    return c.json({ error: 'not_found', message: 'Item not found' }, 404)
  }

  // Verify ownership through property
  const property = await propertyService.findById(existing.propertyId, userId)
  if (!property) {
    return c.json({ error: 'not_found', message: 'Item not found' }, 404)
  }

  const item = await itemService.update(id, userId, {
    name: body.name,
    category: body.category,
    spaceId: body.spaceId ?? undefined,
    parentId: body.parentId ?? undefined,
    manufacturer: body.manufacturer ?? undefined,
    model: body.model ?? undefined,
    serialNumber: body.serialNumber ?? undefined,
    acquiredDate: body.acquiredDate ? new Date(body.acquiredDate) : undefined,
    warrantyExpires: body.warrantyExpires ? new Date(body.warrantyExpires) : undefined,
    purchasePrice: body.purchasePrice ?? undefined,
    notes: body.notes ?? undefined,
  })

  return c.json(serializeItem(item), 200)
})

itemsRouter.openapi(deleteItem, async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.valid('param')

  const existing = await itemService.findById(id)
  if (!existing) {
    return c.json({ error: 'not_found', message: 'Item not found' }, 404)
  }

  // Verify ownership through property
  const property = await propertyService.findById(existing.propertyId, userId)
  if (!property) {
    return c.json({ error: 'not_found', message: 'Item not found' }, 404)
  }

  await itemService.delete(id)
  return c.body(null, 204)
})
