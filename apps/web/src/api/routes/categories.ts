import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { CategoryService } from '@/features/categories/service'
import { consoleLogger as logger } from '@/lib/console-logger'
import { prisma } from '@/lib/db'
import type { AuthContext } from '../middleware/auth'

const categoryService = new CategoryService({ db: prisma, logger })

// Response schemas
const CategorySchema = z.object({
  id: z.string().uuid(),
  slug: z.string(),
  name: z.string(),
  icon: z.string().nullable(),
  isSystem: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

const ErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
})

// Routes
const listCategories = createRoute({
  method: 'get',
  path: '/categories',
  tags: ['Categories'],
  summary: 'List all categories (system + user custom)',
  responses: {
    200: {
      description: 'List of categories',
      content: {
        'application/json': {
          schema: z.array(CategorySchema),
        },
      },
    },
  },
})

const createCategory = createRoute({
  method: 'post',
  path: '/categories',
  tags: ['Categories'],
  summary: 'Create a custom category',
  request: {
    body: {
      content: {
        'application/json': {
          schema: z.object({
            slug: z
              .string()
              .min(1)
              .max(50)
              .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
            name: z.string().min(1, 'Name is required').max(100),
            icon: z.string().max(50).optional(),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Category created',
      content: {
        'application/json': {
          schema: CategorySchema,
        },
      },
    },
    409: {
      description: 'Slug already taken',
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
    },
  },
})

const updateCategory = createRoute({
  method: 'patch',
  path: '/categories/{id}',
  tags: ['Categories'],
  summary: 'Update a custom category',
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            name: z.string().min(1).max(100).optional(),
            icon: z.string().max(50).optional(),
          }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Category updated',
      content: {
        'application/json': {
          schema: CategorySchema,
        },
      },
    },
    403: {
      description: 'Cannot modify system category',
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
    },
    404: {
      description: 'Category not found',
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
    },
  },
})

const deleteCategory = createRoute({
  method: 'delete',
  path: '/categories/{id}',
  tags: ['Categories'],
  summary: 'Delete a custom category',
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
  },
  responses: {
    204: {
      description: 'Category deleted',
    },
    403: {
      description: 'Cannot delete system category',
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
    },
    404: {
      description: 'Category not found',
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
    },
    409: {
      description: 'Category is in use by items',
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
    },
  },
})

function serializeCategory(cat: any) {
  return {
    id: cat.id,
    slug: cat.slug,
    name: cat.name,
    icon: cat.icon,
    isSystem: cat.isSystem,
    createdAt: cat.createdAt.toISOString(),
    updatedAt: cat.updatedAt.toISOString(),
  }
}

// Create router
export const categoriesRouter = new OpenAPIHono<{ Variables: AuthContext }>()

categoriesRouter.openapi(listCategories, async (c) => {
  const userId = c.get('userId')
  const categories = await categoryService.findAllForUser(userId)
  return c.json(categories.map(serializeCategory), 200)
})

categoriesRouter.openapi(createCategory, async (c) => {
  const userId = c.get('userId')
  const body = c.req.valid('json')

  const taken = await categoryService.isSlugTaken(body.slug, userId)
  if (taken) {
    return c.json({ error: 'conflict', message: 'Category slug already exists' }, 409)
  }

  const category = await categoryService.create(userId, body)
  return c.json(serializeCategory(category), 201)
})

categoriesRouter.openapi(updateCategory, async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.valid('param')
  const body = c.req.valid('json')

  const existing = await categoryService.findById(id)
  if (!existing) {
    return c.json({ error: 'not_found', message: 'Category not found' }, 404)
  }

  if (existing.isSystem || existing.userId !== userId) {
    return c.json({ error: 'forbidden', message: 'Cannot modify system categories' }, 403)
  }

  const category = await categoryService.update(id, body)
  return c.json(serializeCategory(category), 200)
})

categoriesRouter.openapi(deleteCategory, async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.valid('param')

  const existing = await categoryService.findById(id)
  if (!existing) {
    return c.json({ error: 'not_found', message: 'Category not found' }, 404)
  }

  if (existing.isSystem || existing.userId !== userId) {
    return c.json({ error: 'forbidden', message: 'Cannot delete system categories' }, 403)
  }

  const inUse = await categoryService.isCategoryInUse(existing.slug)
  if (inUse) {
    return c.json(
      { error: 'conflict', message: 'Category is in use by items and cannot be deleted' },
      409,
    )
  }

  await categoryService.delete(id)
  return c.body(null, 204)
})
