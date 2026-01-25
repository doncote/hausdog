# Email Ingestion Design

## Overview

Enable users to forward receipts and emails to a unique per-property address, feeding into the existing document extraction pipeline.

**Goal**: Zero-friction capture of receipts, invoices, and service emails without manual upload.

---

## User Experience

1. User finds their property's ingest address in settings (e.g., `123-main-st-a7b3c9@ingest.hausdog.app`)
2. User forwards a receipt email to that address
3. System extracts attachments and email body, processes through LLM pipeline
4. Documents appear in review queue for confirmation

No confirmation email sent - silent processing.

---

## Architecture

```
User forwards email
    ↓
Resend receives at ingest.hausdog.app (catch-all)
    ↓
Webhook POST to /api/ingest/email
    ↓
Parse "to" address → extract ingestToken
    ↓
Look up Property by ingestToken
    ↓
┌─────────────────────────────────────┐
│  For each attachment:               │
│    → Upload to Supabase Storage     │
│    → Create Document (source:email) │
│    → Trigger full extraction        │
│      (Gemini vision → Claude)       │
└─────────────────────────────────────┘
┌─────────────────────────────────────┐
│  For email body (if substantial):   │
│    → Create Document (type:email)   │
│    → Pre-populate extractedText     │
│    → Skip vision, run Claude only   │
└─────────────────────────────────────┘
    ↓
Documents appear in review queue
```

---

## Data Model Changes

### Property table

Add `ingestToken` field:

```prisma
model Property {
  // ... existing fields
  ingestToken  String?  @unique @map("ingest_token")
}
```

Token format: `{address-slug}-{6-char-hex}`
Example: `123-main-st-a7b3c9`

Generated on property creation:

```typescript
function generateIngestToken(address: string | null, propertyName: string): string {
  const base = address || propertyName
  const slug = slugify(base, { lower: true, strict: true })
  const suffix = randomBytes(3).toString('hex')
  return `${slug}-${suffix}`
}
```

### Document table

Add source tracking:

```prisma
model Document {
  // ... existing fields
  source       String   @default("upload")  // "upload" | "email"
  sourceEmail  String?  @map("source_email")  // original sender address
}
```

---

## Webhook Handler

### Route

```
POST /api/ingest/email
```

### Implementation

```typescript
// apps/web/src/routes/api/ingest/email.ts

export const Route = createFileRoute('/api/ingest/email')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { verifyWebhook, parseInboundEmail } = await import('@/lib/email/ingest')
        const { prisma } = await import('@/lib/db/client')
        const { uploadDocument } = await import('@/features/documents/upload')
        const { tasks } = await import('@trigger.dev/sdk')

        // 1. Verify Resend webhook signature
        const signature = request.headers.get('svix-signature')
        const body = await request.text()

        if (!verifyWebhook(body, signature)) {
          return new Response('Invalid signature', { status: 401 })
        }

        // 2. Parse the inbound email
        const email = parseInboundEmail(JSON.parse(body))

        // 3. Extract token from "to" address
        const toAddress = email.to[0]?.address
        const token = toAddress?.split('@')[0]

        if (!token) {
          return new Response('Invalid address', { status: 400 })
        }

        // 4. Look up property
        const property = await prisma.property.findUnique({
          where: { ingestToken: token }
        })

        if (!property) {
          // Silent discard - no error to sender
          return new Response('OK', { status: 200 })
        }

        // 5. Process attachments
        for (const attachment of email.attachments) {
          const document = await uploadDocument({
            propertyId: property.id,
            userId: property.userId,
            file: attachment,
            source: 'email',
            sourceEmail: email.from.address,
          })

          await tasks.trigger('process-document', {
            documentId: document.id,
            userId: property.userId,
            propertyId: property.id,
          })
        }

        // 6. Process email body if substantial
        const bodyText = extractTextFromHtml(email.html) || email.text
        if (bodyText && bodyText.length > 100) {
          const document = await prisma.document.create({
            data: {
              propertyId: property.id,
              type: 'email',
              fileName: `email-${Date.now()}.txt`,
              storagePath: '', // No file storage for text-only
              contentType: 'text/plain',
              sizeBytes: bodyText.length,
              status: 'processing',
              extractedText: bodyText,
              source: 'email',
              sourceEmail: email.from.address,
              createdById: property.userId,
            }
          })

          // Skip extraction, go straight to resolution
          await tasks.trigger('resolve-document', {
            documentId: document.id,
            userId: property.userId,
            propertyId: property.id,
          })
        }

        return new Response('OK', { status: 200 })
      },
    },
  },
})
```

---

## Resend Configuration

### DNS Setup

Add MX records for `ingest.hausdog.app` pointing to Resend's inbound servers.

### Resend Dashboard

1. Add `ingest.hausdog.app` as inbound domain
2. Configure webhook URL: `https://hausdog.app/api/ingest/email`
3. Copy webhook signing secret

### Environment Variables

Add to Doppler:

```
RESEND_WEBHOOK_SECRET=whsec_...
INGEST_EMAIL_DOMAIN=ingest.hausdog.app
```

---

## UI Changes

### Property Settings Page

Add "Email Ingestion" section displaying:

- The property's ingest email address
- Copy-to-clipboard button
- Brief instructions: "Forward receipts and invoices to this address"

```tsx
<Card>
  <CardHeader>
    <CardTitle>Email Ingestion</CardTitle>
    <CardDescription>
      Forward receipts and invoices to automatically add them to your property.
    </CardDescription>
  </CardHeader>
  <CardContent>
    <div className="flex items-center gap-2">
      <code className="flex-1 p-2 bg-muted rounded text-sm">
        {property.ingestToken}@{env.INGEST_EMAIL_DOMAIN}
      </code>
      <Button variant="outline" size="icon" onClick={copyToClipboard}>
        <CopyIcon />
      </Button>
    </div>
  </CardContent>
</Card>
```

---

## Document Types

Add `email` to document types:

```typescript
const DOCUMENT_TYPES = [
  'photo', 'receipt', 'manual', 'warranty', 'invoice', 'email'
] as const
```

---

## Edge Cases

| Scenario | Handling |
|----------|----------|
| Unknown ingest token | Silent discard (200 response) |
| No attachments, empty body | Silent discard |
| Attachment too large | Skip attachment, process others |
| Unsupported attachment type | Skip attachment, process others |
| Email from unknown sender | Process anyway (token is auth) |

---

## Future Enhancements (Not in MVP)

- Confirmation email on successful processing
- Email rules/filters (only process from certain senders)
- Gmail integration for automatic capture
- Per-property email addresses for multi-property users (already supported by design)
- Attachment size limits with user notification
