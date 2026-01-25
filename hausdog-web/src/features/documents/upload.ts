import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'
import { getServerEnv } from '@/lib/env.server'
import { prisma } from '@/lib/db/client'
import { logger } from '@/lib/logger'
import { DocumentService } from './service'

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
  filename: string
  contentType: string
  fileData: string // base64 encoded
  propertyId?: string
  systemId?: string
  componentId?: string
}

export const uploadDocument = createServerFn({ method: 'POST' })
  .inputValidator((d: UploadInput) => d)
  .handler(async ({ data }) => {
    const env = getServerEnv()

    // Validate content type
    if (!ALLOWED_MIME_TYPES.includes(data.contentType)) {
      throw new Error(`Invalid file type: ${data.contentType}. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}`)
    }

    // Decode base64 and check size
    const fileBuffer = Buffer.from(data.fileData, 'base64')
    if (fileBuffer.length > MAX_FILE_SIZE) {
      throw new Error(`File too large. Maximum size is ${MAX_FILE_SIZE / 1024 / 1024}MB`)
    }

    // Create Supabase client with service key for storage access
    const supabaseServiceKey = env.SUPABASE_SERVICE_KEY || env.SUPABASE_KEY
    const supabase = createClient(env.SUPABASE_URL, supabaseServiceKey)

    // Generate storage path: user_id/uuid/filename
    const fileId = uuidv4()
    const storagePath = `${data.userId}/${fileId}/${data.filename}`

    logger.info('Uploading document to storage', {
      userId: data.userId,
      filename: data.filename,
      storagePath,
      size: fileBuffer.length
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

    // Create document record
    const service = new DocumentService({ db: prisma, logger })
    const document = await service.create(data.userId, {
      filename: data.filename,
      storagePath,
      contentType: data.contentType,
      sizeBytes: fileBuffer.length,
      propertyId: data.propertyId,
      systemId: data.systemId,
      componentId: data.componentId,
    })

    logger.info('Document created', { documentId: document.id })

    return document
  })

export const getSignedUrl = createServerFn({ method: 'GET' })
  .inputValidator((d: { storagePath: string; userId: string }) => d)
  .handler(async ({ data }) => {
    const env = getServerEnv()
    const supabaseServiceKey = env.SUPABASE_SERVICE_KEY || env.SUPABASE_KEY
    const supabase = createClient(env.SUPABASE_URL, supabaseServiceKey)

    // Verify the path belongs to the user
    if (!data.storagePath.startsWith(data.userId + '/')) {
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
