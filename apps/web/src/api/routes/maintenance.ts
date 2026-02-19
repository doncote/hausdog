import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { ItemService } from '@/features/items/service'
import { MaintenanceService } from '@/features/maintenance/service'
import { PropertyService } from '@/features/properties/service'
import { consoleLogger as logger } from '@/lib/console-logger'
import { prisma } from '@/lib/db'
import type { AuthContext } from '../middleware/auth'

const maintenanceService = new MaintenanceService({ db: prisma, logger })
const itemService = new ItemService({ db: prisma, logger })
const propertyService = new PropertyService({ db: prisma, logger })

// Response schemas
const MaintenanceTaskSchema = z.object({
  id: z.string().uuid(),
  propertyId: z.string().uuid(),
  itemId: z.string().uuid().nullable(),
  name: z.string(),
  description: z.string().nullable(),
  intervalMonths: z.number().int(),
  nextDueDate: z.string().datetime(),
  lastCompletedAt: z.string().datetime().nullable(),
  source: z.string(),
  status: z.string(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

const MaintenanceTaskWithRelationsSchema = MaintenanceTaskSchema.extend({
  property: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
    })
    .optional(),
  item: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
    })
    .optional(),
})

const ErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
})

// Routes

const listMaintenanceForItem = createRoute({
  method: 'get',
  path: '/items/{itemId}/maintenance',
  tags: ['Maintenance'],
  summary: 'List maintenance tasks for an item',
  request: {
    params: z.object({
      itemId: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: 'List of maintenance tasks',
      content: {
        'application/json': {
          schema: z.array(MaintenanceTaskWithRelationsSchema),
        },
      },
    },
    404: {
      description: 'Item not found',
      content: {
        'application/json': { schema: ErrorSchema },
      },
    },
  },
})

const listUpcomingMaintenance = createRoute({
  method: 'get',
  path: '/maintenance/upcoming',
  tags: ['Maintenance'],
  summary: 'List upcoming maintenance tasks across all properties',
  request: {
    query: z.object({
      limit: z.coerce.number().int().min(1).max(100).optional().default(20),
    }),
  },
  responses: {
    200: {
      description: 'List of upcoming maintenance tasks',
      content: {
        'application/json': {
          schema: z.array(MaintenanceTaskWithRelationsSchema),
        },
      },
    },
  },
})

const getMaintenanceTask = createRoute({
  method: 'get',
  path: '/maintenance/{id}',
  tags: ['Maintenance'],
  summary: 'Get a maintenance task',
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: 'Maintenance task details',
      content: {
        'application/json': {
          schema: MaintenanceTaskWithRelationsSchema,
        },
      },
    },
    404: {
      description: 'Maintenance task not found',
      content: {
        'application/json': { schema: ErrorSchema },
      },
    },
  },
})

const createMaintenanceTask = createRoute({
  method: 'post',
  path: '/items/{itemId}/maintenance',
  tags: ['Maintenance'],
  summary: 'Create a maintenance task for an item',
  request: {
    params: z.object({
      itemId: z.string().uuid(),
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string().min(1, 'Name is required'),
            description: z.string().optional(),
            intervalMonths: z.number().int().min(1),
            nextDueDate: z.string().datetime(),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Maintenance task created',
      content: {
        'application/json': { schema: MaintenanceTaskSchema },
      },
    },
    404: {
      description: 'Item not found',
      content: {
        'application/json': { schema: ErrorSchema },
      },
    },
  },
})

const updateMaintenanceTask = createRoute({
  method: 'patch',
  path: '/maintenance/{id}',
  tags: ['Maintenance'],
  summary: 'Update a maintenance task',
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string().min(1).optional(),
            description: z.string().nullable().optional(),
            intervalMonths: z.number().int().min(1).optional(),
            nextDueDate: z.string().datetime().optional(),
            status: z.enum(['active', 'paused', 'dismissed']).optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Maintenance task updated',
      content: {
        'application/json': { schema: MaintenanceTaskSchema },
      },
    },
    404: {
      description: 'Maintenance task not found',
      content: {
        'application/json': { schema: ErrorSchema },
      },
    },
  },
})

const completeMaintenanceTask = createRoute({
  method: 'post',
  path: '/maintenance/{id}/complete',
  tags: ['Maintenance'],
  summary: 'Complete a maintenance task (records event, advances next due date)',
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            date: z.string().datetime(),
            cost: z.number().positive().optional(),
            performedBy: z.string().optional(),
            description: z.string().optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Maintenance task completed',
      content: {
        'application/json': { schema: MaintenanceTaskSchema },
      },
    },
    404: {
      description: 'Maintenance task not found',
      content: {
        'application/json': { schema: ErrorSchema },
      },
    },
  },
})

const snoozeMaintenanceTask = createRoute({
  method: 'post',
  path: '/maintenance/{id}/snooze',
  tags: ['Maintenance'],
  summary: 'Snooze a maintenance task (advances due date by one interval)',
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: 'Maintenance task snoozed',
      content: {
        'application/json': { schema: MaintenanceTaskSchema },
      },
    },
    404: {
      description: 'Maintenance task not found',
      content: {
        'application/json': { schema: ErrorSchema },
      },
    },
  },
})

const deleteMaintenanceTask = createRoute({
  method: 'delete',
  path: '/maintenance/{id}',
  tags: ['Maintenance'],
  summary: 'Delete a maintenance task',
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
  },
  responses: {
    204: {
      description: 'Maintenance task deleted',
    },
    404: {
      description: 'Maintenance task not found',
      content: {
        'application/json': { schema: ErrorSchema },
      },
    },
  },
})

const generateMaintenanceSuggestions = createRoute({
  method: 'post',
  path: '/items/{itemId}/maintenance/generate',
  tags: ['Maintenance'],
  summary: 'Generate AI maintenance suggestions for an item',
  description:
    'Uses Claude to suggest recurring maintenance tasks based on the item details. Tasks are created with nextDueDate set to now.',
  request: {
    params: z.object({
      itemId: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: 'Suggestions generated',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            method: z.enum(['trigger', 'inline']),
            count: z.number().int().optional(),
          }),
        },
      },
    },
    404: {
      description: 'Item not found',
      content: {
        'application/json': { schema: ErrorSchema },
      },
    },
  },
})

// Helper to serialize dates
function serializeTask(task: any) {
  return {
    ...task,
    nextDueDate:
      task.nextDueDate instanceof Date ? task.nextDueDate.toISOString() : task.nextDueDate,
    lastCompletedAt:
      task.lastCompletedAt instanceof Date
        ? task.lastCompletedAt.toISOString()
        : task.lastCompletedAt,
    createdAt: task.createdAt instanceof Date ? task.createdAt.toISOString() : task.createdAt,
    updatedAt: task.updatedAt instanceof Date ? task.updatedAt.toISOString() : task.updatedAt,
  }
}

// Helper to verify ownership of a maintenance task
async function verifyTaskOwnership(taskId: string, userId: string) {
  const task = await maintenanceService.findById(taskId)
  if (!task) return null
  const property = await propertyService.findById(task.propertyId, userId)
  if (!property) return null
  return task
}

// Create router
export const maintenanceRouter = new OpenAPIHono<{ Variables: AuthContext }>()

maintenanceRouter.openapi(listMaintenanceForItem, async (c) => {
  const userId = c.get('userId')
  const { itemId } = c.req.valid('param')

  const item = await itemService.findById(itemId)
  if (!item) {
    return c.json({ error: 'not_found', message: 'Item not found' }, 404)
  }

  const property = await propertyService.findById(item.propertyId, userId)
  if (!property) {
    return c.json({ error: 'not_found', message: 'Item not found' }, 404)
  }

  const tasks = await maintenanceService.findAllForItem(itemId)
  return c.json(tasks.map(serializeTask), 200)
})

maintenanceRouter.openapi(listUpcomingMaintenance, async (c) => {
  const userId = c.get('userId')
  const { limit } = c.req.valid('query')

  const properties = await prisma.property.findMany({
    where: { userId },
    select: { id: true },
  })
  const propertyIds = properties.map((p) => p.id)

  if (propertyIds.length === 0) {
    return c.json([], 200)
  }

  const tasks = await maintenanceService.findUpcoming(propertyIds, { limit })
  return c.json(tasks.map(serializeTask), 200)
})

maintenanceRouter.openapi(getMaintenanceTask, async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.valid('param')

  const task = await verifyTaskOwnership(id, userId)
  if (!task) {
    return c.json({ error: 'not_found', message: 'Maintenance task not found' }, 404)
  }

  return c.json(serializeTask(task), 200)
})

maintenanceRouter.openapi(createMaintenanceTask, async (c) => {
  const userId = c.get('userId')
  const { itemId } = c.req.valid('param')
  const body = c.req.valid('json')

  const item = await itemService.findById(itemId)
  if (!item) {
    return c.json({ error: 'not_found', message: 'Item not found' }, 404)
  }

  const property = await propertyService.findById(item.propertyId, userId)
  if (!property) {
    return c.json({ error: 'not_found', message: 'Item not found' }, 404)
  }

  const task = await maintenanceService.create(userId, {
    propertyId: item.propertyId,
    itemId,
    name: body.name,
    description: body.description,
    intervalMonths: body.intervalMonths,
    nextDueDate: new Date(body.nextDueDate),
  })

  return c.json(serializeTask(task), 201)
})

maintenanceRouter.openapi(updateMaintenanceTask, async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.valid('param')
  const body = c.req.valid('json')

  const existing = await verifyTaskOwnership(id, userId)
  if (!existing) {
    return c.json({ error: 'not_found', message: 'Maintenance task not found' }, 404)
  }

  const task = await maintenanceService.update(id, userId, {
    name: body.name,
    description: body.description ?? undefined,
    intervalMonths: body.intervalMonths,
    nextDueDate: body.nextDueDate ? new Date(body.nextDueDate) : undefined,
    status: body.status,
  })

  return c.json(serializeTask(task), 200)
})

maintenanceRouter.openapi(completeMaintenanceTask, async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.valid('param')
  const body = c.req.valid('json')

  const existing = await verifyTaskOwnership(id, userId)
  if (!existing) {
    return c.json({ error: 'not_found', message: 'Maintenance task not found' }, 404)
  }

  const task = await maintenanceService.complete(id, userId, {
    date: new Date(body.date),
    cost: body.cost,
    performedBy: body.performedBy,
    description: body.description,
  })

  return c.json(serializeTask(task), 200)
})

maintenanceRouter.openapi(snoozeMaintenanceTask, async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.valid('param')

  const existing = await verifyTaskOwnership(id, userId)
  if (!existing) {
    return c.json({ error: 'not_found', message: 'Maintenance task not found' }, 404)
  }

  const task = await maintenanceService.snooze(id, userId)
  return c.json(serializeTask(task), 200)
})

maintenanceRouter.openapi(deleteMaintenanceTask, async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.valid('param')

  const existing = await verifyTaskOwnership(id, userId)
  if (!existing) {
    return c.json({ error: 'not_found', message: 'Maintenance task not found' }, 404)
  }

  await maintenanceService.delete(id)
  return c.body(null, 204)
})

maintenanceRouter.openapi(generateMaintenanceSuggestions, async (c) => {
  const userId = c.get('userId')
  const { itemId } = c.req.valid('param')

  const item = await itemService.findById(itemId)
  if (!item) {
    return c.json({ error: 'not_found', message: 'Item not found' }, 404)
  }

  const property = await propertyService.findById(item.propertyId, userId)
  if (!property) {
    return c.json({ error: 'not_found', message: 'Item not found' }, 404)
  }

  try {
    const { tasks } = await import('@trigger.dev/sdk/v3')
    await tasks.trigger('suggest-maintenance', { itemId, userId })
    return c.json({ success: true, method: 'trigger' as const }, 200)
  } catch {
    // Trigger.dev not available — run inline
    const { suggestMaintenanceWithClaude } = await import('@/lib/llm/claude')

    const suggestions = await suggestMaintenanceWithClaude({
      name: item.name,
      category: item.category,
      manufacturer: item.manufacturer,
      model: item.model,
      acquiredDate: item.acquiredDate,
      notes: item.notes,
    })

    await maintenanceService.createFromAI(userId, item.propertyId, item.id, suggestions)

    return c.json({ success: true, method: 'inline' as const, count: suggestions.length }, 200)
  }
})
