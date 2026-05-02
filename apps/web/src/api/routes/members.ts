import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { ActivityService } from '@/features/activity/service'
import { PropertyMemberService } from '@/features/members/service'
import { PropertyService } from '@/features/properties/service'
import { consoleLogger as logger } from '@/lib/console-logger'
import { prisma } from '@/lib/db'
import { getUserEmail } from '@/lib/supabase-admin'
import type { AuthContext } from '../middleware/auth'

const memberService = new PropertyMemberService({ db: prisma, logger })
const propertyService = new PropertyService({ db: prisma, logger })
const activityService = new ActivityService(prisma)

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

const leaveMember = createRoute({
  method: 'post',
  path: '/members/{memberId}/leave',
  tags: ['Members'],
  summary: 'Leave a property (member removes themselves)',
  request: {
    params: z.object({ memberId: z.string().uuid() }),
  },
  responses: {
    204: { description: 'Left property successfully' },
    403: {
      description: 'Forbidden',
      content: { 'application/json': { schema: ErrorSchema } },
    },
    404: {
      description: 'Member not found',
      content: { 'application/json': { schema: ErrorSchema } },
    },
  },
})

const listInvites = createRoute({
  method: 'get',
  path: '/members/invites',
  tags: ['Members'],
  summary: 'List pending property invitations for the current user',
  responses: {
    200: {
      description: 'List of pending invitations',
      content: { 'application/json': { schema: z.array(MemberSchema) } },
    },
    503: {
      description: 'Email lookup unavailable',
      content: { 'application/json': { schema: ErrorSchema } },
    },
  },
})

const acceptInvite = createRoute({
  method: 'post',
  path: '/members/{memberId}/accept',
  tags: ['Members'],
  summary: 'Accept a pending property invitation',
  request: {
    params: z.object({ memberId: z.string().uuid() }),
  },
  responses: {
    200: {
      description: 'Invitation accepted',
      content: { 'application/json': { schema: MemberSchema } },
    },
    403: {
      description: 'Invitation does not belong to current user',
      content: { 'application/json': { schema: ErrorSchema } },
    },
    404: {
      description: 'Invitation not found or already resolved',
      content: { 'application/json': { schema: ErrorSchema } },
    },
  },
})

const declineInvite = createRoute({
  method: 'post',
  path: '/members/{memberId}/decline',
  tags: ['Members'],
  summary: 'Decline a pending property invitation',
  request: {
    params: z.object({ memberId: z.string().uuid() }),
  },
  responses: {
    200: {
      description: 'Invitation declined',
      content: { 'application/json': { schema: MemberSchema } },
    },
    403: {
      description: 'Invitation does not belong to current user',
      content: { 'application/json': { schema: ErrorSchema } },
    },
    404: {
      description: 'Invitation not found or already resolved',
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

membersRouter.openapi(leaveMember, async (c) => {
  const userId = c.get('userId')
  const { memberId } = c.req.valid('param')

  const existing = await prisma.propertyMember.findUnique({ where: { id: memberId } })
  if (!existing) {
    return c.json({ error: 'not_found', message: 'Member not found' }, 404)
  }

  if (existing.userId !== userId) {
    return c.json({ error: 'forbidden', message: 'You can only remove yourself' }, 403)
  }

  const isOwner = await propertyService.isOwner(existing.propertyId, userId)
  if (isOwner) {
    return c.json(
      { error: 'forbidden', message: 'Owners cannot leave; transfer ownership first' },
      403,
    )
  }

  await memberService.remove(memberId)
  return c.body(null, 204)
})

membersRouter.openapi(listInvites, async (c) => {
  const userId = c.get('userId')

  const userEmail = await getUserEmail(userId)
  if (!userEmail) {
    return c.json({ error: 'service_unavailable', message: 'Email lookup unavailable' }, 503)
  }

  const invites = await memberService.findPendingForEmail(userEmail)
  return c.json(invites.map(serializeMember), 200)
})

membersRouter.openapi(acceptInvite, async (c) => {
  const userId = c.get('userId')
  const { memberId } = c.req.valid('param')

  const existing = await prisma.propertyMember.findFirst({
    where: { id: memberId, status: 'pending' },
  })
  if (!existing) {
    return c.json({ error: 'not_found', message: 'Invitation not found or already resolved' }, 404)
  }

  const userEmail = await getUserEmail(userId)
  if (!userEmail || existing.email !== userEmail.toLowerCase()) {
    return c.json({ error: 'forbidden', message: 'This invitation is not for you' }, 403)
  }

  const member = await memberService.accept(memberId, userId, userEmail)

  activityService
    .record({
      propertyId: existing.propertyId,
      userId,
      action: 'accepted',
      entityType: 'member',
      entityId: member.id,
      entityName: member.email,
    })
    .catch(() => {})

  return c.json(serializeMember(member), 200)
})

membersRouter.openapi(declineInvite, async (c) => {
  const userId = c.get('userId')
  const { memberId } = c.req.valid('param')

  const existing = await prisma.propertyMember.findFirst({
    where: { id: memberId, status: 'pending' },
  })
  if (!existing) {
    return c.json({ error: 'not_found', message: 'Invitation not found or already resolved' }, 404)
  }

  const userEmail = await getUserEmail(userId)
  if (!userEmail || existing.email !== userEmail.toLowerCase()) {
    return c.json({ error: 'forbidden', message: 'This invitation is not for you' }, 403)
  }

  const member = await memberService.decline(memberId)

  activityService
    .record({
      propertyId: existing.propertyId,
      userId,
      action: 'declined',
      entityType: 'member',
      entityId: member.id,
      entityName: member.email,
    })
    .catch(() => {})

  return c.json(serializeMember(member), 200)
})
