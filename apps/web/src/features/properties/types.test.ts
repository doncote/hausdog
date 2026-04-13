import { describe, expect, it } from 'vitest'
import { CreatePropertySchema, UpdatePropertySchema } from './types'

describe('CreatePropertySchema', () => {
  it('accepts a minimal valid property (name only)', () => {
    const result = CreatePropertySchema.safeParse({ name: 'My Home' })
    expect(result.success).toBe(true)
  })

  it('rejects empty name', () => {
    const result = CreatePropertySchema.safeParse({ name: '' })
    expect(result.success).toBe(false)
  })

  it('rejects missing name', () => {
    const result = CreatePropertySchema.safeParse({})
    expect(result.success).toBe(false)
  })

  // yearBuilt bounds
  it('accepts yearBuilt at lower bound (1800)', () => {
    const result = CreatePropertySchema.safeParse({ name: 'Home', yearBuilt: 1800 })
    expect(result.success).toBe(true)
  })

  it('accepts yearBuilt at upper bound (2100)', () => {
    const result = CreatePropertySchema.safeParse({ name: 'Home', yearBuilt: 2100 })
    expect(result.success).toBe(true)
  })

  it('rejects yearBuilt below 1800', () => {
    const result = CreatePropertySchema.safeParse({ name: 'Home', yearBuilt: 1799 })
    expect(result.success).toBe(false)
  })

  it('rejects yearBuilt above 2100', () => {
    const result = CreatePropertySchema.safeParse({ name: 'Home', yearBuilt: 2101 })
    expect(result.success).toBe(false)
  })

  it('rejects non-integer yearBuilt', () => {
    const result = CreatePropertySchema.safeParse({ name: 'Home', yearBuilt: 1950.5 })
    expect(result.success).toBe(false)
  })

  // squareFeet / lotSquareFeet (int positive)
  it('accepts positive squareFeet', () => {
    const result = CreatePropertySchema.safeParse({ name: 'Home', squareFeet: 1500 })
    expect(result.success).toBe(true)
  })

  it('rejects zero squareFeet', () => {
    const result = CreatePropertySchema.safeParse({ name: 'Home', squareFeet: 0 })
    expect(result.success).toBe(false)
  })

  it('rejects negative squareFeet', () => {
    const result = CreatePropertySchema.safeParse({ name: 'Home', squareFeet: -100 })
    expect(result.success).toBe(false)
  })

  it('rejects fractional squareFeet', () => {
    const result = CreatePropertySchema.safeParse({ name: 'Home', squareFeet: 1500.5 })
    expect(result.success).toBe(false)
  })

  // bedrooms (int >= 0)
  it('accepts zero bedrooms (studio)', () => {
    const result = CreatePropertySchema.safeParse({ name: 'Home', bedrooms: 0 })
    expect(result.success).toBe(true)
  })

  it('rejects negative bedrooms', () => {
    const result = CreatePropertySchema.safeParse({ name: 'Home', bedrooms: -1 })
    expect(result.success).toBe(false)
  })

  // bathrooms (>= 0, allows decimals for half baths)
  it('accepts fractional bathrooms (half bath)', () => {
    const result = CreatePropertySchema.safeParse({ name: 'Home', bathrooms: 1.5 })
    expect(result.success).toBe(true)
  })

  it('accepts zero bathrooms', () => {
    const result = CreatePropertySchema.safeParse({ name: 'Home', bathrooms: 0 })
    expect(result.success).toBe(true)
  })

  it('rejects negative bathrooms', () => {
    const result = CreatePropertySchema.safeParse({ name: 'Home', bathrooms: -0.5 })
    expect(result.success).toBe(false)
  })

  // stories (int >= 1)
  it('accepts 1 story', () => {
    const result = CreatePropertySchema.safeParse({ name: 'Home', stories: 1 })
    expect(result.success).toBe(true)
  })

  it('rejects zero stories', () => {
    const result = CreatePropertySchema.safeParse({ name: 'Home', stories: 0 })
    expect(result.success).toBe(false)
  })

  it('rejects fractional stories', () => {
    const result = CreatePropertySchema.safeParse({ name: 'Home', stories: 1.5 })
    expect(result.success).toBe(false)
  })

  // purchasePrice / estimatedValue (positive)
  it('accepts positive purchasePrice', () => {
    const result = CreatePropertySchema.safeParse({ name: 'Home', purchasePrice: 500000 })
    expect(result.success).toBe(true)
  })

  it('rejects zero purchasePrice', () => {
    const result = CreatePropertySchema.safeParse({ name: 'Home', purchasePrice: 0 })
    expect(result.success).toBe(false)
  })

  it('rejects negative estimatedValue', () => {
    const result = CreatePropertySchema.safeParse({ name: 'Home', estimatedValue: -1 })
    expect(result.success).toBe(false)
  })

  it('accepts all optional fields omitted', () => {
    const result = CreatePropertySchema.safeParse({ name: 'Minimal Home' })
    expect(result.success).toBe(true)
  })
})

describe('UpdatePropertySchema', () => {
  it('accepts empty object (no fields required)', () => {
    const result = UpdatePropertySchema.safeParse({})
    expect(result.success).toBe(true)
  })

  it('accepts partial update with just name', () => {
    const result = UpdatePropertySchema.safeParse({ name: 'Renamed Home' })
    expect(result.success).toBe(true)
  })

  it('still enforces yearBuilt bounds when provided', () => {
    const result = UpdatePropertySchema.safeParse({ yearBuilt: 1700 })
    expect(result.success).toBe(false)
  })

  it('still enforces positive squareFeet when provided', () => {
    const result = UpdatePropertySchema.safeParse({ squareFeet: -50 })
    expect(result.success).toBe(false)
  })
})
