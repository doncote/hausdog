import type { PrismaClient, PropertyMember as PrismaPropertyMember } from '@generated/prisma/client'
import type { Logger } from '@/lib/console-logger'
import type {
  InviteMemberInput,
  MemberRole,
  MemberStatus,
  PropertyAccess,
  PropertyMember,
  UpdateMemberRoleInput,
} from './types'

export interface PropertyMemberServiceDeps {
  db: PrismaClient
  logger: Logger
}

export class PropertyMemberService {
  private db: PrismaClient
  private logger: Logger

  constructor(deps: PropertyMemberServiceDeps) {
    this.db = deps.db
    this.logger = deps.logger
  }

  async findAllForProperty(propertyId: string): Promise<PropertyMember[]> {
    this.logger.debug('Finding all members for property', { propertyId })
    const records = await this.db.propertyMember.findMany({
      where: { propertyId },
      orderBy: { createdAt: 'asc' },
    })
    return records.map((r) => this.toDomain(r))
  }

  async getMembership(propertyId: string, userId: string): Promise<PropertyMember | null> {
    const record = await this.db.propertyMember.findFirst({
      where: { propertyId, userId, status: 'active' },
    })
    return record ? this.toDomain(record) : null
  }

  async getAccess(propertyId: string, userId: string, ownerId: string): Promise<PropertyAccess> {
    if (userId === ownerId) {
      return { isMember: true, role: 'owner', canWrite: true, canManageMembers: true }
    }
    const member = await this.getMembership(propertyId, userId)
    if (!member) {
      return { isMember: false, role: null, canWrite: false, canManageMembers: false }
    }
    return {
      isMember: true,
      role: member.role,
      canWrite: member.role === 'editor',
      canManageMembers: false,
    }
  }

  async findPendingForEmail(email: string): Promise<PropertyMember[]> {
    const records = await this.db.propertyMember.findMany({
      where: { email: email.toLowerCase(), status: 'pending' },
    })
    return records.map((r) => this.toDomain(r))
  }

  async invite(
    propertyId: string,
    invitedById: string,
    input: InviteMemberInput,
  ): Promise<PropertyMember> {
    this.logger.info('Inviting member to property', {
      propertyId,
      email: input.email,
      role: input.role,
    })
    const email = input.email.toLowerCase()
    const record = await this.db.propertyMember.upsert({
      where: { propertyId_email: { propertyId, email } },
      create: {
        propertyId,
        email,
        role: input.role,
        status: 'pending',
        invitedById,
      },
      update: {
        role: input.role,
        status: 'pending',
        invitedById,
        updatedAt: new Date(),
      },
    })
    return this.toDomain(record)
  }

  async accept(memberId: string, userId: string, userEmail: string): Promise<PropertyMember> {
    this.logger.info('Accepting property invitation', { memberId, userId })
    const record = await this.db.propertyMember.update({
      where: { id: memberId },
      data: { userId, status: 'active', email: userEmail.toLowerCase() },
    })
    return this.toDomain(record)
  }

  async decline(memberId: string): Promise<PropertyMember> {
    this.logger.info('Declining property invitation', { memberId })
    const record = await this.db.propertyMember.update({
      where: { id: memberId },
      data: { status: 'declined' },
    })
    return this.toDomain(record)
  }

  async updateRole(memberId: string, input: UpdateMemberRoleInput): Promise<PropertyMember> {
    this.logger.info('Updating member role', { memberId, role: input.role })
    const record = await this.db.propertyMember.update({
      where: { id: memberId },
      data: { role: input.role },
    })
    return this.toDomain(record)
  }

  async remove(memberId: string): Promise<void> {
    this.logger.info('Removing property member', { memberId })
    await this.db.propertyMember.delete({ where: { id: memberId } })
  }

  async activatePendingInvites(userId: string, userEmail: string): Promise<void> {
    this.logger.info('Activating pending invites for new user', { userId, userEmail })
    await this.db.propertyMember.updateMany({
      where: { email: userEmail.toLowerCase(), status: 'pending' },
      data: { userId, status: 'active' },
    })
  }

  private toDomain(record: PrismaPropertyMember): PropertyMember {
    return {
      id: record.id,
      propertyId: record.propertyId,
      userId: record.userId,
      email: record.email,
      role: record.role as MemberRole,
      status: record.status as MemberStatus,
      invitedById: record.invitedById,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }
  }
}
