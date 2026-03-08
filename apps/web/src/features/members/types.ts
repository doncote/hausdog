import { z } from 'zod'

export const MemberRole = z.enum(['owner', 'editor', 'viewer'])
export type MemberRole = z.infer<typeof MemberRole>

export const MemberStatus = z.enum(['pending', 'active', 'declined'])
export type MemberStatus = z.infer<typeof MemberStatus>

export const InviteMemberSchema = z.object({
  email: z.string().email('Valid email required'),
  role: MemberRole.exclude(['owner']),
})
export type InviteMemberInput = z.infer<typeof InviteMemberSchema>

export const UpdateMemberRoleSchema = z.object({
  role: MemberRole.exclude(['owner']),
})
export type UpdateMemberRoleInput = z.infer<typeof UpdateMemberRoleSchema>

export interface PropertyMember {
  id: string
  propertyId: string
  userId: string | null
  email: string
  role: MemberRole
  status: MemberStatus
  invitedById: string
  createdAt: Date
  updatedAt: Date
}

export interface PropertyAccess {
  isMember: boolean
  role: MemberRole | null
  canWrite: boolean
  canManageMembers: boolean
}
