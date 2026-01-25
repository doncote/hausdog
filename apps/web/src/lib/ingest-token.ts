import { randomBytes } from 'node:crypto'
import slugify from 'slugify'

/**
 * Generate a unique ingest token for a property.
 * Format: {address-slug}-{6-char-hex}
 * Example: "123-main-st-a7b3c9"
 */
export function generateIngestToken(address: string | null, propertyName: string): string {
  const base = address || propertyName
  const slug = slugify(base, { lower: true, strict: true })
  // Truncate slug to reasonable length (max 50 chars)
  const truncatedSlug = slug.slice(0, 50)
  const suffix = randomBytes(3).toString('hex')
  return `${truncatedSlug}-${suffix}`
}

/**
 * Build the full ingest email address from a token.
 */
export function buildIngestEmail(token: string, domain: string): string {
  return `${token}@${domain}`
}
