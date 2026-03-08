import { describe, expect, it } from 'vitest'
import { CreateItemSchema, UpdateItemSchema } from './types'

// Valid UUID v4 values (Zod v4 validates RFC 4122 format strictly)
const PROP_ID = '550e8400-e29b-42d4-a716-446655440000'
const SPACE_ID = '550e8400-e29b-42d4-a716-446655440001'

describe('CreateItemSchema', () => {
  it('accepts valid minimal input', () => {
    const result = CreateItemSchema.safeParse({
      propertyId: PROP_ID,
      name: 'HVAC System',
      category: 'hvac',
    })
    expect(result.success).toBe(true)
  })

  it('accepts full valid input', () => {
    const result = CreateItemSchema.safeParse({
      propertyId: PROP_ID,
      spaceId: SPACE_ID,
      name: 'Water Heater',
      category: 'plumbing',
      manufacturer: 'Rheem',
      model: 'ProTerra 50',
      serialNumber: 'ABC123',
      purchasePrice: 1200,
      notes: 'Installed 2024',
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing name', () => {
    const result = CreateItemSchema.safeParse({
      propertyId: PROP_ID,
      category: 'hvac',
    })
    expect(result.success).toBe(false)
  })

  it('rejects missing category', () => {
    const result = CreateItemSchema.safeParse({
      propertyId: PROP_ID,
      name: 'HVAC System',
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid propertyId UUID', () => {
    const result = CreateItemSchema.safeParse({
      propertyId: 'not-a-uuid',
      name: 'HVAC',
      category: 'hvac',
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative purchase price', () => {
    const result = CreateItemSchema.safeParse({
      propertyId: PROP_ID,
      name: 'HVAC',
      category: 'hvac',
      purchasePrice: -100,
    })
    expect(result.success).toBe(false)
  })
})

describe('UpdateItemSchema', () => {
  it('accepts empty object (all fields optional)', () => {
    const result = UpdateItemSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('accepts partial updates', () => {
    const result = UpdateItemSchema.safeParse({ name: 'New Name' })
    expect(result.success).toBe(true)
  })
})
