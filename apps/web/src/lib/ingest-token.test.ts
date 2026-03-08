import { describe, expect, it } from 'vitest'
import { buildIngestEmail, generateIngestToken } from './ingest-token'

describe('generateIngestToken', () => {
  it('generates a token with slug and hex suffix', () => {
    const token = generateIngestToken('123 Main St, Springfield', 'My Home')
    expect(token).toMatch(/^[a-z0-9-]+-[a-f0-9]{6}$/)
  })

  it('uses property name when address is null', () => {
    const token = generateIngestToken(null, 'Beach House')
    expect(token).toMatch(/^beach-house-[a-f0-9]{6}$/)
  })

  it('uses address over property name when provided', () => {
    const token = generateIngestToken('456 Oak Ave', 'Main Home')
    expect(token).toContain('456-oak-ave')
    expect(token).not.toContain('main-home')
  })

  it('truncates long slugs to 50 characters (before suffix)', () => {
    const longAddress = `${'A'.repeat(100)} Very Long Street Name That Should Be Truncated`
    const token = generateIngestToken(longAddress, 'Test')
    const slug = token.slice(0, token.lastIndexOf('-'))
    expect(slug.length).toBeLessThanOrEqual(50)
  })

  it('each call generates a unique token', () => {
    const token1 = generateIngestToken('123 Main St', 'Home')
    const token2 = generateIngestToken('123 Main St', 'Home')
    expect(token1).not.toBe(token2)
  })

  it('handles special characters in address', () => {
    const token = generateIngestToken('123 Main St. #4B', 'My Home')
    expect(token).toMatch(/^[a-z0-9-]+-[a-f0-9]{6}$/)
  })
})

describe('buildIngestEmail', () => {
  it('builds email from token and domain', () => {
    const email = buildIngestEmail('my-home-a7b3c9', 'ingest.hausdog.com')
    expect(email).toBe('my-home-a7b3c9@ingest.hausdog.com')
  })

  it('preserves token exactly', () => {
    const token = 'complex-slug-abc123'
    const email = buildIngestEmail(token, 'example.com')
    expect(email.startsWith(`${token}@`)).toBe(true)
  })
})
