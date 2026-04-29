import crypto from 'node:crypto'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/env', () => ({
  getServerEnv: () => ({ RESEND_API_KEY: 'test-resend-key' }),
}))

vi.mock('@/lib/console-logger', () => ({
  consoleLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

import {
  extractIngestToken,
  extractTextFromHtml,
  fetchEmailAttachments,
  fetchEmailContent,
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

// ─── fetchEmailContent ─────────────────────────────────────────────────────

describe('fetchEmailContent', () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns parsed email content on success', async () => {
    const emailData = { id: 'email-123', subject: 'Test', text: 'Hello' }
    mockFetch.mockResolvedValue({ ok: true, json: async () => emailData })

    const result = await fetchEmailContent('email-123')

    expect(result).toEqual(emailData)
  })

  it('calls the Resend API with the correct URL and auth header', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({}) })

    await fetchEmailContent('email-abc')

    expect(mockFetch).toHaveBeenCalledWith(
      'https://api.resend.com/emails/email-abc',
      expect.objectContaining({
        headers: { Authorization: 'Bearer test-resend-key' },
      }),
    )
  })

  it('throws when API response is not ok', async () => {
    mockFetch.mockResolvedValue({ ok: false, statusText: 'Not Found' })

    await expect(fetchEmailContent('bad-id')).rejects.toThrow('Failed to fetch email: Not Found')
  })
})

// ─── fetchEmailAttachments ─────────────────────────────────────────────────

describe('fetchEmailAttachments', () => {
  const mockFetch = vi.fn()

  beforeEach(() => {
    vi.stubGlobal('fetch', mockFetch)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  const attachmentList = [
    { id: 'att-1', filename: 'receipt.pdf', content_type: 'application/pdf', size: 1024 },
  ]

  it('returns attachments with decoded content', async () => {
    const base64Content = Buffer.from('PDF content here').toString('base64')
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: attachmentList }) })
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: { content: base64Content } }) })

    const result = await fetchEmailAttachments('email-123')

    expect(result).toHaveLength(1)
    expect(result[0].filename).toBe('receipt.pdf')
    expect(result[0].content).toBeInstanceOf(Buffer)
    expect(result[0].content.toString()).toBe('PDF content here')
  })

  it('throws when attachment list fetch fails', async () => {
    mockFetch.mockResolvedValue({ ok: false, statusText: 'Server Error' })

    await expect(fetchEmailAttachments('email-123')).rejects.toThrow(
      'Failed to list attachments: Server Error',
    )
  })

  it('skips attachments whose content fetch fails', async () => {
    mockFetch
      .mockResolvedValueOnce({ ok: true, json: async () => ({ data: attachmentList }) })
      .mockResolvedValueOnce({ ok: false, statusText: 'Not Found' })

    const result = await fetchEmailAttachments('email-123')

    expect(result).toHaveLength(0)
  })

  it('returns empty array when no attachments', async () => {
    mockFetch.mockResolvedValue({ ok: true, json: async () => ({ data: [] }) })

    const result = await fetchEmailAttachments('email-123')

    expect(result).toEqual([])
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
