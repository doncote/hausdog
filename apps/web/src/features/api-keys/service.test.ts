import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ApiKeyServiceDeps } from './service'
import { ApiKeyService } from './service'

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

function makePrismaApiKey(overrides: Record<string, unknown> = {}) {
  return {
    id: 'key-1',
    userId: 'user-1',
    name: 'My API Key',
    keyHash: 'abc123hash',
    lastUsedAt: null,
    createdAt: new Date('2024-01-01'),
    ...overrides,
  }
}

function makeService(dbOverrides: Record<string, unknown> = {}) {
  const mockDb = {
    apiKey: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    ...dbOverrides,
  }
  const deps = { db: mockDb, logger: mockLogger } as unknown as ApiKeyServiceDeps

  return { service: new ApiKeyService(deps), mockDb }
}

describe('ApiKeyService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('create', () => {
    it('returns a key with hd_ prefix', async () => {
      const { service, mockDb } = makeService()
      mockDb.apiKey.create.mockResolvedValue(makePrismaApiKey())

      const result = await service.create('user-1', { name: 'My Key' })

      expect(result.secret).toMatch(/^hd_/)
    })

    it('stores a hash not the plaintext secret', async () => {
      const { service, mockDb } = makeService()
      mockDb.apiKey.create.mockResolvedValue(makePrismaApiKey())

      const result = await service.create('user-1', { name: 'My Key' })

      const call = mockDb.apiKey.create.mock.calls[0][0]
      expect(call.data.keyHash).toBeDefined()
      expect(call.data.keyHash).not.toBe(result.secret)
      expect(call.data).not.toHaveProperty('secret')
    })

    it('sets userId and name from input', async () => {
      const { service, mockDb } = makeService()
      mockDb.apiKey.create.mockResolvedValue(makePrismaApiKey())

      await service.create('user-1', { name: 'Production Key' })

      const call = mockDb.apiKey.create.mock.calls[0][0]
      expect(call.data.userId).toBe('user-1')
      expect(call.data.name).toBe('Production Key')
    })

    it('returns domain fields along with secret', async () => {
      const { service, mockDb } = makeService()
      mockDb.apiKey.create.mockResolvedValue(makePrismaApiKey({ name: 'Production Key' }))

      const result = await service.create('user-1', { name: 'Production Key' })

      expect(result.id).toBe('key-1')
      expect(result.name).toBe('Production Key')
      expect(result.secret).toBeDefined()
    })
  })

  describe('validate', () => {
    it('returns null for keys without hd_ prefix', async () => {
      const { service } = makeService()

      const result = await service.validate('invalid-key-without-prefix')

      expect(result).toBeNull()
    })

    it('returns null when key hash not found in db', async () => {
      const { service, mockDb } = makeService()
      mockDb.apiKey.findUnique.mockResolvedValue(null)

      const result = await service.validate('hd_nonexistentkey')

      expect(result).toBeNull()
    })

    it('returns user info when key is valid', async () => {
      const { service, mockDb } = makeService()
      mockDb.apiKey.findUnique.mockResolvedValue(makePrismaApiKey())
      mockDb.apiKey.update.mockResolvedValue(makePrismaApiKey())

      const result = await service.validate('hd_validkey')

      expect(result).not.toBeNull()
      expect(result?.userId).toBe('user-1')
      expect(result?.name).toBe('My API Key')
    })

    it('triggers async lastUsedAt update on valid key', async () => {
      const { service, mockDb } = makeService()
      mockDb.apiKey.findUnique.mockResolvedValue(makePrismaApiKey({ id: 'key-1' }))
      mockDb.apiKey.update.mockResolvedValue(makePrismaApiKey())

      await service.validate('hd_validkey')

      // Allow async fire-and-forget to settle
      await new Promise((r) => setTimeout(r, 0))

      expect(mockDb.apiKey.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'key-1' },
          data: expect.objectContaining({ lastUsedAt: expect.any(Date) }),
        }),
      )
    })

    it('does not return secret in validated result', async () => {
      const { service, mockDb } = makeService()
      mockDb.apiKey.findUnique.mockResolvedValue(makePrismaApiKey())
      mockDb.apiKey.update.mockResolvedValue(makePrismaApiKey())

      const result = await service.validate('hd_validkey')

      expect(result).not.toHaveProperty('secret')
      expect(result).not.toHaveProperty('keyHash')
    })
  })

  describe('findAllForUser', () => {
    it('queries by userId ordered by createdAt desc', async () => {
      const { service, mockDb } = makeService()
      mockDb.apiKey.findMany.mockResolvedValue([makePrismaApiKey()])

      await service.findAllForUser('user-1')

      const call = mockDb.apiKey.findMany.mock.calls[0][0]
      expect(call.where.userId).toBe('user-1')
      expect(call.orderBy).toEqual({ createdAt: 'desc' })
    })

    it('maps domain fields without keyHash', async () => {
      const { service, mockDb } = makeService()
      mockDb.apiKey.findMany.mockResolvedValue([makePrismaApiKey()])

      const result = await service.findAllForUser('user-1')

      expect(result[0]?.id).toBe('key-1')
      expect(result[0]).not.toHaveProperty('keyHash')
    })
  })

  describe('findById', () => {
    it('returns null when not found', async () => {
      const { service, mockDb } = makeService()
      mockDb.apiKey.findUnique.mockResolvedValue(null)

      const result = await service.findById('nonexistent')
      expect(result).toBeNull()
    })

    it('returns domain key when found', async () => {
      const { service, mockDb } = makeService()
      mockDb.apiKey.findUnique.mockResolvedValue(makePrismaApiKey())

      const result = await service.findById('key-1')
      expect(result?.id).toBe('key-1')
    })
  })

  describe('delete', () => {
    it('deletes with both id and userId for ownership check', async () => {
      const { service, mockDb } = makeService()
      mockDb.apiKey.delete.mockResolvedValue(undefined)

      await service.delete('key-1', 'user-1')

      expect(mockDb.apiKey.delete).toHaveBeenCalledWith({
        where: { id: 'key-1', userId: 'user-1' },
      })
    })
  })
})
