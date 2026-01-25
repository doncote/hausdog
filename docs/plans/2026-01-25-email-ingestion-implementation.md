# Email Ingestion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Enable users to forward receipts/emails to a unique per-property address that feeds into the existing document extraction pipeline.

**Architecture:** Resend inbound email → webhook handler → fetch full email via API → create Documents → trigger existing processing pipeline. Each property gets a unique ingest token generated on creation.

**Tech Stack:** Resend (inbound email + API), TanStack Start (webhook route), Prisma (data model), Trigger.dev (background processing)

---

## Task 1: Add Resend SDK and Environment Variables

**Files:**
- Modify: `apps/web/package.json`
- Modify: `apps/web/src/lib/env.ts`

**Step 1: Install Resend SDK**

Run:
```bash
cd apps/web && bun add resend
```

**Step 2: Add environment variables to schema**

Edit `apps/web/src/lib/env.ts`, add to `serverEnvSchema`:

```typescript
  // Resend - Required for email ingestion
  // Get from: https://resend.com/api-keys
  RESEND_API_KEY: z.string().min(1),
  RESEND_WEBHOOK_SECRET: z.string().min(1).optional(),
  INGEST_EMAIL_DOMAIN: z.string().min(1).optional(),
```

**Step 3: Commit**

```bash
git add apps/web/package.json apps/web/bun.lock apps/web/src/lib/env.ts
git commit -m "chore: add resend SDK and env vars for email ingestion"
```

---

## Task 2: Add Database Fields

**Files:**
- Modify: `apps/web/prisma/schema.prisma`

**Step 1: Add ingestToken to Property model**

Edit `apps/web/prisma/schema.prisma`, add to Property model after `updatedById`:

```prisma
  ingestToken     String?   @unique @map("ingest_token")
```

**Step 2: Add source fields to Document model**

Edit `apps/web/prisma/schema.prisma`, add to Document model after `createdById`:

```prisma
  source          String    @default("upload")  // "upload" | "email"
  sourceEmail     String?   @map("source_email")
```

**Step 3: Generate Prisma client**

Run:
```bash
cd apps/web && bun run prisma generate
```

**Step 4: Create and apply migration**

Run:
```bash
cd apps/web && bun run prisma migrate dev --name add_email_ingestion_fields
```

**Step 5: Commit**

```bash
git add apps/web/prisma/
git commit -m "feat(db): add ingestToken to Property, source fields to Document"
```

---

## Task 3: Create Ingest Token Generator Utility

**Files:**
- Create: `apps/web/src/lib/ingest-token.ts`

**Step 1: Create the utility file**

Create `apps/web/src/lib/ingest-token.ts`:

```typescript
import { randomBytes } from 'crypto'
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
```

**Step 2: Install slugify**

Run:
```bash
cd apps/web && bun add slugify
```

**Step 3: Commit**

```bash
git add apps/web/src/lib/ingest-token.ts apps/web/package.json apps/web/bun.lock
git commit -m "feat: add ingest token generator utility"
```

---

## Task 4: Update PropertyService to Generate Ingest Token on Create

**Files:**
- Modify: `apps/web/src/features/properties/service.ts`
- Modify: `apps/web/src/features/properties/types.ts`

**Step 1: Update PropertyService.create to generate ingestToken**

Edit `apps/web/src/features/properties/service.ts`:

Add import at top:
```typescript
import { generateIngestToken } from '@/lib/ingest-token'
```

In the `create` method, add ingestToken generation:
```typescript
  async create(userId: string, input: CreatePropertyInput): Promise<Property> {
    this.logger.info('Creating property', { userId, name: input.name })

    // Generate ingest token from address or name
    const ingestToken = generateIngestToken(input.address ?? null, input.name)

    const record = await this.db.property.create({
      data: {
        userId,
        name: input.name,
        address: input.address ?? null,
        yearBuilt: input.yearBuilt ?? null,
        squareFeet: input.squareFeet ?? null,
        lotSquareFeet: input.lotSquareFeet ?? null,
        bedrooms: input.bedrooms ?? null,
        bathrooms: input.bathrooms ?? null,
        stories: input.stories ?? null,
        propertyType: input.propertyType ?? null,
        purchaseDate: input.purchaseDate ?? null,
        purchasePrice: input.purchasePrice ?? null,
        estimatedValue: input.estimatedValue ?? null,
        lookupData: input.lookupData as Prisma.InputJsonValue ?? Prisma.DbNull,
        ingestToken,
        createdById: userId,
        updatedById: userId,
      },
    })
    return this.toDomain(record)
  }
```

**Step 2: Update toDomain to include ingestToken**

In `PropertyService`, update the `toDomain` method to include `ingestToken`:
```typescript
  private toDomain(record: PrismaProperty): Property {
    return {
      id: record.id,
      userId: record.userId,
      name: record.name,
      address: record.address,
      yearBuilt: record.yearBuilt,
      squareFeet: record.squareFeet,
      lotSquareFeet: record.lotSquareFeet,
      bedrooms: record.bedrooms,
      bathrooms: record.bathrooms ? Number(record.bathrooms) : null,
      stories: record.stories,
      propertyType: record.propertyType,
      purchaseDate: record.purchaseDate,
      purchasePrice: record.purchasePrice ? Number(record.purchasePrice) : null,
      estimatedValue: record.estimatedValue ? Number(record.estimatedValue) : null,
      lookupData: record.lookupData,
      ingestToken: record.ingestToken,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }
  }
```

**Step 3: Add findByIngestToken method**

Add to `PropertyService`:
```typescript
  async findByIngestToken(token: string): Promise<Property | null> {
    this.logger.debug('Finding property by ingest token', { token })
    const record = await this.db.property.findUnique({
      where: { ingestToken: token },
    })
    return record ? this.toDomain(record) : null
  }
```

**Step 4: Update Property type**

Edit `apps/web/src/features/properties/types.ts`, add to Property interface:
```typescript
  ingestToken: string | null
```

**Step 5: Commit**

```bash
git add apps/web/src/features/properties/service.ts apps/web/src/features/properties/types.ts
git commit -m "feat: generate ingestToken on property creation"
```

---

## Task 5: Update DocumentService for Email Source

**Files:**
- Modify: `apps/web/src/features/documents/service.ts`
- Modify: `apps/web/src/features/documents/types.ts`

**Step 1: Update CreateDocumentInput type**

Edit `apps/web/src/features/documents/types.ts`, update CreateDocumentSchema:
```typescript
export const CreateDocumentSchema = z.object({
  propertyId: z.string().uuid(),
  itemId: z.string().uuid().optional(),
  eventId: z.string().uuid().optional(),
  type: z.string().min(1, 'Type is required'),
  fileName: z.string().min(1, 'File name is required'),
  storagePath: z.string().min(1, 'Storage path is required'),
  contentType: z.string().min(1, 'Content type is required'),
  sizeBytes: z.number().int().positive(),
  source: z.enum(['upload', 'email']).optional(),
  sourceEmail: z.string().email().optional(),
})
```

Update Document interface to include source fields:
```typescript
export interface Document {
  id: string
  propertyId: string
  itemId: string | null
  eventId: string | null
  type: string
  fileName: string
  storagePath: string
  contentType: string
  sizeBytes: number
  status: string
  extractedText: string | null
  extractedData: JsonValue | null
  resolveData: JsonValue | null
  documentDate: Date | null
  source: string
  sourceEmail: string | null
  createdAt: Date
}
```

Add `EMAIL` to DocumentType:
```typescript
export const DocumentType = {
  PHOTO: 'photo',
  RECEIPT: 'receipt',
  MANUAL: 'manual',
  WARRANTY: 'warranty',
  INVOICE: 'invoice',
  EMAIL: 'email',
  OTHER: 'other',
} as const
```

**Step 2: Update DocumentService.create**

Edit `apps/web/src/features/documents/service.ts`, update the create method:
```typescript
  async create(userId: string, input: CreateDocumentInput): Promise<Document> {
    this.logger.info('Creating document', {
      userId,
      propertyId: input.propertyId,
      fileName: input.fileName,
      source: input.source || 'upload',
    })
    const record = await this.db.document.create({
      data: {
        propertyId: input.propertyId,
        itemId: input.itemId ?? null,
        eventId: input.eventId ?? null,
        type: input.type,
        fileName: input.fileName,
        storagePath: input.storagePath,
        contentType: input.contentType,
        sizeBytes: BigInt(input.sizeBytes),
        status: 'pending',
        source: input.source ?? 'upload',
        sourceEmail: input.sourceEmail ?? null,
        createdById: userId,
      },
    })
    return this.toDomain(record)
  }
```

**Step 3: Update toDomain methods**

Update `toDomain` in DocumentService:
```typescript
  private toDomain(record: PrismaDocument): Document {
    return {
      id: record.id,
      propertyId: record.propertyId,
      itemId: record.itemId,
      eventId: record.eventId,
      type: record.type,
      fileName: record.fileName,
      storagePath: record.storagePath,
      contentType: record.contentType,
      sizeBytes: Number(record.sizeBytes),
      status: record.status,
      extractedText: record.extractedText,
      extractedData: record.extractedData,
      resolveData: record.resolveData,
      documentDate: record.documentDate,
      source: record.source,
      sourceEmail: record.sourceEmail,
      createdAt: record.createdAt,
    }
  }
```

**Step 4: Add createFromEmailBody method**

Add to DocumentService for creating documents from email body text:
```typescript
  async createFromEmailBody(
    userId: string,
    propertyId: string,
    emailBody: string,
    sourceEmail: string,
    subject: string,
  ): Promise<Document> {
    this.logger.info('Creating document from email body', {
      userId,
      propertyId,
      sourceEmail,
      subject,
    })

    const fileName = `email-${Date.now()}.txt`

    const record = await this.db.document.create({
      data: {
        propertyId,
        type: 'email',
        fileName,
        storagePath: '', // No file storage for text-only
        contentType: 'text/plain',
        sizeBytes: BigInt(emailBody.length),
        status: 'processing',
        extractedText: emailBody,
        source: 'email',
        sourceEmail,
        createdById: userId,
      },
    })
    return this.toDomain(record)
  }
```

**Step 5: Commit**

```bash
git add apps/web/src/features/documents/service.ts apps/web/src/features/documents/types.ts
git commit -m "feat: add email source support to DocumentService"
```

---

## Task 6: Create Email Ingest Library

**Files:**
- Create: `apps/web/src/lib/email/ingest.ts`

**Step 1: Create the email ingest library**

Create `apps/web/src/lib/email/ingest.ts`:

```typescript
import { Resend } from 'resend'
import crypto from 'crypto'
import { getServerEnv } from '@/lib/env'
import { logger } from '@/lib/logger'

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
    const [version, timestamp, sig] = signature.split(',').map(s => s.trim())

    if (version !== 'v1') {
      logger.warn('Invalid webhook signature version', { version })
      return false
    }

    const signedPayload = `${timestamp}.${payload}`
    const expectedSignature = crypto
      .createHmac('sha256', secret)
      .update(signedPayload)
      .digest('hex')

    return crypto.timingSafeEqual(
      Buffer.from(sig, 'hex'),
      Buffer.from(expectedSignature, 'hex'),
    )
  } catch (error) {
    logger.error('Webhook verification failed', { error })
    return false
  }
}

/**
 * Extract ingest token from email address.
 * e.g., "123-main-st-a7b3c9@ingest.hausdog.app" → "123-main-st-a7b3c9"
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
  const resend = new Resend(env.RESEND_API_KEY)

  // Use the emails.get endpoint for received emails
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
  const listResponse = await fetch(
    `https://api.resend.com/emails/${emailId}/attachments`,
    {
      headers: {
        Authorization: `Bearer ${env.RESEND_API_KEY}`,
      },
    },
  )

  if (!listResponse.ok) {
    throw new Error(`Failed to list attachments: ${listResponse.statusText}`)
  }

  const { data: attachmentList } = await listResponse.json() as {
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

    const { data } = await contentResponse.json() as { data: { content: string } }

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

  return html
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
```

**Step 2: Create directory and commit**

```bash
mkdir -p apps/web/src/lib/email
git add apps/web/src/lib/email/ingest.ts
git commit -m "feat: add email ingest library for Resend webhooks"
```

---

## Task 7: Create Trigger.dev Task for Email Document Resolution

**Files:**
- Create: `apps/web/trigger/resolve-email-document.ts`

**Step 1: Create the task**

Create `apps/web/trigger/resolve-email-document.ts`:

```typescript
import { task } from '@trigger.dev/sdk/v3'
import { PrismaClient } from '@generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { resolveWithClaude } from '@/lib/llm'

interface ResolveEmailDocumentPayload {
  documentId: string
  userId: string
  propertyId: string
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required')
  }
  const adapter = new PrismaPg({ connectionString })
  return new PrismaClient({ adapter })
}

/**
 * Resolve an email document that already has extractedText populated.
 * Skips Gemini extraction and goes straight to Claude resolution.
 */
export const resolveEmailDocumentTask = task({
  id: 'resolve-email-document',
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 10000,
  },
  run: async (payload: ResolveEmailDocumentPayload) => {
    const { documentId, propertyId } = payload
    const prisma = createPrismaClient()

    try {
      // 1. Get document record
      const document = await prisma.document.findUnique({
        where: { id: documentId },
      })

      if (!document) {
        throw new Error(`Document not found: ${documentId}`)
      }

      if (!document.extractedText) {
        throw new Error(`Document has no extractedText: ${documentId}`)
      }

      // 2. Build extracted data from the text for resolution
      const extractedData = {
        documentType: 'email',
        rawText: document.extractedText,
        confidence: 0.8,
      }

      // 3. Update with extracted data
      await prisma.document.update({
        where: { id: documentId },
        data: {
          extractedData: JSON.parse(JSON.stringify(extractedData)),
        },
      })

      // 4. Get inventory for resolution
      const items = await prisma.item.findMany({
        where: { propertyId },
        select: {
          id: true,
          name: true,
          manufacturer: true,
          model: true,
          category: true,
        },
      })

      // 5. Resolve with Claude
      console.log(`Resolving email document ${documentId} with Claude`)
      const resolveData = await resolveWithClaude(extractedData, items)

      // 6. Update document with resolution and mark as ready for review
      await prisma.document.update({
        where: { id: documentId },
        data: {
          resolveData: JSON.parse(JSON.stringify(resolveData)),
          status: 'ready_for_review',
        },
      })

      console.log(`Email document ${documentId} resolved successfully`, {
        action: resolveData.action,
        confidence: resolveData.confidence,
      })

      return {
        documentId,
        extractedData,
        resolveData,
      }
    } catch (error) {
      console.error(`Failed to resolve email document ${documentId}:`, error)

      await prisma.document.update({
        where: { id: documentId },
        data: { status: 'pending' },
      })

      throw error
    } finally {
      await prisma.$disconnect()
    }
  },
})
```

**Step 2: Commit**

```bash
git add apps/web/trigger/resolve-email-document.ts
git commit -m "feat: add Trigger task for email document resolution"
```

---

## Task 8: Create Webhook Route Handler

**Files:**
- Create: `apps/web/src/routes/api/ingest/email.ts`

**Step 1: Create the webhook route**

Create `apps/web/src/routes/api/ingest/email.ts`:

```typescript
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/ingest/email')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Dynamic imports to avoid bundling server modules in client
        const { prisma } = await import('@/lib/db/client')
        const { logger } = await import('@/lib/logger')
        const { getServerEnv } = await import('@/lib/env')
        const { PropertyService } = await import('@/features/properties/service')
        const { DocumentService } = await import('@/features/documents/service')
        const {
          extractIngestToken,
          fetchEmailContent,
          fetchEmailAttachments,
          extractTextFromHtml,
          hasSubstantialContent,
          type InboundEmailWebhook,
        } = await import('@/lib/email/ingest')
        const { createClient } = await import('@supabase/supabase-js')
        const { v4: uuidv4 } = await import('uuid')
        const { tasks, configure } = await import('@trigger.dev/sdk/v3')

        const env = getServerEnv()

        // Configure Trigger.dev
        const triggerKey = process.env.TRIGGER_SECRET_KEY || process.env.TRIGGER_API_KEY
        if (triggerKey) {
          configure({ secretKey: triggerKey })
        }

        try {
          const body = await request.text()
          const payload = JSON.parse(body) as InboundEmailWebhook

          // Verify this is an inbound email event
          if (payload.type !== 'email.received') {
            logger.debug('Ignoring non-inbound webhook', { type: payload.type })
            return new Response('OK', { status: 200 })
          }

          const { data: webhookData } = payload
          logger.info('Received inbound email webhook', {
            emailId: webhookData.email_id,
            from: webhookData.from,
            to: webhookData.to,
            subject: webhookData.subject,
            attachmentCount: webhookData.attachments.length,
          })

          // Extract ingest token from first "to" address
          const toAddress = webhookData.to[0]
          if (!toAddress) {
            logger.warn('No recipient address in webhook')
            return new Response('OK', { status: 200 })
          }

          const token = extractIngestToken(toAddress)
          if (!token) {
            logger.warn('Could not extract ingest token', { toAddress })
            return new Response('OK', { status: 200 })
          }

          // Look up property by ingest token
          const propertyService = new PropertyService({ db: prisma, logger })
          const property = await propertyService.findByIngestToken(token)

          if (!property) {
            logger.warn('Property not found for ingest token', { token })
            return new Response('OK', { status: 200 })
          }

          logger.info('Found property for inbound email', {
            propertyId: property.id,
            propertyName: property.name,
          })

          const documentService = new DocumentService({ db: prisma, logger })
          const supabase = createClient(
            env.SUPABASE_URL,
            env.SUPABASE_SERVICE_KEY || env.SUPABASE_KEY,
          )

          // Process attachments
          if (webhookData.attachments.length > 0) {
            logger.info('Fetching email attachments', {
              count: webhookData.attachments.length,
            })

            const attachments = await fetchEmailAttachments(webhookData.email_id)

            for (const attachment of attachments) {
              // Skip unsupported types
              const supportedTypes = [
                'image/jpeg',
                'image/png',
                'image/gif',
                'image/webp',
                'image/heic',
                'application/pdf',
              ]
              if (!supportedTypes.includes(attachment.content_type)) {
                logger.debug('Skipping unsupported attachment', {
                  filename: attachment.filename,
                  contentType: attachment.content_type,
                })
                continue
              }

              // Upload to Supabase Storage
              const fileId = uuidv4()
              const storagePath = `${property.id}/${property.userId}/${fileId}/${attachment.filename}`

              const { error: uploadError } = await supabase.storage
                .from('documents')
                .upload(storagePath, attachment.content, {
                  contentType: attachment.content_type,
                  upsert: false,
                })

              if (uploadError) {
                logger.error('Failed to upload attachment', {
                  filename: attachment.filename,
                  error: uploadError.message,
                })
                continue
              }

              // Create document record
              const document = await documentService.create(property.userId, {
                propertyId: property.id,
                type: inferDocumentType(attachment.content_type, attachment.filename),
                fileName: attachment.filename,
                storagePath,
                contentType: attachment.content_type,
                sizeBytes: attachment.size,
                source: 'email',
                sourceEmail: webhookData.from,
              })

              logger.info('Created document from email attachment', {
                documentId: document.id,
                filename: attachment.filename,
              })

              // Trigger processing
              try {
                await tasks.trigger('process-document', {
                  documentId: document.id,
                  userId: property.userId,
                  propertyId: property.id,
                })
              } catch (triggerError) {
                logger.error('Failed to trigger document processing', {
                  documentId: document.id,
                  error: triggerError instanceof Error ? triggerError.message : 'Unknown',
                })
              }
            }
          }

          // Process email body if substantial
          const emailContent = await fetchEmailContent(webhookData.email_id)
          const bodyText = emailContent.text || extractTextFromHtml(emailContent.html)

          if (hasSubstantialContent(bodyText)) {
            logger.info('Processing email body as document')

            const document = await documentService.createFromEmailBody(
              property.userId,
              property.id,
              bodyText,
              webhookData.from,
              webhookData.subject,
            )

            logger.info('Created document from email body', {
              documentId: document.id,
            })

            // Trigger resolution (skips extraction)
            try {
              await tasks.trigger('resolve-email-document', {
                documentId: document.id,
                userId: property.userId,
                propertyId: property.id,
              })
            } catch (triggerError) {
              logger.error('Failed to trigger email document resolution', {
                documentId: document.id,
                error: triggerError instanceof Error ? triggerError.message : 'Unknown',
              })
            }
          }

          return new Response('OK', { status: 200 })
        } catch (error) {
          logger.error('Email ingest webhook failed', {
            error: error instanceof Error ? error.message : 'Unknown error',
          })
          // Return 200 to prevent Resend retries for unrecoverable errors
          return new Response('OK', { status: 200 })
        }
      },
    },
  },
})

function inferDocumentType(contentType: string, fileName: string): string {
  const lowerFileName = fileName.toLowerCase()

  if (contentType === 'application/pdf') {
    if (lowerFileName.includes('manual')) return 'manual'
    if (lowerFileName.includes('warranty')) return 'warranty'
    if (lowerFileName.includes('receipt')) return 'receipt'
    if (lowerFileName.includes('invoice')) return 'invoice'
    return 'other'
  }

  if (contentType.startsWith('image/')) {
    if (lowerFileName.includes('receipt')) return 'receipt'
    return 'photo'
  }

  return 'other'
}
```

**Step 2: Create directory structure**

```bash
mkdir -p apps/web/src/routes/api/ingest
```

**Step 3: Commit**

```bash
git add apps/web/src/routes/api/ingest/email.ts
git commit -m "feat: add webhook route for email ingestion"
```

---

## Task 9: Add UI to Display Ingest Address in Settings

**Files:**
- Modify: `apps/web/src/routes/_authenticated/settings.tsx`

**Step 1: Read current settings page**

First, read the current settings page to understand its structure.

**Step 2: Add Email Ingestion section**

Add to the settings page a Card component displaying the property's ingest email:

```tsx
import { Copy, Mail } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/hooks/use-toast'

// In the component, after other settings sections:

function EmailIngestionSection({ property }: { property: Property }) {
  const { toast } = useToast()
  const ingestDomain = import.meta.env.VITE_INGEST_EMAIL_DOMAIN || 'ingest.hausdog.app'
  const ingestEmail = property.ingestToken
    ? `${property.ingestToken}@${ingestDomain}`
    : null

  const copyToClipboard = async () => {
    if (!ingestEmail) return
    await navigator.clipboard.writeText(ingestEmail)
    toast({
      title: 'Copied!',
      description: 'Email address copied to clipboard',
    })
  }

  if (!ingestEmail) return null

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Mail className="h-5 w-5" />
          Email Ingestion
        </CardTitle>
        <CardDescription>
          Forward receipts and invoices to automatically add them to your property.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-2">
          <code className="flex-1 rounded bg-muted px-3 py-2 text-sm font-mono">
            {ingestEmail}
          </code>
          <Button variant="outline" size="icon" onClick={copyToClipboard}>
            <Copy className="h-4 w-4" />
          </Button>
        </div>
        <p className="mt-2 text-sm text-muted-foreground">
          Attachments and email content will appear in your review queue.
        </p>
      </CardContent>
    </Card>
  )
}
```

**Step 3: Add VITE_INGEST_EMAIL_DOMAIN to client env**

Edit `apps/web/src/lib/client-env.ts` (or equivalent) to include:
```typescript
VITE_INGEST_EMAIL_DOMAIN: import.meta.env.VITE_INGEST_EMAIL_DOMAIN,
```

**Step 4: Commit**

```bash
git add apps/web/src/routes/_authenticated/settings.tsx apps/web/src/lib/client-env.ts
git commit -m "feat: add email ingestion address to settings UI"
```

---

## Task 10: Generate Ingest Tokens for Existing Properties

**Files:**
- Create: `apps/web/scripts/backfill-ingest-tokens.ts`

**Step 1: Create backfill script**

Create `apps/web/scripts/backfill-ingest-tokens.ts`:

```typescript
import { PrismaClient } from '@generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { generateIngestToken } from '../src/lib/ingest-token'

async function main() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL required')
  }

  const adapter = new PrismaPg({ connectionString })
  const prisma = new PrismaClient({ adapter })

  try {
    // Find properties without ingest tokens
    const properties = await prisma.property.findMany({
      where: { ingestToken: null },
    })

    console.log(`Found ${properties.length} properties without ingest tokens`)

    for (const property of properties) {
      const token = generateIngestToken(property.address, property.name)

      await prisma.property.update({
        where: { id: property.id },
        data: { ingestToken: token },
      })

      console.log(`Updated property ${property.id}: ${token}`)
    }

    console.log('Backfill complete!')
  } finally {
    await prisma.$disconnect()
  }
}

main().catch(console.error)
```

**Step 2: Run the script**

```bash
cd apps/web && doppler run -- bun run scripts/backfill-ingest-tokens.ts
```

**Step 3: Commit**

```bash
git add apps/web/scripts/backfill-ingest-tokens.ts
git commit -m "feat: add script to backfill ingest tokens for existing properties"
```

---

## Task 11: Configure Resend Webhook in Dashboard

**Manual steps (not code):**

1. Go to Resend Dashboard → Webhooks
2. Create new webhook
3. Set endpoint URL: `https://your-domain.com/api/ingest/email`
4. Select event: `email.received`
5. Copy the signing secret
6. Add to Doppler: `RESEND_WEBHOOK_SECRET=whsec_...`
7. Add to Doppler: `INGEST_EMAIL_DOMAIN=ingest.hausdog.app`

---

## Task 12: Test End-to-End

**Step 1: Start dev server**

```bash
cd apps/web && make dev
```

**Step 2: Test with ngrok (for webhook)**

```bash
ngrok http 3333
```

Update Resend webhook URL to ngrok URL.

**Step 3: Send test email**

Forward an email with an attachment to your property's ingest address.

**Step 4: Verify**

- Check logs for webhook receipt
- Check Documents table for new records
- Check review queue in UI

---

## Summary

| Task | Description |
|------|-------------|
| 1 | Add Resend SDK and env vars |
| 2 | Add database fields (ingestToken, source) |
| 3 | Create ingest token generator |
| 4 | Update PropertyService for token generation |
| 5 | Update DocumentService for email source |
| 6 | Create email ingest library |
| 7 | Create Trigger task for email resolution |
| 8 | Create webhook route handler |
| 9 | Add UI for ingest address |
| 10 | Backfill existing properties |
| 11 | Configure Resend webhook (manual) |
| 12 | Test end-to-end |
