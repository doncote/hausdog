import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { DocumentServiceDeps } from './service'
import { DocumentService } from './service'

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

function makePrismaDocument(overrides: Record<string, unknown> = {}) {
  return {
    id: 'doc-1',
    propertyId: 'prop-1',
    itemId: null,
    eventId: null,
    type: 'receipt',
    fileName: 'receipt.pdf',
    storagePath: 'uploads/receipt.pdf',
    contentType: 'application/pdf',
    sizeBytes: BigInt(1024),
    status: 'pending',
    extractedText: null,
    extractedData: null,
    resolveData: null,
    documentDate: null,
    source: 'upload',
    sourceEmail: null,
    createdById: 'user-1',
    createdAt: new Date('2024-01-01'),
    ...overrides,
  }
}

function makePrismaDocumentWithRelations(overrides: Record<string, unknown> = {}) {
  return {
    ...makePrismaDocument(overrides),
    property: { id: 'prop-1', name: 'My Home' },
    item: null,
    event: null,
  }
}

function makeService(dbOverrides: Record<string, unknown> = {}) {
  const mockDb = {
    document: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
      count: vi.fn(),
    },
    ...dbOverrides,
  }
  const deps = { db: mockDb, logger: mockLogger } as unknown as DocumentServiceDeps

  return { service: new DocumentService(deps), mockDb }
}

describe('DocumentService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('findAllForProperty', () => {
    it('returns mapped documents with relations', async () => {
      const { service, mockDb } = makeService()
      mockDb.document.findMany.mockResolvedValue([makePrismaDocumentWithRelations()])

      const result = await service.findAllForProperty('prop-1')

      expect(result).toHaveLength(1)
      expect(result[0]?.id).toBe('doc-1')
      expect(result[0]?.sizeBytes).toBe(1024) // BigInt converted to number
      expect(result[0]?.property?.name).toBe('My Home')
    })

    it('returns empty array when no documents', async () => {
      const { service, mockDb } = makeService()
      mockDb.document.findMany.mockResolvedValue([])

      const result = await service.findAllForProperty('prop-1')
      expect(result).toEqual([])
    })
  })

  describe('findPaginatedForProperty', () => {
    it('applies correct skip/take for pagination', async () => {
      const { service, mockDb } = makeService()
      mockDb.document.findMany.mockResolvedValue([])
      mockDb.document.count.mockResolvedValue(0)

      await service.findPaginatedForProperty('prop-1', { page: 2, limit: 10 })

      const findCall = mockDb.document.findMany.mock.calls[0][0]
      expect(findCall.skip).toBe(10) // (page-1) * limit
      expect(findCall.take).toBe(10)
    })

    it('returns paginated result with correct metadata', async () => {
      const { service, mockDb } = makeService()
      mockDb.document.findMany.mockResolvedValue([makePrismaDocumentWithRelations()])
      mockDb.document.count.mockResolvedValue(25)

      const result = await service.findPaginatedForProperty('prop-1', { page: 1, limit: 10 })

      expect(result.total).toBe(25)
      expect(result.pages).toBe(3)
      expect(result.hasMore).toBe(true)
      expect(result.data).toHaveLength(1)
    })

    it('filters by status when provided', async () => {
      const { service, mockDb } = makeService()
      mockDb.document.findMany.mockResolvedValue([])
      mockDb.document.count.mockResolvedValue(0)

      await service.findPaginatedForProperty('prop-1', { page: 1, limit: 10 }, 'confirmed')

      const findCall = mockDb.document.findMany.mock.calls[0][0]
      expect(findCall.where).toEqual({ propertyId: 'prop-1', status: 'confirmed' })
    })
  })

  describe('findById', () => {
    it('returns null when not found', async () => {
      const { service, mockDb } = makeService()
      mockDb.document.findUnique.mockResolvedValue(null)

      const result = await service.findById('nonexistent')
      expect(result).toBeNull()
    })

    it('returns document with relations when found', async () => {
      const { service, mockDb } = makeService()
      mockDb.document.findUnique.mockResolvedValue(makePrismaDocumentWithRelations())

      const result = await service.findById('doc-1')
      expect(result?.id).toBe('doc-1')
      expect(result?.property?.id).toBe('prop-1')
    })
  })

  describe('create', () => {
    it('creates a document with status pending', async () => {
      const { service, mockDb } = makeService()
      mockDb.document.create.mockResolvedValue(makePrismaDocument())

      await service.create('user-1', {
        propertyId: 'prop-1',
        type: 'receipt',
        fileName: 'receipt.pdf',
        storagePath: 'uploads/receipt.pdf',
        contentType: 'application/pdf',
        sizeBytes: 1024,
      })

      const createCall = mockDb.document.create.mock.calls[0][0]
      expect(createCall.data.status).toBe('pending')
      expect(createCall.data.createdById).toBe('user-1')
    })

    it('converts sizeBytes to BigInt', async () => {
      const { service, mockDb } = makeService()
      mockDb.document.create.mockResolvedValue(makePrismaDocument())

      await service.create('user-1', {
        propertyId: 'prop-1',
        type: 'photo',
        fileName: 'photo.jpg',
        storagePath: 'uploads/photo.jpg',
        contentType: 'image/jpeg',
        sizeBytes: 2048,
      })

      const createCall = mockDb.document.create.mock.calls[0][0]
      expect(createCall.data.sizeBytes).toBe(BigInt(2048))
    })
  })

  describe('createFromEmailBody', () => {
    it('creates email document with processing status', async () => {
      const { service, mockDb } = makeService()
      mockDb.document.create.mockResolvedValue(makePrismaDocument({ status: 'processing', source: 'email' }))

      await service.createFromEmailBody(
        'user-1',
        'prop-1',
        'Email body content',
        'sender@example.com',
        'Test Subject',
      )

      const createCall = mockDb.document.create.mock.calls[0][0]
      expect(createCall.data.status).toBe('processing')
      expect(createCall.data.source).toBe('email')
      expect(createCall.data.sourceEmail).toBe('sender@example.com')
      expect(createCall.data.extractedText).toBe('Email body content')
    })
  })

  describe('updateStatus', () => {
    it('updates only the status field', async () => {
      const { service, mockDb } = makeService()
      mockDb.document.update.mockResolvedValue(makePrismaDocument({ status: 'confirmed' }))

      await service.updateStatus('doc-1', 'confirmed')

      expect(mockDb.document.update).toHaveBeenCalledWith({
        where: { id: 'doc-1' },
        data: { status: 'confirmed' },
      })
    })
  })

  describe('delete', () => {
    it('calls db delete with correct id', async () => {
      const { service, mockDb } = makeService()
      mockDb.document.delete.mockResolvedValue(undefined)

      await service.delete('doc-1')

      expect(mockDb.document.delete).toHaveBeenCalledWith({ where: { id: 'doc-1' } })
    })
  })
})
