import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { getServerEnv } from '@/lib/env'
import { createLatticeClient } from '../services/lattice-client'
import type { AuthContext } from '../middleware/auth'

const LatticeIssueSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  status: z.string(),
  priority: z.number().int(),
  issue_type: z.string(),
  assignee: z.string().optional(),
  labels: z.array(z.string()).optional(),
  team: z.string().optional(),
  created_at: z.string(),
  updated_at: z.string(),
})

const ErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
})

const listWorkIssues = createRoute({
  method: 'get',
  path: '/companies/{companyId}/work/issues',
  tags: ['Work'],
  security: [{ bearerAuth: [] }],
  request: {
    params: z.object({
      companyId: z.string().openapi({ description: 'Company (org) identifier' }),
    }),
    query: z.object({
      status: z
        .string()
        .optional()
        .openapi({ description: 'Comma-separated statuses (e.g. in_progress,review)' }),
      assignee: z.string().optional().openapi({ description: 'Filter by assignee' }),
      priority: z
        .string()
        .regex(/^[0-4]$/)
        .optional()
        .openapi({ description: 'Priority 0-4' }),
      limit: z
        .string()
        .regex(/^\d+$/)
        .optional()
        .openapi({ description: 'Max results (default 50)' }),
      cursor: z.string().optional().openapi({ description: 'Pagination cursor' }),
    }),
  },
  responses: {
    200: {
      content: {
        'application/json': {
          schema: z.object({
            issues: z.array(LatticeIssueSchema),
            cursor: z.string().optional(),
          }),
        },
      },
      description: 'Issues scoped to the company org label',
    },
    403: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Caller does not have access to this company',
    },
    503: {
      content: { 'application/json': { schema: ErrorSchema } },
      description: 'Lattice integration not configured',
    },
  },
})

export const workRouter = new OpenAPIHono<{ Variables: AuthContext }>()

workRouter.openapi(listWorkIssues, async (c) => {
  const userId = c.get('userId')
  const { companyId } = c.req.valid('param')

  if (userId !== companyId) {
    return c.json({ error: 'forbidden', message: 'Access denied for this company' }, 403)
  }

  const env = getServerEnv()
  if (!env.LATTICE_API_URL || !env.LATTICE_API_KEY) {
    return c.json({ error: 'not_configured', message: 'Lattice integration is not configured' }, 503)
  }

  const query = c.req.valid('query')
  const client = createLatticeClient(env.LATTICE_API_URL, env.LATTICE_API_KEY)

  const issues = await client.listIssues({
    status: query.status ? query.status.split(',').map((s) => s.trim()) : undefined,
    assignee: query.assignee,
    priority: query.priority !== undefined ? Number(query.priority) : undefined,
    limit: query.limit ? Number(query.limit) : 50,
    cursor: query.cursor,
    labels_any: [`org:${companyId}`],
  })

  return c.json({ issues }, 200)
})
