import { OpenAPIHono } from '@hono/zod-openapi'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const mockPrisma = vi.hoisted(() => ({
  propertyMember: { findUnique: vi.fn(), findFirst: vi.fn() },
}))
vi.mock('@/lib/db', () => ({ prisma: mockPrisma }))

const mockGetUserEmail = vi.hoisted(() => vi.fn())
vi.mock('@/lib/supabase-admin', () => ({ getUserEmail: mockGetUserEmail }))
vi.mock('@/lib/console-logger', () => ({
  consoleLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const mockActivityService = vi.hoisted(() => ({ record: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/features/activity/service', () => ({
  ActivityService: vi.fn().mockImplementation(() => mockActivityService),
}))

const mockMemberService = vi.hoisted(() => ({
  findAllForProperty: vi.fn(),
  findPendingForEmail: vi.fn(),
  invite: vi.fn(),
  accept: vi.fn(),
  decline: vi.fn(),
  updateRole: vi.fn(),
  remove: vi.fn(),
}))

const mockPropertyService = vi.hoisted(() => ({
  findById: vi.fn(),
  isOwner: vi.fn(),
}))

vi.mock('@/features/members/service', () => ({
  PropertyMemberService: vi.fn().mockImplementation(() => mockMemberService),
}))

vi.mock('@/features/properties/service', () => ({
  PropertyService: vi.fn().mockImplementation(() => mockPropertyService),
}))

import type { AuthContext } from '../middleware/auth'
import { membersRouter } from './members'

const USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const PROP_ID = '550e8400-e29b-41d4-a716-446655440000'
const MEMBER_ID = '550e8400-e29b-41d4-a716-446655440001'
const MISSING_ID = '12345678-1234-4234-8234-123456789012'

function makeApp() {
  const app = new OpenAPIHono<{ Variables: AuthContext }>()
  app.use('*', async (c, next) => {
    c.set('userId', USER_ID)
    c.set('apiKeyId', '550e8400-e29b-41d4-a716-446655440099')
    c.set('apiKeyName', 'test')
    await next()
  })
  app.route('/', membersRouter)
  return app
}

function makeMember(overrides: Record<string, unknown> = {}) {
  return {
    id: MEMBER_ID,
    propertyId: PROP_ID,
    userId: null,
    email: 'alice@example.com',
    role: 'viewer',
    status: 'pending',
    invitedById: USER_ID,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    ...overrides,
  }
}

function makeProperty() {
  return { id: PROP_ID, userId: USER_ID, name: 'My Home' }
}

describe('GET /properties/:propertyId/members', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns member list for accessible property', async () => {
    mockPropertyService.findById.mockResolvedValue(makeProperty())
    mockMemberService.findAllForProperty.mockResolvedValue([makeMember()])

    const res = await makeApp().request(`/properties/${PROP_ID}/members`)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveLength(1)
    expect(body[0].email).toBe('alice@example.com')
    expect(body[0].createdAt).toBe('2026-01-01T00:00:00.000Z')
  })

  it('returns 404 when property not found or inaccessible', async () => {
    mockPropertyService.findById.mockResolvedValue(null)

    const res = await makeApp().request(`/properties/${MISSING_ID}/members`)

    expect(res.status).toBe(404)
  })

  it('queries service with correct propertyId', async () => {
    mockPropertyService.findById.mockResolvedValue(makeProperty())
    mockMemberService.findAllForProperty.mockResolvedValue([])

    await makeApp().request(`/properties/${PROP_ID}/members`)

    expect(mockMemberService.findAllForProperty).toHaveBeenCalledWith(PROP_ID)
  })
})

describe('POST /properties/:propertyId/members', () => {
  beforeEach(() => vi.clearAllMocks())

  it('invites member and returns 201', async () => {
    mockPropertyService.isOwner.mockResolvedValue(true)
    mockMemberService.invite.mockResolvedValue(makeMember())

    const res = await makeApp().request(`/properties/${PROP_ID}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@example.com', role: 'viewer' }),
    })

    expect(res.status).toBe(201)
    const body = await res.json()
    expect(body.email).toBe('alice@example.com')
    expect(body.role).toBe('viewer')
  })

  it('returns 404 when caller is not owner', async () => {
    mockPropertyService.isOwner.mockResolvedValue(false)

    const res = await makeApp().request(`/properties/${PROP_ID}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@example.com', role: 'viewer' }),
    })

    expect(res.status).toBe(404)
    expect(mockMemberService.invite).not.toHaveBeenCalled()
  })

  it('passes email, role, and caller userId to service', async () => {
    mockPropertyService.isOwner.mockResolvedValue(true)
    mockMemberService.invite.mockResolvedValue(makeMember({ role: 'editor' }))

    await makeApp().request(`/properties/${PROP_ID}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@example.com', role: 'editor' }),
    })

    expect(mockMemberService.invite).toHaveBeenCalledWith(
      PROP_ID,
      USER_ID,
      { email: 'alice@example.com', role: 'editor' },
    )
  })

  it('rejects invalid role values', async () => {
    const res = await makeApp().request(`/properties/${PROP_ID}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@example.com', role: 'owner' }),
    })

    expect(res.status).toBe(400)
  })

  it('records invited activity', async () => {
    mockPropertyService.isOwner.mockResolvedValue(true)
    mockMemberService.invite.mockResolvedValue(makeMember())

    await makeApp().request(`/properties/${PROP_ID}/members`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'alice@example.com', role: 'viewer' }),
    })

    expect(mockActivityService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        propertyId: PROP_ID,
        userId: USER_ID,
        action: 'invited',
        entityType: 'member',
        entityId: MEMBER_ID,
      }),
    )
  })
})

describe('PATCH /members/:memberId', () => {
  beforeEach(() => vi.clearAllMocks())

  it('updates role and returns 200', async () => {
    mockPrisma.propertyMember.findUnique.mockResolvedValue(makeMember())
    mockPropertyService.isOwner.mockResolvedValue(true)
    mockMemberService.updateRole.mockResolvedValue(makeMember({ role: 'editor' }))

    const res = await makeApp().request(`/members/${MEMBER_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'editor' }),
    })

    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body.role).toBe('editor')
  })

  it('returns 404 when member not found', async () => {
    mockPrisma.propertyMember.findUnique.mockResolvedValue(null)

    const res = await makeApp().request(`/members/${MISSING_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'editor' }),
    })

    expect(res.status).toBe(404)
    expect(mockMemberService.updateRole).not.toHaveBeenCalled()
  })

  it('returns 404 when caller is not owner', async () => {
    mockPrisma.propertyMember.findUnique.mockResolvedValue(makeMember())
    mockPropertyService.isOwner.mockResolvedValue(false)

    const res = await makeApp().request(`/members/${MEMBER_ID}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ role: 'editor' }),
    })

    expect(res.status).toBe(404)
    expect(mockMemberService.updateRole).not.toHaveBeenCalled()
  })
})

describe('DELETE /members/:memberId', () => {
  beforeEach(() => vi.clearAllMocks())

  it('removes member and returns 204', async () => {
    mockPrisma.propertyMember.findUnique.mockResolvedValue(makeMember())
    mockPropertyService.isOwner.mockResolvedValue(true)
    mockMemberService.remove.mockResolvedValue(undefined)

    const res = await makeApp().request(`/members/${MEMBER_ID}`, { method: 'DELETE' })

    expect(res.status).toBe(204)
    expect(mockMemberService.remove).toHaveBeenCalledWith(MEMBER_ID)
  })

  it('returns 404 when member not found', async () => {
    mockPrisma.propertyMember.findUnique.mockResolvedValue(null)

    const res = await makeApp().request(`/members/${MISSING_ID}`, { method: 'DELETE' })

    expect(res.status).toBe(404)
    expect(mockMemberService.remove).not.toHaveBeenCalled()
  })

  it('returns 404 when caller is not owner', async () => {
    mockPrisma.propertyMember.findUnique.mockResolvedValue(makeMember())
    mockPropertyService.isOwner.mockResolvedValue(false)

    const res = await makeApp().request(`/members/${MEMBER_ID}`, { method: 'DELETE' })

    expect(res.status).toBe(404)
    expect(mockMemberService.remove).not.toHaveBeenCalled()
  })

  it('records removed activity', async () => {
    mockPrisma.propertyMember.findUnique.mockResolvedValue(makeMember())
    mockPropertyService.isOwner.mockResolvedValue(true)
    mockMemberService.remove.mockResolvedValue(undefined)

    await makeApp().request(`/members/${MEMBER_ID}`, { method: 'DELETE' })

    expect(mockActivityService.record).toHaveBeenCalledWith(
      expect.objectContaining({
        propertyId: PROP_ID,
        userId: USER_ID,
        action: 'removed',
        entityType: 'member',
        entityId: MEMBER_ID,
      }),
    )
  })
})

describe('POST /members/:memberId/leave', () => {
  beforeEach(() => vi.clearAllMocks())

  it('removes self and returns 204', async () => {
    mockPrisma.propertyMember.findUnique.mockResolvedValue(makeMember({ userId: USER_ID }))
    mockPropertyService.isOwner.mockResolvedValue(false)
    mockMemberService.remove.mockResolvedValue(undefined)

    const res = await makeApp().request(`/members/${MEMBER_ID}/leave`, { method: 'POST' })

    expect(res.status).toBe(204)
    expect(mockMemberService.remove).toHaveBeenCalledWith(MEMBER_ID)
  })

  it('returns 404 when member not found', async () => {
    mockPrisma.propertyMember.findUnique.mockResolvedValue(null)

    const res = await makeApp().request(`/members/${MISSING_ID}/leave`, { method: 'POST' })

    expect(res.status).toBe(404)
    expect(mockMemberService.remove).not.toHaveBeenCalled()
  })

  it('returns 403 when userId does not match member', async () => {
    const OTHER_USER = '00000000-0000-4000-8000-000000000001'
    mockPrisma.propertyMember.findUnique.mockResolvedValue(makeMember({ userId: OTHER_USER }))

    const res = await makeApp().request(`/members/${MEMBER_ID}/leave`, { method: 'POST' })

    expect(res.status).toBe(403)
    expect(mockMemberService.remove).not.toHaveBeenCalled()
  })

  it('returns 403 when caller is the property owner', async () => {
    mockPrisma.propertyMember.findUnique.mockResolvedValue(makeMember({ userId: USER_ID }))
    mockPropertyService.isOwner.mockResolvedValue(true)

    const res = await makeApp().request(`/members/${MEMBER_ID}/leave`, { method: 'POST' })

    expect(res.status).toBe(403)
    const body = await res.json()
    expect(body.message).toContain('transfer ownership')
    expect(mockMemberService.remove).not.toHaveBeenCalled()
  })
})

describe('GET /members/invites', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns pending invites for current user', async () => {
    mockGetUserEmail.mockResolvedValue('alice@example.com')
    mockMemberService.findPendingForEmail.mockResolvedValue([makeMember()])

    const res = await makeApp().request('/members/invites')
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body).toHaveLength(1)
    expect(mockMemberService.findPendingForEmail).toHaveBeenCalledWith('alice@example.com')
  })

  it('returns 503 when email lookup fails', async () => {
    mockGetUserEmail.mockResolvedValue(null)

    const res = await makeApp().request('/members/invites')

    expect(res.status).toBe(503)
    expect(mockMemberService.findPendingForEmail).not.toHaveBeenCalled()
  })
})

describe('POST /members/:memberId/accept', () => {
  beforeEach(() => vi.clearAllMocks())

  it('accepts invite and returns updated member', async () => {
    mockPrisma.propertyMember.findFirst.mockResolvedValue(makeMember({ email: 'alice@example.com' }))
    mockGetUserEmail.mockResolvedValue('alice@example.com')
    mockMemberService.accept.mockResolvedValue(makeMember({ status: 'active', userId: USER_ID }))

    const res = await makeApp().request(`/members/${MEMBER_ID}/accept`, { method: 'POST' })

    expect(res.status).toBe(200)
    expect(mockMemberService.accept).toHaveBeenCalledWith(MEMBER_ID, USER_ID, 'alice@example.com')
  })

  it('records accepted activity', async () => {
    mockPrisma.propertyMember.findFirst.mockResolvedValue(makeMember({ email: 'alice@example.com' }))
    mockGetUserEmail.mockResolvedValue('alice@example.com')
    mockMemberService.accept.mockResolvedValue(makeMember({ status: 'active', userId: USER_ID }))

    await makeApp().request(`/members/${MEMBER_ID}/accept`, { method: 'POST' })

    expect(mockActivityService.record).toHaveBeenCalledWith({
      propertyId: PROP_ID,
      userId: USER_ID,
      action: 'accepted',
      entityType: 'member',
      entityId: MEMBER_ID,
      entityName: 'alice@example.com',
    })
  })

  it('returns 404 when invite not found or not pending', async () => {
    mockPrisma.propertyMember.findFirst.mockResolvedValue(null)

    const res = await makeApp().request(`/members/${MISSING_ID}/accept`, { method: 'POST' })

    expect(res.status).toBe(404)
    expect(mockMemberService.accept).not.toHaveBeenCalled()
  })

  it('returns 403 when invite email does not match user email', async () => {
    mockPrisma.propertyMember.findFirst.mockResolvedValue(makeMember({ email: 'other@example.com' }))
    mockGetUserEmail.mockResolvedValue('alice@example.com')

    const res = await makeApp().request(`/members/${MEMBER_ID}/accept`, { method: 'POST' })

    expect(res.status).toBe(403)
    expect(mockMemberService.accept).not.toHaveBeenCalled()
  })

  it('returns 403 when email lookup fails', async () => {
    mockPrisma.propertyMember.findFirst.mockResolvedValue(makeMember({ email: 'alice@example.com' }))
    mockGetUserEmail.mockResolvedValue(null)

    const res = await makeApp().request(`/members/${MEMBER_ID}/accept`, { method: 'POST' })

    expect(res.status).toBe(403)
    expect(mockMemberService.accept).not.toHaveBeenCalled()
  })
})

describe('POST /members/:memberId/decline', () => {
  beforeEach(() => vi.clearAllMocks())

  it('declines invite and returns updated member', async () => {
    mockPrisma.propertyMember.findFirst.mockResolvedValue(makeMember({ email: 'alice@example.com' }))
    mockGetUserEmail.mockResolvedValue('alice@example.com')
    mockMemberService.decline.mockResolvedValue(makeMember({ status: 'declined' }))

    const res = await makeApp().request(`/members/${MEMBER_ID}/decline`, { method: 'POST' })

    expect(res.status).toBe(200)
    expect(mockMemberService.decline).toHaveBeenCalledWith(MEMBER_ID)
  })

  it('records declined activity', async () => {
    mockPrisma.propertyMember.findFirst.mockResolvedValue(makeMember({ email: 'alice@example.com' }))
    mockGetUserEmail.mockResolvedValue('alice@example.com')
    mockMemberService.decline.mockResolvedValue(makeMember({ status: 'declined' }))

    await makeApp().request(`/members/${MEMBER_ID}/decline`, { method: 'POST' })

    expect(mockActivityService.record).toHaveBeenCalledWith({
      propertyId: PROP_ID,
      userId: USER_ID,
      action: 'declined',
      entityType: 'member',
      entityId: MEMBER_ID,
      entityName: 'alice@example.com',
    })
  })

  it('returns 404 when invite not found or not pending', async () => {
    mockPrisma.propertyMember.findFirst.mockResolvedValue(null)

    const res = await makeApp().request(`/members/${MISSING_ID}/decline`, { method: 'POST' })

    expect(res.status).toBe(404)
    expect(mockMemberService.decline).not.toHaveBeenCalled()
  })

  it('returns 403 when invite email does not match user email', async () => {
    mockPrisma.propertyMember.findFirst.mockResolvedValue(makeMember({ email: 'other@example.com' }))
    mockGetUserEmail.mockResolvedValue('alice@example.com')

    const res = await makeApp().request(`/members/${MEMBER_ID}/decline`, { method: 'POST' })

    expect(res.status).toBe(403)
    expect(mockMemberService.decline).not.toHaveBeenCalled()
  })
})
