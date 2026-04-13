import { describe, expect, it } from 'vitest'
import { InviteMemberSchema, MemberRole, UpdateMemberRoleSchema } from './types'

describe('InviteMemberSchema', () => {
  it('accepts valid email and editor role', () => {
    const result = InviteMemberSchema.safeParse({
      email: 'user@example.com',
      role: 'editor',
    })
    expect(result.success).toBe(true)
  })

  it('accepts viewer role', () => {
    const result = InviteMemberSchema.safeParse({
      email: 'user@example.com',
      role: 'viewer',
    })
    expect(result.success).toBe(true)
  })

  it('rejects owner role (cannot invite as owner)', () => {
    const result = InviteMemberSchema.safeParse({
      email: 'user@example.com',
      role: 'owner',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid email', () => {
    const result = InviteMemberSchema.safeParse({
      email: 'not-an-email',
      role: 'editor',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty email', () => {
    const result = InviteMemberSchema.safeParse({
      email: '',
      role: 'editor',
    })
    expect(result.success).toBe(false)
  })

  it('rejects unknown role', () => {
    const result = InviteMemberSchema.safeParse({
      email: 'user@example.com',
      role: 'admin',
    })
    expect(result.success).toBe(false)
  })
})

describe('UpdateMemberRoleSchema', () => {
  it('accepts editor role', () => {
    const result = UpdateMemberRoleSchema.safeParse({ role: 'editor' })
    expect(result.success).toBe(true)
  })

  it('accepts viewer role', () => {
    const result = UpdateMemberRoleSchema.safeParse({ role: 'viewer' })
    expect(result.success).toBe(true)
  })

  it('rejects owner role (cannot set member to owner)', () => {
    const result = UpdateMemberRoleSchema.safeParse({ role: 'owner' })
    expect(result.success).toBe(false)
  })

  it('rejects missing role', () => {
    const result = UpdateMemberRoleSchema.safeParse({})
    expect(result.success).toBe(false)
  })
})

describe('MemberRole', () => {
  it('includes owner, editor, viewer', () => {
    const result = MemberRole.safeParse('owner')
    expect(result.success).toBe(true)
  })

  it('rejects unknown roles', () => {
    const result = MemberRole.safeParse('superadmin')
    expect(result.success).toBe(false)
  })
})
