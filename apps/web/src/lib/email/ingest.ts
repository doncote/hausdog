import crypto from 'node:crypto'
import { getServerEnv } from '@/lib/env'
import { consoleLogger as logger } from '@/lib/console-logger'

/**
 * Inbound email webhook payload from Resend.
 * Note: This only contains metadata. Body and attachments require API calls.
 */
export interface InboundEmailWebhook {
  type: 'email.received'
  created_at: string
  data: {
    email_id: string
    created_at: string
    from: string
    to: string[]
    cc: string[]
    bcc: string[]
    message_id: string
    subject: string
    attachments: Array<{
      filename: string
      content_type: string
      size: number
    }>
  }
}

/**
 * Full email content from Resend API.
 */
export interface InboundEmailContent {
  id: string
  from: string
  to: string[]
  subject: string
  text?: string
  html?: string
  created_at: string
}

/**
 * Attachment metadata and content.
 */
export interface EmailAttachment {
  id: string
  filename: string
  content_type: string
  size: number
  content: Buffer
}

/**
 * Verify Resend webhook signature.
 */
export function verifyWebhookSignature(
  payload: string,
  signature: string | null,
  secret: string,
): boolean {
  if (!signature || !secret) {
    logger.warn('Missing webhook signature or secret')
    return false
  }

  try {
    // Resend uses Svix for webhooks
    // Format: v1,timestamp signature
    const [version, timestamp, sig] = signature.split(',').map((s) => s.trim())

    if (version !== 'v1') {
      logger.warn('Invalid webhook signature version', { version })
      return false
    }

    const signedPayload = `${timestamp}.${payload}`
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex')

    return crypto.timingSafeEqual(Buffer.from(sig, 'hex'), Buffer.from(expectedSignature, 'hex'))
  } catch (error) {
    logger.error('Webhook verification failed', { error })
    return false
  }
}

/**
 * Extract ingest token from email address.
 * e.g., "123-main-st-a7b3c9@hausdog.app" → "123-main-st-a7b3c9"
 */
export function extractIngestToken(emailAddress: string): string | null {
  const [localPart] = emailAddress.split('@')
  return localPart || null
}

/**
 * Fetch full email content from Resend API.
 */
export async function fetchEmailContent(emailId: string): Promise<InboundEmailContent> {
  const env = getServerEnv()

  const response = await fetch(`https://api.resend.com/emails/${emailId}`, {
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
    },
  })

  if (!response.ok) {
    throw new Error(`Failed to fetch email: ${response.statusText}`)
  }

  return response.json()
}

/**
 * Fetch attachments for an email.
 */
export async function fetchEmailAttachments(emailId: string): Promise<EmailAttachment[]> {
  const env = getServerEnv()

  // List attachments
  const listResponse = await fetch(`https://api.resend.com/emails/${emailId}/attachments`, {
    headers: {
      Authorization: `Bearer ${env.RESEND_API_KEY}`,
    },
  })

  if (!listResponse.ok) {
    throw new Error(`Failed to list attachments: ${listResponse.statusText}`)
  }

  const { data: attachmentList } = (await listResponse.json()) as {
    data: Array<{ id: string; filename: string; content_type: string; size: number }>
  }

  // Fetch each attachment's content
  const attachments: EmailAttachment[] = []
  for (const att of attachmentList) {
    const contentResponse = await fetch(
      `https://api.resend.com/emails/${emailId}/attachments/${att.id}`,
      {
        headers: {
          Authorization: `Bearer ${env.RESEND_API_KEY}`,
        },
      },
    )

    if (!contentResponse.ok) {
      logger.warn('Failed to fetch attachment', { emailId, attachmentId: att.id })
      continue
    }

    const { data } = (await contentResponse.json()) as { data: { content: string } }

    attachments.push({
      id: att.id,
      filename: att.filename,
      content_type: att.content_type,
      size: att.size,
      content: Buffer.from(data.content, 'base64'),
    })
  }

  return attachments
}

/**
 * Strip HTML tags and decode entities to get plain text.
 */
export function extractTextFromHtml(html: string | undefined): string {
  if (!html) return ''

  return (
    html
      // Remove script and style tags with content
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      // Remove HTML tags
      .replace(/<[^>]+>/g, ' ')
      // Decode common HTML entities
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      // Collapse whitespace
      .replace(/\s+/g, ' ')
      .trim()
  )
}

/**
 * Check if email body has meaningful content (not just forwarding headers/signatures).
 */
export function hasSubstantialContent(text: string): boolean {
  if (!text) return false

  // Remove common forward/reply prefixes
  const cleaned = text
    .replace(/^(fw:|fwd:|re:)\s*/gi, '')
    .replace(/^-+\s*forwarded message\s*-+$/gim, '')
    .replace(/^-+\s*original message\s*-+$/gim, '')
    .trim()

  // Minimum 100 chars of actual content
  return cleaned.length >= 100
}
