import { describe, expect, it } from 'vitest'
import { CreateEventSchema, EventType, UpdateEventSchema } from './types'

const ITEM_ID = '550e8400-e29b-42d4-a716-446655440000'

describe('CreateEventSchema', () => {
  it('accepts valid input with required fields only', () => {
    const result = CreateEventSchema.safeParse({
      itemId: ITEM_ID,
      type: 'maintenance',
      date: new Date(),
    })
    expect(result.success).toBe(true)
  })

  it('accepts all valid event types', () => {
    for (const type of Object.values(EventType)) {
      const result = CreateEventSchema.safeParse({
        itemId: ITEM_ID,
        type,
        date: new Date(),
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects unknown event type', () => {
    const result = CreateEventSchema.safeParse({
      itemId: ITEM_ID,
      type: 'purchase',
      date: new Date(),
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid itemId (not a UUID)', () => {
    const result = CreateEventSchema.safeParse({
      itemId: 'not-a-uuid',
      type: 'maintenance',
      date: new Date(),
    })
    expect(result.success).toBe(false)
  })

  it('rejects negative cost', () => {
    const result = CreateEventSchema.safeParse({
      itemId: ITEM_ID,
      type: 'repair',
      date: new Date(),
      cost: -50,
    })
    expect(result.success).toBe(false)
  })

  it('rejects zero cost (must be positive)', () => {
    const result = CreateEventSchema.safeParse({
      itemId: ITEM_ID,
      type: 'repair',
      date: new Date(),
      cost: 0,
    })
    expect(result.success).toBe(false)
  })

  it('accepts positive cost', () => {
    const result = CreateEventSchema.safeParse({
      itemId: ITEM_ID,
      type: 'repair',
      date: new Date(),
      cost: 150.5,
    })
    expect(result.success).toBe(true)
  })
})

describe('UpdateEventSchema', () => {
  it('accepts empty object (all fields optional)', () => {
    const result = UpdateEventSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('does not allow updating itemId', () => {
    const schema = UpdateEventSchema
    // itemId should not be in the schema
    const result = schema.safeParse({ itemId: ITEM_ID, type: 'repair' })
    // itemId is stripped (not recognized), but type update is valid
    expect(result.success).toBe(true)
    if (result.success) {
      expect(result.data).not.toHaveProperty('itemId')
    }
  })

  it('rejects unknown event type on update', () => {
    const result = UpdateEventSchema.safeParse({ type: 'purchase' })
    expect(result.success).toBe(false)
  })
})
