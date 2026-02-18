import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { EventService } from '@/features/events/service'
import { ItemService } from '@/features/items/service'
import { PropertyService } from '@/features/properties/service'
import { consoleLogger as logger } from '@/lib/console-logger'
import { prisma } from '@/lib/db'
import type { AuthContext } from '../middleware/auth'

const eventService = new EventService({ db: prisma, logger })
const itemService = new ItemService({ db: prisma, logger })
const propertyService = new PropertyService({ db: prisma, logger })

// Response schemas
const EventSchema = z.object({
  id: z.string().uuid(),
  itemId: z.string().uuid(),
  type: z.string(),
  date: z.string().datetime(),
  description: z.string().nullable(),
  cost: z.number().nullable(),
  performedBy: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

const EventWithRelationsSchema = EventSchema.extend({
  item: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
    })
    .optional(),
  _count: z
    .object({
      documents: z.number(),
    })
    .optional(),
})

const ErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
})

// Routes
const listEvents = createRoute({
  method: 'get',
  path: '/items/{itemId}/events',
  tags: ['Events'],
  summary: 'List events for an item',
  request: {
    params: z.object({
      itemId: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: 'List of events',
      content: {
        'application/json': {
          schema: z.array(EventWithRelationsSchema),
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

const getEvent = createRoute({
  method: 'get',
  path: '/events/{id}',
  tags: ['Events'],
  summary: 'Get an event',
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: 'Event details',
      content: {
        'application/json': {
          schema: EventWithRelationsSchema,
        },
      },
    },
    404: {
      description: 'Event not found',
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
    },
  },
})

const createEvent = createRoute({
  method: 'post',
  path: '/items/{itemId}/events',
  tags: ['Events'],
  summary: 'Create an event',
  request: {
    params: z.object({
      itemId: z.string().uuid(),
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            type: z.string().min(1, 'Type is required'),
            date: z.string().datetime(),
            description: z.string().optional(),
            cost: z.number().positive().optional(),
            performedBy: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Event created',
      content: {
        'application/json': {
          schema: EventSchema,
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

const updateEvent = createRoute({
  method: 'patch',
  path: '/events/{id}',
  tags: ['Events'],
  summary: 'Update an event',
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            type: z.string().min(1).optional(),
            date: z.string().datetime().optional(),
            description: z.string().nullable().optional(),
            cost: z.number().positive().nullable().optional(),
            performedBy: z.string().nullable().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Event updated',
      content: {
        'application/json': {
          schema: EventSchema,
        },
      },
    },
    404: {
      description: 'Event not found',
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
    },
  },
})

const deleteEvent = createRoute({
  method: 'delete',
  path: '/events/{id}',
  tags: ['Events'],
  summary: 'Delete an event',
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
  },
  responses: {
    204: {
      description: 'Event deleted',
    },
    404: {
      description: 'Event not found',
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
    },
  },
})

// Helper to serialize dates
function serializeEvent(event: any) {
  return {
    ...event,
    date: event.date.toISOString(),
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  }
}

// Create router
export const eventsRouter = new OpenAPIHono<{ Variables: AuthContext }>()

eventsRouter.openapi(listEvents, async (c) => {
  const userId = c.get('userId')
  const { itemId } = c.req.valid('param')

  const item = await itemService.findById(itemId)
  if (!item) {
    return c.json({ error: 'not_found', message: 'Item not found' }, 404)
  }

  // Verify ownership through property
  const property = await propertyService.findById(item.propertyId, userId)
  if (!property) {
    return c.json({ error: 'not_found', message: 'Item not found' }, 404)
  }

  const events = await eventService.findAllForItem(itemId)
  return c.json(events.map(serializeEvent), 200)
})

eventsRouter.openapi(getEvent, async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.valid('param')
  const event = await eventService.findById(id)

  if (!event) {
    return c.json({ error: 'not_found', message: 'Event not found' }, 404)
  }

  // Verify ownership through item -> property chain
  const item = await itemService.findById(event.itemId)
  if (!item) {
    return c.json({ error: 'not_found', message: 'Event not found' }, 404)
  }
  const property = await propertyService.findById(item.propertyId, userId)
  if (!property) {
    return c.json({ error: 'not_found', message: 'Event not found' }, 404)
  }

  return c.json(serializeEvent(event), 200)
})

eventsRouter.openapi(createEvent, async (c) => {
  const userId = c.get('userId')
  const { itemId } = c.req.valid('param')
  const body = c.req.valid('json')

  const item = await itemService.findById(itemId)
  if (!item) {
    return c.json({ error: 'not_found', message: 'Item not found' }, 404)
  }

  // Verify ownership through property
  const property = await propertyService.findById(item.propertyId, userId)
  if (!property) {
    return c.json({ error: 'not_found', message: 'Item not found' }, 404)
  }

  const event = await eventService.create(userId, {
    itemId,
    ...body,
    date: new Date(body.date),
  })

  return c.json(serializeEvent(event), 201)
})

eventsRouter.openapi(updateEvent, async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.valid('param')
  const body = c.req.valid('json')

  const existing = await eventService.findById(id)
  if (!existing) {
    return c.json({ error: 'not_found', message: 'Event not found' }, 404)
  }

  // Verify ownership through item -> property chain
  const item = await itemService.findById(existing.itemId)
  if (!item) {
    return c.json({ error: 'not_found', message: 'Event not found' }, 404)
  }
  const property = await propertyService.findById(item.propertyId, userId)
  if (!property) {
    return c.json({ error: 'not_found', message: 'Event not found' }, 404)
  }

  const event = await eventService.update(id, userId, {
    type: body.type,
    date: body.date ? new Date(body.date) : undefined,
    description: body.description ?? undefined,
    cost: body.cost ?? undefined,
    performedBy: body.performedBy ?? undefined,
  })

  return c.json(serializeEvent(event), 200)
})

eventsRouter.openapi(deleteEvent, async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.valid('param')

  const existing = await eventService.findById(id)
  if (!existing) {
    return c.json({ error: 'not_found', message: 'Event not found' }, 404)
  }

  // Verify ownership through item -> property chain
  const item = await itemService.findById(existing.itemId)
  if (!item) {
    return c.json({ error: 'not_found', message: 'Event not found' }, 404)
  }
  const property = await propertyService.findById(item.propertyId, userId)
  if (!property) {
    return c.json({ error: 'not_found', message: 'Event not found' }, 404)
  }

  await eventService.delete(id)
  return c.body(null, 204)
})
