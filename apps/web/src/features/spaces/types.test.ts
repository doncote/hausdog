import { describe, expect, it } from 'vitest'
import { CreateSpaceSchema, UpdateSpaceSchema } from './types'

const PROPERTY_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'

describe('CreateSpaceSchema', () => {
  it('accepts valid propertyId and name', () => {
    const result = CreateSpaceSchema.safeParse({ propertyId: PROPERTY_ID, name: 'Kitchen' })
    expect(result.success).toBe(true)
  })

  it('rejects non-UUID propertyId', () => {
    const result = CreateSpaceSchema.safeParse({ propertyId: 'not-a-uuid', name: 'Kitchen' })
    expect(result.success).toBe(false)
  })

  it('rejects empty name', () => {
    const result = CreateSpaceSchema.safeParse({ propertyId: PROPERTY_ID, name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects missing name', () => {
    const result = CreateSpaceSchema.safeParse({ propertyId: PROPERTY_ID })
    expect(result.success).toBe(false)
  })

  it('rejects missing propertyId', () => {
    const result = CreateSpaceSchema.safeParse({ name: 'Kitchen' })
    expect(result.success).toBe(false)
  })
})

describe('UpdateSpaceSchema', () => {
  it('accepts empty object (all optional)', () => {
    const result = UpdateSpaceSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('accepts valid name update', () => {
    const result = UpdateSpaceSchema.safeParse({ name: 'Garage' })
    expect(result.success).toBe(true)
  })

  it('rejects empty name string', () => {
    const result = UpdateSpaceSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })
})
