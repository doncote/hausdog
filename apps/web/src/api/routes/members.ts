import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { PropertyMemberService } from '@/features/members/service'
import { PropertyService } from '@/features/properties/service'
import { consoleLogger as logger } from '@/lib/console-logger'
import { prisma } from '@/lib/db'
import type { AuthContext } from '../middleware/auth'

const memberService = new PropertyMemberService({ db: prisma, logger })
const propertyService = new PropertyService({ db: prisma, logger })

// Schemas
const MemberSchema = z.object({
  id: z.string().uuid(),
  propertyId: z.string().uuid(),
  userId: z.string().uuid().nullable(),
  email: z.string().email(),
  role: z.enum(['owner', 'editor', 'viewer']),
  status: z.enum(['pending', 'active', 'declined']),
  invitedById: z.string().uuid(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

const ErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
})

// Route definitions
const listMembers = createRoute({
  method: 'get',
  path: '/properties/{propertyId}/members',
  tags: ['Members'],
  summary: 'List members of a property',
  request: {
    params: z.object({ propertyId: z.string().uuid() }),
  },
  responses: {
    200: {
      description: 'List of property members',
      content: { 'application/json': { schema: z.array(MemberSchema) } },
    },
    404: {
      description: 'Property not found',
      content: { 'application/json': { schema: ErrorSchema } },
    },
  },
})

const inviteMember = createRoute({
  method: 'post',
  path: '/properties/{propertyId}/members',
  tags: ['Members'],
  summary: 'Invite a member to a property (owner only)',
  request: {
    params: z.object({ propertyId: z.string().uuid() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({
            email: z.string().email('Valid email required'),
            role: z.enum(['editor', 'viewer']),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Member invited',
      content: { 'application/json': { schema: MemberSchema } },
    },
    404: {
      description: 'Property not found',
      content: { 'application/json': { schema: ErrorSchema } },
    },
  },
})

const updateMemberRole = createRoute({
  method: 'patch',
  path: '/members/{memberId}',
  tags: ['Members'],
  summary: 'Update a member role (owner only)',
  request: {
    params: z.object({ memberId: z.string().uuid() }),
    body: {
      content: {
        'application/json': {
          schema: z.object({ role: z.enum(['editor', 'viewer']) }),
        },
      },
    },
  },
  responses: {
    200: {
      description: 'Member role updated',
      content: { 'application/json': { schema: MemberSchema } },
    },
    404: {
      description: 'Member not found',
      content: { 'application/json': { schema: ErrorSchema } },
    },
  },
})

const removeMember = createRoute({
  method: 'delete',
  path: '/members/{memberId}',
  tags: ['Members'],
  summary: 'Remove a member from a property (owner only)',
  request: {
    params: z.object({ memberId: z.string().uuid() }),
  },
  responses: {
    204: { description: 'Member removed' },
    404: {
      description: 'Member not found',
      content: { 'application/json': { schema: ErrorSchema } },
    },
  },
})

// Helpers
function serializeMember(m: {
  id: string
  propertyId: string
  userId: string | null
  email: string
  role: string
  status: string
  invitedById: string
  createdAt: Date
  updatedAt: Date
}) {
  return {
    ...m,
    createdAt: m.createdAt.toISOString(),
    updatedAt: m.updatedAt.toISOString(),
  }
}

// Router
export const membersRouter = new OpenAPIHono<{ Variables: AuthContext }>()

membersRouter.openapi(listMembers, async (c) => {
  const userId = c.get('userId')
  const { propertyId } = c.req.valid('param')

  const property = await propertyService.findById(propertyId, userId)
  if (!property) {
    return c.json({ error: 'not_found', message: 'Property not found' }, 404)
  }

  const members = await memberService.findAllForProperty(propertyId)
  return c.json(members.map(serializeMember), 200)
})

membersRouter.openapi(inviteMember, async (c) => {
  const userId = c.get('userId')
  const { propertyId } = c.req.valid('param')
  const { email, role } = c.req.valid('json')

  const isOwner = await propertyService.isOwner(propertyId, userId)
  if (!isOwner) {
    return c.json({ error: 'not_found', message: 'Property not found' }, 404)
  }

  const member = await memberService.invite(propertyId, userId, { email, role })
  return c.json(serializeMember(member), 201)
})

membersRouter.openapi(updateMemberRole, async (c) => {
  const userId = c.get('userId')
  const { memberId } = c.req.valid('param')
  const { role } = c.req.valid('json')

  const existing = await prisma.propertyMember.findUnique({ where: { id: memberId } })
  if (!existing) {
    return c.json({ error: 'not_found', message: 'Member not found' }, 404)
  }

  const isOwner = await propertyService.isOwner(existing.propertyId, userId)
  if (!isOwner) {
    return c.json({ error: 'not_found', message: 'Member not found' }, 404)
  }

  const member = await memberService.updateRole(memberId, { role })
  return c.json(serializeMember(member), 200)
})

membersRouter.openapi(removeMember, async (c) => {
  const userId = c.get('userId')
  const { memberId } = c.req.valid('param')

  const existing = await prisma.propertyMember.findUnique({ where: { id: memberId } })
  if (!existing) {
    return c.json({ error: 'not_found', message: 'Member not found' }, 404)
  }

  const isOwner = await propertyService.isOwner(existing.propertyId, userId)
  if (!isOwner) {
    return c.json({ error: 'not_found', message: 'Member not found' }, 404)
  }

  await memberService.remove(memberId)
  return c.body(null, 204)
})
