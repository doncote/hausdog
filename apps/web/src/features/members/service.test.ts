import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { PropertyMemberServiceDeps } from './service'
import { PropertyMemberService } from './service'

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

function makeMember(overrides: Record<string, unknown> = {}) {
  return {
    id: 'member-1',
    propertyId: 'prop-1',
    userId: 'user-2',
    email: 'jane@example.com',
    role: 'viewer',
    status: 'active',
    invitedById: 'user-1',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }
}

function makeDeps(
  overrides: Partial<PropertyMemberServiceDeps['db']> = {},
): PropertyMemberServiceDeps {
  return {
    db: {
      propertyMember: {
        findMany: vi.fn(),
        findFirst: vi.fn(),
        upsert: vi.fn(),
        update: vi.fn(),
        updateMany: vi.fn(),
        delete: vi.fn(),
      },
      ...overrides,
    } as unknown as PropertyMemberServiceDeps['db'],
    logger: mockLogger,
  }
}

describe('PropertyMemberService', () => {
  let deps: PropertyMemberServiceDeps
  let service: PropertyMemberService

  beforeEach(() => {
    vi.clearAllMocks()
    deps = makeDeps()
    service = new PropertyMemberService(deps)
  })

  describe('findAllForProperty', () => {
    it('returns mapped members', async () => {
      const record = makeMember()
      vi.mocked(deps.db.propertyMember.findMany).mockResolvedValue([record])

      const result = await service.findAllForProperty('prop-1')

      expect(deps.db.propertyMember.findMany).toHaveBeenCalledWith({
        where: { propertyId: 'prop-1' },
        orderBy: { createdAt: 'asc' },
      })
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({ id: 'member-1', role: 'viewer', status: 'active' })
    })
  })

  describe('getAccess', () => {
    it('returns owner access when userId matches ownerId', async () => {
      const access = await service.getAccess('prop-1', 'user-1', 'user-1')
      expect(access).toEqual({
        isMember: true,
        role: 'owner',
        canWrite: true,
        canManageMembers: true,
      })
    })

    it('returns no access when not a member', async () => {
      vi.mocked(deps.db.propertyMember.findFirst).mockResolvedValue(null)
      const access = await service.getAccess('prop-1', 'user-2', 'user-1')
      expect(access).toEqual({
        isMember: false,
        role: null,
        canWrite: false,
        canManageMembers: false,
      })
    })

    it('returns editor access for editor role', async () => {
      vi.mocked(deps.db.propertyMember.findFirst).mockResolvedValue(makeMember({ role: 'editor' }))
      const access = await service.getAccess('prop-1', 'user-2', 'user-1')
      expect(access).toMatchObject({
        isMember: true,
        role: 'editor',
        canWrite: true,
        canManageMembers: false,
      })
    })

    it('returns viewer access for viewer role', async () => {
      vi.mocked(deps.db.propertyMember.findFirst).mockResolvedValue(makeMember({ role: 'viewer' }))
      const access = await service.getAccess('prop-1', 'user-2', 'user-1')
      expect(access).toMatchObject({
        isMember: true,
        role: 'viewer',
        canWrite: false,
        canManageMembers: false,
      })
    })
  })

  describe('invite', () => {
    it('upserts with lowercased email', async () => {
      const record = makeMember({ status: 'pending' })
      vi.mocked(deps.db.propertyMember.upsert).mockResolvedValue(record)

      await service.invite('prop-1', 'user-1', { email: 'JANE@EXAMPLE.COM', role: 'viewer' })

      expect(deps.db.propertyMember.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { propertyId_email: { propertyId: 'prop-1', email: 'jane@example.com' } },
          create: expect.objectContaining({ email: 'jane@example.com', status: 'pending' }),
        }),
      )
    })
  })

  describe('accept', () => {
    it('sets userId, status active, and lowercases email', async () => {
      const record = makeMember({ userId: 'user-2', status: 'active' })
      vi.mocked(deps.db.propertyMember.update).mockResolvedValue(record)

      await service.accept('member-1', 'user-2', 'Jane@Example.com')

      expect(deps.db.propertyMember.update).toHaveBeenCalledWith({
        where: { id: 'member-1' },
        data: { userId: 'user-2', status: 'active', email: 'jane@example.com' },
      })
    })
  })

  describe('decline', () => {
    it('sets status to declined', async () => {
      const record = makeMember({ status: 'declined' })
      vi.mocked(deps.db.propertyMember.update).mockResolvedValue(record)

      await service.decline('member-1')

      expect(deps.db.propertyMember.update).toHaveBeenCalledWith({
        where: { id: 'member-1' },
        data: { status: 'declined' },
      })
    })
  })

  describe('activatePendingInvites', () => {
    it('bulk-updates pending records matching email', async () => {
      vi.mocked(deps.db.propertyMember.updateMany).mockResolvedValue({ count: 2 })

      await service.activatePendingInvites('user-2', 'Jane@Example.com')

      expect(deps.db.propertyMember.updateMany).toHaveBeenCalledWith({
        where: { email: 'jane@example.com', status: 'pending' },
        data: { userId: 'user-2', status: 'active' },
      })
    })

    it('lowercases email before matching', async () => {
      vi.mocked(deps.db.propertyMember.updateMany).mockResolvedValue({ count: 0 })

      await service.activatePendingInvites('user-3', 'UPPER@CASE.COM')

      expect(deps.db.propertyMember.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ email: 'upper@case.com' }) }),
      )
    })
  })

  describe('remove', () => {
    it('deletes the member record', async () => {
      vi.mocked(deps.db.propertyMember.delete).mockResolvedValue(makeMember())

      await service.remove('member-1')

      expect(deps.db.propertyMember.delete).toHaveBeenCalledWith({ where: { id: 'member-1' } })
    })
  })
})
