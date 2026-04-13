import { describe, expect, it } from 'vitest'
import { CreateDocumentSchema, UpdateDocumentSchema } from './types'

const PROPERTY_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'
const ITEM_ID = 'a1b2c3d4-e5f6-4a5b-8c9d-0e1f2a3b4c5d'

describe('CreateDocumentSchema', () => {
  const base = {
    propertyId: PROPERTY_ID,
    type: 'photo' as const,
    fileName: 'receipt.jpg',
    storagePath: 'prop-1/user-1/uuid/receipt.jpg',
    contentType: 'image/jpeg',
    sizeBytes: 204800,
  }

  it('accepts a fully valid document', () => {
    const result = CreateDocumentSchema.safeParse(base)
    expect(result.success).toBe(true)
  })

  it('rejects invalid propertyId (not UUID)', () => {
    const result = CreateDocumentSchema.safeParse({ ...base, propertyId: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })

  it('rejects invalid itemId when provided', () => {
    const result = CreateDocumentSchema.safeParse({ ...base, itemId: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })

  it('accepts valid itemId UUID', () => {
    const result = CreateDocumentSchema.safeParse({ ...base, itemId: ITEM_ID })
    expect(result.success).toBe(true)
  })

  // type enum
  it('accepts all valid document types', () => {
    const validTypes = ['photo', 'receipt', 'manual', 'warranty', 'invoice', 'email', 'other']
    for (const type of validTypes) {
      const result = CreateDocumentSchema.safeParse({ ...base, type })
      expect(result.success, `Expected type "${type}" to be valid`).toBe(true)
    }
  })

  it('rejects unknown document type', () => {
    const result = CreateDocumentSchema.safeParse({ ...base, type: 'contract' })
    expect(result.success).toBe(false)
  })

  // required string fields
  it('rejects empty fileName', () => {
    const result = CreateDocumentSchema.safeParse({ ...base, fileName: '' })
    expect(result.success).toBe(false)
  })

  it('rejects empty storagePath', () => {
    const result = CreateDocumentSchema.safeParse({ ...base, storagePath: '' })
    expect(result.success).toBe(false)
  })

  it('rejects empty contentType', () => {
    const result = CreateDocumentSchema.safeParse({ ...base, contentType: '' })
    expect(result.success).toBe(false)
  })

  // sizeBytes
  it('rejects zero sizeBytes', () => {
    const result = CreateDocumentSchema.safeParse({ ...base, sizeBytes: 0 })
    expect(result.success).toBe(false)
  })

  it('rejects negative sizeBytes', () => {
    const result = CreateDocumentSchema.safeParse({ ...base, sizeBytes: -1 })
    expect(result.success).toBe(false)
  })

  it('rejects fractional sizeBytes', () => {
    const result = CreateDocumentSchema.safeParse({ ...base, sizeBytes: 100.5 })
    expect(result.success).toBe(false)
  })

  // source enum
  it('accepts source "upload"', () => {
    const result = CreateDocumentSchema.safeParse({ ...base, source: 'upload' })
    expect(result.success).toBe(true)
  })

  it('accepts source "email"', () => {
    const result = CreateDocumentSchema.safeParse({ ...base, source: 'email' })
    expect(result.success).toBe(true)
  })

  it('rejects unknown source', () => {
    const result = CreateDocumentSchema.safeParse({ ...base, source: 'api' })
    expect(result.success).toBe(false)
  })

  // sourceEmail
  it('rejects invalid sourceEmail', () => {
    const result = CreateDocumentSchema.safeParse({ ...base, sourceEmail: 'not-an-email' })
    expect(result.success).toBe(false)
  })

  it('accepts valid sourceEmail', () => {
    const result = CreateDocumentSchema.safeParse({
      ...base,
      source: 'email',
      sourceEmail: 'user@example.com',
    })
    expect(result.success).toBe(true)
  })
})

describe('UpdateDocumentSchema', () => {
  it('accepts empty object (all optional)', () => {
    const result = UpdateDocumentSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('accepts valid status', () => {
    const result = UpdateDocumentSchema.safeParse({ status: 'confirmed' })
    expect(result.success).toBe(true)
  })

  it('rejects unknown status', () => {
    const result = UpdateDocumentSchema.safeParse({ status: 'archived' })
    expect(result.success).toBe(false)
  })

  it('accepts all valid statuses', () => {
    const validStatuses = ['pending', 'processing', 'ready_for_review', 'confirmed', 'discarded']
    for (const status of validStatuses) {
      const result = UpdateDocumentSchema.safeParse({ status })
      expect(result.success, `Expected status "${status}" to be valid`).toBe(true)
    }
  })

  it('accepts valid document type', () => {
    const result = UpdateDocumentSchema.safeParse({ type: 'warranty' })
    expect(result.success).toBe(true)
  })

  it('rejects unknown type', () => {
    const result = UpdateDocumentSchema.safeParse({ type: 'contract' })
    expect(result.success).toBe(false)
  })

  it('accepts null itemId (unlink)', () => {
    const result = UpdateDocumentSchema.safeParse({ itemId: null })
    expect(result.success).toBe(true)
  })

  it('rejects invalid itemId UUID', () => {
    const result = UpdateDocumentSchema.safeParse({ itemId: 'not-a-uuid' })
    expect(result.success).toBe(false)
  })
})
