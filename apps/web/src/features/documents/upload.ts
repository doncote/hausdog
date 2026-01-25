import { createClient } from '@supabase/supabase-js'
import { createServerFn } from '@tanstack/react-start'
import { auth, configure, tasks } from '@trigger.dev/sdk/v3'
import { v4 as uuidv4 } from 'uuid'
import { prisma } from '@/lib/db/client'
import { getServerEnv } from '@/lib/env'
import { logger } from '@/lib/logger'
import type { processDocumentTask } from '../../../trigger/process-document'
import { DocumentService } from './service'
import { DocumentType } from './types'

// Configure Trigger.dev with our API key
function configureTrigger() {
  const apiKey = process.env.TRIGGER_SECRET_KEY || process.env.TRIGGER_API_KEY
  if (apiKey) {
    configure({ secretKey: apiKey })
  }
}

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/heic',
  'application/pdf',
]
const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50MB

interface UploadInput {
  userId: string
  fileName: string
  contentType: string
  fileData: string // base64 encoded
  propertyId: string
  itemId?: string
  eventId?: string
  type?: string
}

export const uploadDocument = createServerFn({ method: 'POST' })
  .inputValidator((d: UploadInput) => d)
  .handler(async ({ data }) => {
    const env = getServerEnv()

    // Validate content type
    if (!ALLOWED_MIME_TYPES.includes(data.contentType)) {
      throw new Error(
        `Invalid file type: ${data.contentType}. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`,
      )
    }

    // Decode base64 and check size
    const fileBuffer = Buffer.from(data.fileData, 'base64')
    if (fileBuffer.length > MAX_FILE_SIZE) {
      throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`)
    }

    // Create Supabase client with service key for storage access
    const supabaseServiceKey = env.SUPABASE_SERVICE_KEY || env.SUPABASE_KEY
    const supabase = createClient(env.SUPABASE_URL, supabaseServiceKey)

    // Generate storage path: property_id/user_id/uuid/filename
    const fileId = uuidv4()
    const storagePath = `${data.propertyId}/${data.userId}/${fileId}/${data.fileName}`

    logger.info('Uploading document to storage', {
      userId: data.userId,
      propertyId: data.propertyId,
      fileName: data.fileName,
      storagePath,
      size: fileBuffer.length,
    })

    // Upload to Supabase Storage
    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, fileBuffer, {
        contentType: data.contentType,
        upsert: false,
      })

    if (uploadError) {
      logger.error('Storage upload failed', { error: uploadError.message })
      throw new Error(`Failed to upload file: ${uploadError.message}`)
    }

    // Determine document type from content type if not provided
    const documentType = data.type || inferDocumentType(data.contentType, data.fileName)

    // Create document record
    const service = new DocumentService({ db: prisma, logger })
    const document = await service.create(data.userId, {
      propertyId: data.propertyId,
      itemId: data.itemId,
      eventId: data.eventId,
      type: documentType,
      fileName: data.fileName,
      storagePath,
      contentType: data.contentType,
      sizeBytes: fileBuffer.length,
    })

    logger.info('Document created', { documentId: document.id })

    // Trigger background processing
    let runId: string | undefined
    let publicAccessToken: string | undefined
    try {
      configureTrigger()
      const handle = await tasks.trigger<typeof processDocumentTask>('process-document', {
        documentId: document.id,
        userId: data.userId,
        propertyId: data.propertyId,
      })
      runId = handle.id
      logger.info('Document processing triggered', { documentId: document.id, runId })

      // Create public token for realtime updates
      publicAccessToken = await auth.createPublicToken({
        scopes: {
          read: { runs: [handle.id] },
        },
        expirationTime: '1h',
      })
    } catch (triggerError) {
      // Log but don't fail the upload if triggering fails
      // Document is still created and can be processed manually
      logger.error('Failed to trigger document processing', {
        documentId: document.id,
        error: triggerError instanceof Error ? triggerError.message : 'Unknown error',
      })
    }

    return { ...document, runId, publicAccessToken }
  })

export const getSignedUrl = createServerFn({ method: 'GET' })
  .inputValidator((d: { storagePath: string; propertyId: string }) => d)
  .handler(async ({ data }) => {
    const env = getServerEnv()
    const supabaseServiceKey = env.SUPABASE_SERVICE_KEY || env.SUPABASE_KEY
    const supabase = createClient(env.SUPABASE_URL, supabaseServiceKey)

    // Verify the path belongs to the property
    if (!data.storagePath.startsWith(`${data.propertyId}/`)) {
      throw new Error('Access denied')
    }

    const { data: signedUrlData, error } = await supabase.storage
      .from('documents')
      .createSignedUrl(data.storagePath, 3600) // 1 hour expiry

    if (error) {
      throw new Error(`Failed to create signed URL: ${error.message}`)
    }

    return { signedUrl: signedUrlData.signedUrl }
  })

export const deleteDocumentFile = createServerFn({ method: 'POST' })
  .inputValidator((d: { storagePath: string; propertyId: string }) => d)
  .handler(async ({ data }) => {
    const env = getServerEnv()
    const supabaseServiceKey = env.SUPABASE_SERVICE_KEY || env.SUPABASE_KEY
    const supabase = createClient(env.SUPABASE_URL, supabaseServiceKey)

    // Verify the path belongs to the property
    if (!data.storagePath.startsWith(`${data.propertyId}/`)) {
      throw new Error('Access denied')
    }

    const { error } = await supabase.storage.from('documents').remove([data.storagePath])

    if (error) {
      throw new Error(`Failed to delete file: ${error.message}`)
    }

    return { success: true }
  })

export const reprocessDocument = createServerFn({ method: 'POST' })
  .inputValidator((d: { documentId: string; userId: string; propertyId: string }) => d)
  .handler(async ({ data }) => {
    logger.info('Reprocessing document', { documentId: data.documentId })

    // Get document to verify it exists and belongs to property
    const service = new DocumentService({ db: prisma, logger })
    const document = await service.findById(data.documentId)

    if (!document) {
      throw new Error('Document not found')
    }

    if (document.propertyId !== data.propertyId) {
      throw new Error('Document does not belong to this property')
    }

    // Reset status to pending
    await service.updateStatus(data.documentId, 'pending')

    // Trigger background processing
    try {
      configureTrigger()
      const handle = await tasks.trigger<typeof processDocumentTask>('process-document', {
        documentId: data.documentId,
        userId: data.userId,
        propertyId: data.propertyId,
      })
      logger.info('Document reprocessing triggered', {
        documentId: data.documentId,
        runId: handle.id,
      })

      // Create public token for realtime updates
      const publicAccessToken = await auth.createPublicToken({
        scopes: {
          read: { runs: [handle.id] },
        },
        expirationTime: '1h',
      })

      return { success: true, runId: handle.id, publicAccessToken }
    } catch (triggerError) {
      logger.error('Failed to trigger document reprocessing', {
        documentId: data.documentId,
        error: triggerError instanceof Error ? triggerError.message : 'Unknown error',
      })
      throw new Error('Failed to start processing. Please check Trigger.dev configuration.')
    }
  })

function inferDocumentType(contentType: string, fileName: string): string {
  const lowerFileName = fileName.toLowerCase()

  if (contentType === 'application/pdf') {
    if (lowerFileName.includes('manual')) return DocumentType.MANUAL
    if (lowerFileName.includes('warranty')) return DocumentType.WARRANTY
    if (lowerFileName.includes('receipt')) return DocumentType.RECEIPT
    if (lowerFileName.includes('invoice')) return DocumentType.INVOICE
    return DocumentType.OTHER
  }

  if (contentType.startsWith('image/')) {
    if (lowerFileName.includes('receipt')) return DocumentType.RECEIPT
    return DocumentType.PHOTO
  }

  return DocumentType.OTHER
}
