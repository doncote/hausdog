import crypto from 'node:crypto'
import { describe, expect, it } from 'vitest'
import {
  extractIngestToken,
  extractTextFromHtml,
  hasSubstantialContent,
  verifyWebhookSignature,
} from './ingest'

// ─── verifyWebhookSignature ────────────────────────────────────────────────

function makeSignature(payload: string, secret: string, timestamp = '1700000000'): string {
  const signedPayload = `${timestamp}.${payload}`
  const sig = crypto.createHmac('sha256', secret).update(signedPayload).digest('hex')
  return `v1,${timestamp},${sig}`
}

describe('verifyWebhookSignature', () => {
  const SECRET = 'test-webhook-secret'
  const PAYLOAD = '{"type":"email.received"}'

  it('returns true for a valid signature', () => {
    const sig = makeSignature(PAYLOAD, SECRET)
    expect(verifyWebhookSignature(PAYLOAD, sig, SECRET)).toBe(true)
  })

  it('returns false when signature is null', () => {
    expect(verifyWebhookSignature(PAYLOAD, null, SECRET)).toBe(false)
  })

  it('returns false when signature is empty string', () => {
    expect(verifyWebhookSignature(PAYLOAD, '', SECRET)).toBe(false)
  })

  it('returns false when secret is empty string', () => {
    const sig = makeSignature(PAYLOAD, SECRET)
    expect(verifyWebhookSignature(PAYLOAD, sig, '')).toBe(false)
  })

  it('returns false for wrong secret', () => {
    const sig = makeSignature(PAYLOAD, 'wrong-secret')
    expect(verifyWebhookSignature(PAYLOAD, sig, SECRET)).toBe(false)
  })

  it('returns false for tampered payload', () => {
    const sig = makeSignature(PAYLOAD, SECRET)
    expect(verifyWebhookSignature('{"tampered":true}', sig, SECRET)).toBe(false)
  })

  it('returns false for invalid version prefix', () => {
    const timestamp = '1700000000'
    const sig = crypto.createHmac('sha256', SECRET).update(`${timestamp}.${PAYLOAD}`).digest('hex')
    const badVersionSig = `v2,${timestamp},${sig}`
    expect(verifyWebhookSignature(PAYLOAD, badVersionSig, SECRET)).toBe(false)
  })
})

// ─── extractIngestToken ────────────────────────────────────────────────────

describe('extractIngestToken', () => {
  it('extracts local part from email address', () => {
    expect(extractIngestToken('my-property-a7b3c9@hausdog.app')).toBe('my-property-a7b3c9')
  })

  it('returns the full string when no @ is present', () => {
    expect(extractIngestToken('no-at-sign')).toBe('no-at-sign')
  })

  it('returns null for empty string', () => {
    expect(extractIngestToken('')).toBeNull()
  })
})

// ─── extractTextFromHtml ───────────────────────────────────────────────────

describe('extractTextFromHtml', () => {
  it('returns empty string for undefined input', () => {
    expect(extractTextFromHtml(undefined)).toBe('')
  })

  it('strips HTML tags', () => {
    expect(extractTextFromHtml('<p>Hello <b>world</b></p>')).toBe('Hello world')
  })

  it('removes script tags and their content', () => {
    const html = '<p>Hello</p><script>alert("xss")</script><p>World</p>'
    expect(extractTextFromHtml(html)).not.toContain('alert')
    expect(extractTextFromHtml(html)).toContain('Hello')
  })

  it('removes style tags and their content', () => {
    const html = '<p>Text</p><style>body{color:red}</style>'
    expect(extractTextFromHtml(html)).not.toContain('color')
    expect(extractTextFromHtml(html)).toContain('Text')
  })

  it('decodes common HTML entities', () => {
    const html = '&amp; &lt; &gt; &quot; &#39; &nbsp;'
    const result = extractTextFromHtml(html)
    expect(result).toContain('&')
    expect(result).toContain('<')
    expect(result).toContain('>')
    expect(result).toContain('"')
    expect(result).toContain("'")
  })

  it('collapses multiple whitespace into single spaces', () => {
    const result = extractTextFromHtml('<p>Hello</p>   <p>World</p>')
    expect(result).not.toMatch(/\s{2,}/)
  })
})

// ─── hasSubstantialContent ─────────────────────────────────────────────────

describe('hasSubstantialContent', () => {
  it('returns false for empty string', () => {
    expect(hasSubstantialContent('')).toBe(false)
  })

  it('returns false for short content under 100 chars', () => {
    expect(hasSubstantialContent('Short message')).toBe(false)
  })

  it('returns true for content of 100+ chars', () => {
    const longText =
      'This is a substantial piece of content that contains enough information to be meaningful and useful for document processing purposes.'
    expect(hasSubstantialContent(longText)).toBe(true)
  })

  it('strips forward prefix before measuring length', () => {
    // "fwd: " prefix is stripped, leaving content under 100 chars
    const fwdShort = 'fwd: ' + 'short content'
    expect(hasSubstantialContent(fwdShort)).toBe(false)
  })

  it('strips re: prefix before measuring length', () => {
    const reShort = `re: ${'a'.repeat(50)}`
    expect(hasSubstantialContent(reShort)).toBe(false)
  })
})
