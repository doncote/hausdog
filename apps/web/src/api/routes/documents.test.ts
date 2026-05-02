import { OpenAPIHono } from '@hono/zod-openapi'
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db', () => ({ prisma: {} }))
vi.mock('@/lib/console-logger', () => ({
  consoleLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const mockStorageRemove = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }))
const mockStorageUpload = vi.hoisted(() => vi.fn().mockResolvedValue({ error: null }))

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    storage: {
      from: vi.fn(() => ({
        upload: mockStorageUpload,
        remove: mockStorageRemove,
      })),
    },
  })),
}))

vi.mock('@trigger.dev/sdk/v3', () => ({
  configure: vi.fn(),
  tasks: { trigger: vi.fn().mockResolvedValue({}) },
}))

const mockDocumentService = vi.hoisted(() => ({
  findPaginatedForProperty: vi.fn(),
  findById: vi.fn(),
  create: vi.fn(),
  delete: vi.fn(),
}))

const mockPropertyService = vi.hoisted(() => ({
  findById: vi.fn(),
  canWrite: vi.fn(),
}))

vi.mock('@/features/documents/service', () => ({
  DocumentService: vi.fn().mockImplementation(() => mockDocumentService),
}))

vi.mock('@/features/properties/service', () => ({
  PropertyService: vi.fn().mockImplementation(() => mockPropertyService),
}))

import type { AuthContext } from '../middleware/auth'
import { documentsRouter } from './documents'

const USER_ID = 'a0eebc99-9c0b-4ef8-bb6d-6bb9bd380a11'
const PROP_ID = '550e8400-e29b-41d4-a716-446655440000'
const DOC_ID = '550e8400-e29b-41d4-a716-446655440001'
const MISSING_ID = '12345678-1234-4234-8234-123456789012'

function makeApp() {
  const app = new OpenAPIHono<{ Variables: AuthContext }>()
  app.use('*', async (c, next) => {
    c.set('userId', USER_ID)
    c.set('apiKeyId', '550e8400-e29b-41d4-a716-446655440099')
    c.set('apiKeyName', 'test')
    await next()
  })
  app.route('/', documentsRouter)
  return app
}

function makeProperty() {
  return { id: PROP_ID, userId: USER_ID, name: 'My Home' }
}

function makeDocument(overrides: Record<string, unknown> = {}) {
  return {
    id: DOC_ID,
    propertyId: PROP_ID,
    itemId: null,
    eventId: null,
    type: 'receipt',
    fileName: 'receipt.pdf',
    storagePath: `${PROP_ID}/${USER_ID}/file.pdf`,
    contentType: 'application/pdf',
    sizeBytes: 12345,
    status: 'pending',
    extractedText: null,
    extractedData: null,
    resolveData: null,
    documentDate: null,
    source: 'upload',
    sourceEmail: null,
    createdAt: new Date('2026-01-01'),
    ...overrides,
  }
}

function makePaginatedResult(docs: ReturnType<typeof makeDocument>[]) {
  return { data: docs, total: docs.length, page: 1, limit: 50, pages: 1, hasMore: false }
}

describe('GET /properties/:propertyId/documents', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns paginated documents', async () => {
    mockPropertyService.findById.mockResolvedValue(makeProperty())
    mockDocumentService.findPaginatedForProperty.mockResolvedValue(
      makePaginatedResult([makeDocument()]),
    )

    const res = await makeApp().request(`/properties/${PROP_ID}/documents`)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.data).toHaveLength(1)
    expect(body.data[0].fileName).toBe('receipt.pdf')
  })

  it('returns 404 when property not found', async () => {
    mockPropertyService.findById.mockResolvedValue(null)

    const res = await makeApp().request(`/properties/${MISSING_ID}/documents`)

    expect(res.status).toBe(404)
  })

  it('does not call document service when property not found', async () => {
    mockPropertyService.findById.mockResolvedValue(null)

    await makeApp().request(`/properties/${MISSING_ID}/documents`)

    expect(mockDocumentService.findPaginatedForProperty).not.toHaveBeenCalled()
  })

  it('serializes createdAt as ISO string', async () => {
    mockPropertyService.findById.mockResolvedValue(makeProperty())
    mockDocumentService.findPaginatedForProperty.mockResolvedValue(
      makePaginatedResult([makeDocument()]),
    )

    const res = await makeApp().request(`/properties/${PROP_ID}/documents`)
    const body = await res.json()

    expect(body.data[0].createdAt).toBe('2026-01-01T00:00:00.000Z')
  })

  it('calls service with propertyId and userId', async () => {
    mockPropertyService.findById.mockResolvedValue(makeProperty())
    mockDocumentService.findPaginatedForProperty.mockResolvedValue(makePaginatedResult([]))

    await makeApp().request(`/properties/${PROP_ID}/documents`)

    expect(mockPropertyService.findById).toHaveBeenCalledWith(PROP_ID, USER_ID)
    expect(mockDocumentService.findPaginatedForProperty).toHaveBeenCalledWith(
      PROP_ID,
      expect.any(Object),
      undefined,
    )
  })
})

describe('GET /documents/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns document when found and owned', async () => {
    mockDocumentService.findById.mockResolvedValue(makeDocument())
    mockPropertyService.findById.mockResolvedValue(makeProperty())

    const res = await makeApp().request(`/documents/${DOC_ID}`)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.id).toBe(DOC_ID)
    expect(body.fileName).toBe('receipt.pdf')
  })

  it('returns 404 when document not found', async () => {
    mockDocumentService.findById.mockResolvedValue(null)

    const res = await makeApp().request(`/documents/${MISSING_ID}`)

    expect(res.status).toBe(404)
  })

  it('returns 404 when property not owned by user', async () => {
    mockDocumentService.findById.mockResolvedValue(makeDocument())
    mockPropertyService.findById.mockResolvedValue(null)

    const res = await makeApp().request(`/documents/${DOC_ID}`)

    expect(res.status).toBe(404)
  })

  it('serializes createdAt as ISO string', async () => {
    mockDocumentService.findById.mockResolvedValue(makeDocument())
    mockPropertyService.findById.mockResolvedValue(makeProperty())

    const res = await makeApp().request(`/documents/${DOC_ID}`)
    const body = await res.json()

    expect(body.createdAt).toBe('2026-01-01T00:00:00.000Z')
  })
})

describe('POST /properties/:propertyId/documents/upload', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns 404 when property not found', async () => {
    mockPropertyService.canWrite.mockResolvedValue(false)

    const formData = new FormData()
    formData.append('file', new Blob(['pdf content'], { type: 'application/pdf' }), 'receipt.pdf')

    const res = await makeApp().request(`/properties/${MISSING_ID}/documents/upload`, {
      method: 'POST',
      body: formData,
    })

    expect(res.status).toBe(404)
  })
})

describe('DELETE /documents/:id', () => {
  beforeEach(() => vi.clearAllMocks())

  it('deletes document and returns 204', async () => {
    mockDocumentService.findById.mockResolvedValue(makeDocument())
    mockPropertyService.canWrite.mockResolvedValue(true)
    mockDocumentService.delete.mockResolvedValue(undefined)

    const res = await makeApp().request(`/documents/${DOC_ID}`, { method: 'DELETE' })

    expect(res.status).toBe(204)
    expect(mockDocumentService.delete).toHaveBeenCalledWith(DOC_ID)
  })

  it('returns 404 when document not found', async () => {
    mockDocumentService.findById.mockResolvedValue(null)

    const res = await makeApp().request(`/documents/${MISSING_ID}`, { method: 'DELETE' })

    expect(res.status).toBe(404)
  })

  it('returns 404 when property not owned by user', async () => {
    mockDocumentService.findById.mockResolvedValue(makeDocument())
    mockPropertyService.canWrite.mockResolvedValue(false)

    const res = await makeApp().request(`/documents/${DOC_ID}`, { method: 'DELETE' })

    expect(res.status).toBe(404)
  })

  it('does not delete when ownership check fails', async () => {
    mockDocumentService.findById.mockResolvedValue(makeDocument())
    mockPropertyService.canWrite.mockResolvedValue(false)

    await makeApp().request(`/documents/${DOC_ID}`, { method: 'DELETE' })

    expect(mockDocumentService.delete).not.toHaveBeenCalled()
  })

  it('removes file from storage when storagePath is set', async () => {
    process.env.SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_KEY = 'test-key'
    mockDocumentService.findById.mockResolvedValue(makeDocument())
    mockPropertyService.canWrite.mockResolvedValue(true)
    mockDocumentService.delete.mockResolvedValue(undefined)
    mockStorageRemove.mockResolvedValue({ error: null })

    const res = await makeApp().request(`/documents/${DOC_ID}`, { method: 'DELETE' })

    expect(res.status).toBe(204)
    expect(mockStorageRemove).toHaveBeenCalledWith([`${PROP_ID}/${USER_ID}/file.pdf`])
    delete process.env.SUPABASE_URL
    delete process.env.SUPABASE_KEY
  })

  it('still deletes db record when storage removal fails', async () => {
    process.env.SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_KEY = 'test-key'
    mockDocumentService.findById.mockResolvedValue(makeDocument())
    mockPropertyService.canWrite.mockResolvedValue(true)
    mockDocumentService.delete.mockResolvedValue(undefined)
    mockStorageRemove.mockResolvedValue({ error: { message: 'Storage error' } })

    const res = await makeApp().request(`/documents/${DOC_ID}`, { method: 'DELETE' })

    expect(res.status).toBe(204)
    expect(mockDocumentService.delete).toHaveBeenCalledWith(DOC_ID)
    delete process.env.SUPABASE_URL
    delete process.env.SUPABASE_KEY
  })

  it('skips storage removal when document has no storagePath', async () => {
    process.env.SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_KEY = 'test-key'
    mockDocumentService.findById.mockResolvedValue(makeDocument({ storagePath: null }))
    mockPropertyService.canWrite.mockResolvedValue(true)
    mockDocumentService.delete.mockResolvedValue(undefined)
    mockStorageRemove.mockClear()

    const res = await makeApp().request(`/documents/${DOC_ID}`, { method: 'DELETE' })

    expect(res.status).toBe(204)
    expect(mockStorageRemove).not.toHaveBeenCalled()
    delete process.env.SUPABASE_URL
    delete process.env.SUPABASE_KEY
  })
})
