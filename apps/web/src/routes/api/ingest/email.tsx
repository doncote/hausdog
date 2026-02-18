import { createFileRoute } from '@tanstack/react-router'
import type { InboundEmailWebhook } from '@/lib/email/ingest'

export const Route = createFileRoute('/api/ingest/email')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Dynamic imports to avoid bundling server modules in client
        const { prisma } = await import('@/lib/db/client')
        const { consoleLogger: logger } = await import('@/lib/console-logger')
        const { getServerEnv } = await import('@/lib/env')
        const { PropertyService } = await import('@/features/properties/service')
        const { DocumentService } = await import('@/features/documents/service')
        const {
          extractIngestToken,
          fetchEmailContent,
          fetchEmailAttachments,
          extractTextFromHtml,
          hasSubstantialContent,
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
