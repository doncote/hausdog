import { createServerFn } from '@tanstack/react-start'
import type { z } from 'zod'
import { ActivityService } from '@/features/activity/service'
import { PropertyService } from '@/features/properties/service'
import { consoleLogger as logger } from '@/lib/console-logger'
import { prisma } from '@/lib/db/client'
import { sendPropertyInviteEmail } from '@/lib/email/transactional'
import { getBaseUrl } from '@/lib/env'
import { getSafeSession } from '@/lib/supabase'
import { getUserEmail } from '@/lib/supabase-admin'
import { PropertyMemberService } from './service'
import { InviteMemberSchema, UpdateMemberRoleSchema } from './types'

const getMemberService = () => new PropertyMemberService({ db: prisma, logger })
const getPropertyService = () => new PropertyService({ db: prisma, logger })
const getActivityService = () => new ActivityService(prisma)

export const fetchPropertyMembers = createServerFn({ method: 'GET' })
  .inputValidator((d: { propertyId: string }) => d)
  .handler(async ({ data }) => {
    const { user } = await getSafeSession()
    if (!user) throw new Error('Unauthorized')
    const propertyService = getPropertyService()
    const property = await propertyService.findById(data.propertyId, user.id)
    if (!property) throw new Error('Property not found or access denied')
    return getMemberService().findAllForProperty(data.propertyId)
  })

export const fetchPendingInvites = createServerFn({ method: 'GET' })
  .inputValidator((d: Record<string, never>) => d)
  .handler(async () => {
    const { user } = await getSafeSession()
    if (!user) throw new Error('Unauthorized')
    if (!user.email) throw new Error('User email not available')
    return getMemberService().findPendingForEmail(user.email)
  })

export const inviteMember = createServerFn({ method: 'POST' })
  .inputValidator(
    (d: { propertyId: string; userId: string; input: z.infer<typeof InviteMemberSchema> }) => d,
  )
  .handler(async ({ data }) => {
    const propertyService = getPropertyService()
    const isOwner = await propertyService.isOwner(data.propertyId, data.userId)
    if (!isOwner) throw new Error('Only the property owner can invite members')
    const input = InviteMemberSchema.parse(data.input)
    const member = await getMemberService().invite(data.propertyId, data.userId, input)

    getActivityService()
      .record({
        propertyId: data.propertyId,
        userId: data.userId,
        action: 'invited',
        entityType: 'member',
        entityId: member.id,
        entityName: member.email,
      })
      .catch(() => {})

    // Send invite email fire-and-forget — never block the response
    Promise.all([
      prisma.property.findUnique({
        where: { id: data.propertyId },
        select: { name: true },
      }),
      getUserEmail(data.userId),
    ])
      .then(([property, inviterEmail]) => {
        if (!inviterEmail) return
        return sendPropertyInviteEmail({
          to: input.email,
          inviterEmail,
          propertyName: property?.name ?? 'a property',
          role: input.role,
          acceptUrl: `${getBaseUrl()}/dashboard`,
        })
      })
      .catch((err: unknown) => {
        logger.warn('Failed to send invite email', {
          error: err instanceof Error ? err.message : 'unknown',
        })
      })

    return member
  })

export const acceptInvite = createServerFn({ method: 'POST' })
  .inputValidator((d: { memberId: string; userId: string; userEmail: string }) => d)
  .handler(async ({ data }) => {
    const memberService = getMemberService()
    const pending = await prisma.propertyMember.findFirst({
      where: { id: data.memberId, status: 'pending' },
    })
    if (!pending) throw new Error('Invitation not found or already resolved')
    const member = await memberService.accept(data.memberId, data.userId, data.userEmail)

    getActivityService()
      .record({
        propertyId: pending.propertyId,
        userId: data.userId,
        action: 'accepted',
        entityType: 'member',
        entityId: member.id,
        entityName: member.email,
      })
      .catch(() => {})

    return member
  })

export const declineInvite = createServerFn({ method: 'POST' })
  .inputValidator((d: { memberId: string; userId: string }) => d)
  .handler(async ({ data }) => {
    const pending = await prisma.propertyMember.findFirst({
      where: { id: data.memberId, status: 'pending' },
    })
    if (!pending) throw new Error('Invitation not found or already resolved')
    const member = await getMemberService().decline(data.memberId)

    getActivityService()
      .record({
        propertyId: pending.propertyId,
        userId: data.userId,
        action: 'declined',
        entityType: 'member',
        entityId: member.id,
        entityName: member.email,
      })
      .catch(() => {})

    return member
  })

export const updateMemberRole = createServerFn({ method: 'POST' })
  .inputValidator(
    (d: {
      memberId: string
      propertyId: string
      requestingUserId: string
      input: z.infer<typeof UpdateMemberRoleSchema>
    }) => d,
  )
  .handler(async ({ data }) => {
    const propertyService = getPropertyService()
    const isOwner = await propertyService.isOwner(data.propertyId, data.requestingUserId)
    if (!isOwner) throw new Error('Only the property owner can change member roles')
    const input = UpdateMemberRoleSchema.parse(data.input)
    return getMemberService().updateRole(data.memberId, input)
  })

export const removeMember = createServerFn({ method: 'POST' })
  .inputValidator((d: { memberId: string; propertyId: string; requestingUserId: string }) => d)
  .handler(async ({ data }) => {
    const propertyService = getPropertyService()
    const isOwner = await propertyService.isOwner(data.propertyId, data.requestingUserId)
    if (!isOwner) throw new Error('Only the property owner can remove members')
    const memberService = getMemberService()
    const member = await prisma.propertyMember.findUnique({ where: { id: data.memberId } })
    await memberService.remove(data.memberId)

    if (member) {
      getActivityService()
        .record({
          propertyId: data.propertyId,
          userId: data.requestingUserId,
          action: 'removed',
          entityType: 'member',
          entityId: data.memberId,
          entityName: member.email,
        })
        .catch(() => {})
    }

    return { success: true }
  })
