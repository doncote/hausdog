import { describe, expect, it } from 'vitest'
import { addressDataSchema, emptyAddressData } from './address'

const fullAddress = {
  streetAddress: '123 Main St',
  city: 'Springfield',
  state: 'IL',
  postalCode: '62701',
  country: 'US',
  county: 'Sangamon',
  neighborhood: 'Downtown',
  latitude: 39.7817,
  longitude: -89.6501,
  timezone: 'America/Chicago',
  plusCode: '87CF+Q2',
  googlePlaceId: 'ChIJexampleplaceid',
  formattedAddress: '123 Main St, Springfield, IL 62701, USA',
  googlePlaceData: { place_id: 'abc123', name: 'Example Place' },
}

describe('emptyAddressData', () => {
  it('has all null fields', () => {
    for (const value of Object.values(emptyAddressData)) {
      expect(value).toBeNull()
    }
  })

  it('passes schema validation', () => {
    const result = addressDataSchema.safeParse(emptyAddressData)
    expect(result.success).toBe(true)
  })
})

describe('addressDataSchema', () => {
  it('accepts a fully populated address', () => {
    const result = addressDataSchema.safeParse(fullAddress)
    expect(result.success).toBe(true)
  })

  it('accepts mixed null and populated fields', () => {
    const result = addressDataSchema.safeParse({
      streetAddress: '456 Oak Ave',
      city: null,
      state: 'CA',
      postalCode: null,
      country: 'US',
      county: null,
      neighborhood: null,
      latitude: null,
      longitude: null,
      timezone: null,
      plusCode: null,
      googlePlaceId: null,
      formattedAddress: null,
      googlePlaceData: null,
    })
    expect(result.success).toBe(true)
  })

  it('rejects non-string city', () => {
    const result = addressDataSchema.safeParse({ ...fullAddress, city: 123 })
    expect(result.success).toBe(false)
  })

  it('rejects non-string state', () => {
    const result = addressDataSchema.safeParse({ ...fullAddress, state: true })
    expect(result.success).toBe(false)
  })

  it('rejects non-number latitude', () => {
    const result = addressDataSchema.safeParse({ ...fullAddress, latitude: 'not-a-number' })
    expect(result.success).toBe(false)
  })

  it('rejects non-number longitude', () => {
    const result = addressDataSchema.safeParse({ ...fullAddress, longitude: [] })
    expect(result.success).toBe(false)
  })

  it('rejects non-record googlePlaceData', () => {
    const result = addressDataSchema.safeParse({ ...fullAddress, googlePlaceData: 'not-an-object' })
    expect(result.success).toBe(false)
  })

  it('rejects array as googlePlaceData', () => {
    const result = addressDataSchema.safeParse({ ...fullAddress, googlePlaceData: [1, 2, 3] })
    expect(result.success).toBe(false)
  })

  it('accepts null googlePlaceData', () => {
    const result = addressDataSchema.safeParse({ ...fullAddress, googlePlaceData: null })
    expect(result.success).toBe(true)
  })

  it('accepts googlePlaceData with unknown value types', () => {
    const result = addressDataSchema.safeParse({
      ...fullAddress,
      googlePlaceData: { nested: { deeply: true }, count: 42, tags: ['a', 'b'] },
    })
    expect(result.success).toBe(true)
  })

  it('rejects missing required field', () => {
    const { city: _city, ...withoutCity } = fullAddress
    const result = addressDataSchema.safeParse(withoutCity)
    expect(result.success).toBe(false)
  })
})
