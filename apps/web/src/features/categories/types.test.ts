import { describe, expect, it } from 'vitest'
import { CreateCategorySchema, UpdateCategorySchema } from './types'

describe('CreateCategorySchema', () => {
  it('accepts valid input', () => {
    const result = CreateCategorySchema.safeParse({
      slug: 'hvac',
      name: 'HVAC',
    })
    expect(result.success).toBe(true)
  })

  it('accepts slug with hyphens and numbers', () => {
    const result = CreateCategorySchema.safeParse({
      slug: 'water-heater-2',
      name: 'Water Heater',
    })
    expect(result.success).toBe(true)
  })

  it('rejects slug with uppercase letters', () => {
    const result = CreateCategorySchema.safeParse({
      slug: 'HVAC',
      name: 'HVAC',
    })
    expect(result.success).toBe(false)
  })

  it('rejects slug with spaces', () => {
    const result = CreateCategorySchema.safeParse({
      slug: 'water heater',
      name: 'Water Heater',
    })
    expect(result.success).toBe(false)
  })

  it('rejects slug with special characters', () => {
    const result = CreateCategorySchema.safeParse({
      slug: 'hvac_system',
      name: 'HVAC',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty slug', () => {
    const result = CreateCategorySchema.safeParse({
      slug: '',
      name: 'HVAC',
    })
    expect(result.success).toBe(false)
  })

  it('rejects slug over 50 characters', () => {
    const result = CreateCategorySchema.safeParse({
      slug: 'a'.repeat(51),
      name: 'HVAC',
    })
    expect(result.success).toBe(false)
  })

  it('rejects empty name', () => {
    const result = CreateCategorySchema.safeParse({
      slug: 'hvac',
      name: '',
    })
    expect(result.success).toBe(false)
  })

  it('rejects name over 100 characters', () => {
    const result = CreateCategorySchema.safeParse({
      slug: 'hvac',
      name: 'a'.repeat(101),
    })
    expect(result.success).toBe(false)
  })

  it('accepts optional icon', () => {
    const result = CreateCategorySchema.safeParse({
      slug: 'hvac',
      name: 'HVAC',
      icon: 'thermometer',
    })
    expect(result.success).toBe(true)
  })
})

describe('UpdateCategorySchema', () => {
  it('accepts empty object (all fields optional)', () => {
    const result = UpdateCategorySchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('accepts partial update with just name', () => {
    const result = UpdateCategorySchema.safeParse({ name: 'New Name' })
    expect(result.success).toBe(true)
  })

  it('rejects empty name string', () => {
    const result = UpdateCategorySchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })
})
