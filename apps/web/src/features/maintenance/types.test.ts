import { describe, expect, it } from 'vitest'
import {
  CompleteMaintenanceTaskSchema,
  CreateMaintenanceTaskSchema,
  UpdateMaintenanceTaskSchema,
} from './types'

const PROPERTY_ID = '550e8400-e29b-42d4-a716-446655440000'
const ITEM_ID = '550e8400-e29b-42d4-a716-446655440001'

describe('CreateMaintenanceTaskSchema', () => {
  it('accepts valid minimal input', () => {
    const result = CreateMaintenanceTaskSchema.safeParse({
      propertyId: PROPERTY_ID,
      name: 'Change HVAC Filter',
      intervalMonths: 3,
      nextDueDate: new Date(),
    })
    expect(result.success).toBe(true)
  })

  it('accepts optional itemId', () => {
    const result = CreateMaintenanceTaskSchema.safeParse({
      propertyId: PROPERTY_ID,
      itemId: ITEM_ID,
      name: 'Change Filter',
      intervalMonths: 3,
      nextDueDate: new Date(),
    })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = CreateMaintenanceTaskSchema.safeParse({
      propertyId: PROPERTY_ID,
      name: '',
      intervalMonths: 3,
      nextDueDate: new Date(),
    })
    expect(result.success).toBe(false)
  })

  it('rejects name over 255 characters', () => {
    const result = CreateMaintenanceTaskSchema.safeParse({
      propertyId: PROPERTY_ID,
      name: 'a'.repeat(256),
      intervalMonths: 3,
      nextDueDate: new Date(),
    })
    expect(result.success).toBe(false)
  })

  it('rejects intervalMonths of 0 (min is 1)', () => {
    const result = CreateMaintenanceTaskSchema.safeParse({
      propertyId: PROPERTY_ID,
      name: 'Change Filter',
      intervalMonths: 0,
      nextDueDate: new Date(),
    })
    expect(result.success).toBe(false)
  })

  it('rejects intervalMonths over 120', () => {
    const result = CreateMaintenanceTaskSchema.safeParse({
      propertyId: PROPERTY_ID,
      name: 'Change Filter',
      intervalMonths: 121,
      nextDueDate: new Date(),
    })
    expect(result.success).toBe(false)
  })

  it('accepts intervalMonths at boundaries (1 and 120)', () => {
    for (const intervalMonths of [1, 120]) {
      const result = CreateMaintenanceTaskSchema.safeParse({
        propertyId: PROPERTY_ID,
        name: 'Change Filter',
        intervalMonths,
        nextDueDate: new Date(),
      })
      expect(result.success).toBe(true)
    }
  })

  it('rejects non-integer intervalMonths', () => {
    const result = CreateMaintenanceTaskSchema.safeParse({
      propertyId: PROPERTY_ID,
      name: 'Change Filter',
      intervalMonths: 3.5,
      nextDueDate: new Date(),
    })
    expect(result.success).toBe(false)
  })

  it('rejects invalid propertyId UUID', () => {
    const result = CreateMaintenanceTaskSchema.safeParse({
      propertyId: 'not-a-uuid',
      name: 'Change Filter',
      intervalMonths: 3,
      nextDueDate: new Date(),
    })
    expect(result.success).toBe(false)
  })
})

describe('UpdateMaintenanceTaskSchema', () => {
  it('accepts empty object (all fields optional)', () => {
    const result = UpdateMaintenanceTaskSchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('rejects empty name string', () => {
    const result = UpdateMaintenanceTaskSchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects out-of-range intervalMonths on update', () => {
    const result = UpdateMaintenanceTaskSchema.safeParse({ intervalMonths: 0 })
    expect(result.success).toBe(false)
  })
})

describe('CompleteMaintenanceTaskSchema', () => {
  it('accepts valid input with date only', () => {
    const result = CompleteMaintenanceTaskSchema.safeParse({
      date: new Date(),
    })
    expect(result.success).toBe(true)
  })

  it('rejects negative cost', () => {
    const result = CompleteMaintenanceTaskSchema.safeParse({
      date: new Date(),
      cost: -10,
    })
    expect(result.success).toBe(false)
  })

  it('accepts full valid input', () => {
    const result = CompleteMaintenanceTaskSchema.safeParse({
      date: new Date(),
      cost: 75,
      performedBy: 'Bob the Plumber',
      description: 'Replaced filter',
    })
    expect(result.success).toBe(true)
  })
})
