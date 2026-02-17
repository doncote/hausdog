import { createRoute, OpenAPIHono, z } from '@hono/zod-openapi'
import { createClient } from '@supabase/supabase-js'
import { configure, tasks } from '@trigger.dev/sdk/v3'
import { v4 as uuidv4 } from 'uuid'
import { DocumentService } from '@/features/documents/service'
import { PropertyService } from '@/features/properties/service'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import type { AuthContext } from '../middleware/auth'

const documentService = new DocumentService({ db: prisma, logger })
const propertyService = new PropertyService({ db: prisma, logger })

// Configure Trigger.dev if available
const triggerKey = process.env.TRIGGER_SECRET_KEY || process.env.TRIGGER_API_KEY
if (triggerKey) {
  configure({ secretKey: triggerKey })
}

// Response schemas
const DocumentSchema = z.object({
  id: z.string().uuid(),
  propertyId: z.string().uuid(),
  itemId: z.string().uuid().nullable(),
  eventId: z.string().uuid().nullable(),
  type: z.string(),
  fileName: z.string(),
  storagePath: z.string(),
  contentType: z.string(),
  sizeBytes: z.number(),
  status: z.string(),
  extractedText: z.string().nullable(),
  extractedData: z.any().nullable(),
  resolveData: z.any().nullable(),
  documentDate: z.string().datetime().nullable(),
  source: z.string(),
  sourceEmail: z.string().nullable(),
  createdAt: z.string().datetime(),
})

const DocumentWithRelationsSchema = DocumentSchema.extend({
  property: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
    })
    .optional(),
  item: z
    .object({
      id: z.string().uuid(),
      name: z.string(),
    })
    .nullable()
    .optional(),
  event: z
    .object({
      id: z.string().uuid(),
      type: z.string(),
      date: z.string().datetime(),
    })
    .nullable()
    .optional(),
})

const UploadResponseSchema = z.object({
  id: z.string().uuid(),
  status: z.string(),
  fileName: z.string(),
  message: z.string(),
})

const ErrorSchema = z.object({
  error: z.string(),
  message: z.string(),
})

// Routes
const listDocuments = createRoute({
  method: 'get',
  path: '/properties/{propertyId}/documents',
  tags: ['Documents'],
  summary: 'List documents for a property',
  request: {
    params: z.object({
      propertyId: z.string().uuid(),
    }),
    query: z.object({
      itemId: z.string().uuid().optional(),
      status: z.string().optional(),
    }),
  },
  responses: {
    200: {
      description: 'List of documents',
      content: {
        'application/json': {
          schema: z.array(DocumentWithRelationsSchema),
        },
      },
    },
    404: {
      description: 'Property not found',
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
    },
  },
})

const getDocument = createRoute({
  method: 'get',
  path: '/documents/{id}',
  tags: ['Documents'],
  summary: 'Get a document',
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
  },
  responses: {
    200: {
      description: 'Document details',
      content: {
        'application/json': {
          schema: DocumentWithRelationsSchema,
        },
      },
    },
    404: {
      description: 'Document not found',
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
    },
  },
})

const uploadDocument = createRoute({
  method: 'post',
  path: '/properties/{propertyId}/documents/upload',
  tags: ['Documents'],
  summary: 'Upload a document',
  description: 'Upload a file to be processed. Supports multipart form data.',
  request: {
    params: z.object({
      propertyId: z.string().uuid(),
    }),
    query: z.object({
      itemId: z.string().uuid().optional(),
    }),
    body: {
      content: {
        'multipart/form-data': {
          schema: z.object({
            file: z.any().openapi({ type: 'string', format: 'binary' }),
          }),
        },
      },
    },
  },
  responses: {
    201: {
      description: 'Document uploaded and queued for processing',
      content: {
        'application/json': {
          schema: UploadResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid file or missing data',
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
    },
    404: {
      description: 'Property not found',
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
    },
    500: {
      description: 'Server error',
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
    },
  },
})

const deleteDocument = createRoute({
  method: 'delete',
  path: '/documents/{id}',
  tags: ['Documents'],
  summary: 'Delete a document',
  request: {
    params: z.object({
      id: z.string().uuid(),
    }),
  },
  responses: {
    204: {
      description: 'Document deleted',
    },
    404: {
      description: 'Document not found',
      content: {
        'application/json': {
          schema: ErrorSchema,
        },
      },
    },
  },
})

// Helper to serialize document
function serializeDocument(doc: any) {
  return {
    ...doc,
    documentDate: doc.documentDate?.toISOString() ?? null,
    createdAt: doc.createdAt.toISOString(),
    event: doc.event
      ? {
          ...doc.event,
          date: doc.event.date.toISOString(),
        }
      : doc.event,
  }
}

// Infer document type from content type and filename
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

// Create router
export const documentsRouter = new OpenAPIHono<{ Variables: AuthContext }>()

documentsRouter.openapi(listDocuments, async (c) => {
  const userId = c.get('userId')
  const { propertyId } = c.req.valid('param')
  const { status } = c.req.valid('query')

  const property = await propertyService.findById(propertyId, userId)
  if (!property) {
    return c.json({ error: 'not_found', message: 'Property not found' }, 404)
  }

  const documents = status
    ? await documentService.findByStatus(propertyId, status)
    : await documentService.findAllForProperty(propertyId)

  return c.json(documents.map(serializeDocument), 200)
})

documentsRouter.openapi(getDocument, async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.valid('param')
  const doc = await documentService.findById(id)

  if (!doc) {
    return c.json({ error: 'not_found', message: 'Document not found' }, 404)
  }

  // Verify ownership through property
  const property = await propertyService.findById(doc.propertyId, userId)
  if (!property) {
    return c.json({ error: 'not_found', message: 'Document not found' }, 404)
  }

  return c.json(serializeDocument(doc), 200)
})

documentsRouter.openapi(uploadDocument, async (c) => {
  const userId = c.get('userId')
  const { propertyId } = c.req.valid('param')
  const { itemId } = c.req.valid('query')

  const property = await propertyService.findById(propertyId, userId)
  if (!property) {
    return c.json({ error: 'not_found', message: 'Property not found' }, 404)
  }

  // Get form data
  const formData = await c.req.formData()
  const file = formData.get('file')

  if (!file || !(file instanceof File)) {
    return c.json({ error: 'bad_request', message: 'No file provided' }, 400)
  }

  // Detect MIME type from extension if client didn't provide it
  const mimeByExt: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.webp': 'image/webp',
    '.heic': 'image/heic',
    '.pdf': 'application/pdf',
  }
  const ext = file.name.toLowerCase().match(/\.[^.]+$/)?.[0] || ''
  const contentType =
    file.type && file.type !== 'application/octet-stream' ? file.type : mimeByExt[ext] || file.type

  // Validate file type
  const supportedTypes = [
    'image/jpeg',
    'image/png',
    'image/gif',
    'image/webp',
    'image/heic',
    'application/pdf',
  ]
  if (!supportedTypes.includes(contentType)) {
    return c.json({ error: 'bad_request', message: `Unsupported file type: ${contentType}` }, 400)
  }

  // Get Supabase client
  const supabaseUrl = process.env.SUPABASE_URL
  const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
  if (!supabaseUrl || !supabaseKey) {
    logger.error('Missing Supabase configuration')
    return c.json({ error: 'server_error', message: 'Storage not configured' }, 500)
  }

  const supabase = createClient(supabaseUrl, supabaseKey)

  // Upload to storage
  const fileId = uuidv4()
  const storagePath = `${propertyId}/${userId}/${fileId}/${file.name}`
  const fileBuffer = await file.arrayBuffer()

  const { error: uploadError } = await supabase.storage
    .from('documents')
    .upload(storagePath, fileBuffer, {
      contentType,
      upsert: false,
    })

  if (uploadError) {
    logger.error('Failed to upload file', { error: uploadError.message })
    return c.json({ error: 'upload_failed', message: uploadError.message }, 500)
  }

  // Create document record
  const document = await documentService.create(userId, {
    propertyId,
    itemId: itemId ?? undefined,
    type: inferDocumentType(contentType, file.name),
    fileName: file.name,
    storagePath,
    contentType,
    sizeBytes: file.size,
    source: 'upload',
  })

  // Trigger processing task
  try {
    await tasks.trigger('process-document', {
      documentId: document.id,
      userId,
      propertyId,
    })
  } catch (triggerError) {
    logger.error('Failed to trigger document processing', {
      documentId: document.id,
      error: triggerError instanceof Error ? triggerError.message : 'Unknown',
    })
    // Don't fail the upload - document is stored, can be processed later
  }

  return c.json(
    {
      id: document.id,
      status: document.status,
      fileName: document.fileName,
      message: 'Document queued for processing',
    },
    201,
  )
})

documentsRouter.openapi(deleteDocument, async (c) => {
  const userId = c.get('userId')
  const { id } = c.req.valid('param')

  const existing = await documentService.findById(id)
  if (!existing) {
    return c.json({ error: 'not_found', message: 'Document not found' }, 404)
  }

  // Verify ownership through property
  const property = await propertyService.findById(existing.propertyId, userId)
  if (!property) {
    return c.json({ error: 'not_found', message: 'Document not found' }, 404)
  }

  // TODO: Also delete from storage

  await documentService.delete(id)
  return c.body(null, 204)
})
