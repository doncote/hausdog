import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'
import { z } from 'zod'

// Input validation schema
const createDocumentSchema = z.object({
  storagePath: z.string(),
  filename: z.string(),
  contentType: z.string(),
  propertyId: z.string().optional(),
  systemId: z.string().optional(),
  componentId: z.string().optional(),
})

export const Route = createFileRoute('/api/documents/')({
  server: {
    handlers: {
      // POST /api/documents - Create a document record (after mobile uploads to storage)
      POST: async ({ request }) => {
        const { getServerEnv } = await import('@/lib/env.server')
        const { prisma } = await import('@/lib/db/client')
        const { logger } = await import('@/lib/logger')
        const { DocumentService } = await import('@/features/documents/service')

        try {
          // Extract user from Authorization header (Bearer token)
          const authHeader = request.headers.get('Authorization')
          if (!authHeader?.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
              status: 401,
              headers: { 'Content-Type': 'application/json' },
            })
          }

          const token = authHeader.slice(7)
          const env = getServerEnv()

          // Verify token with Supabase
          const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY)
          const { data: userData, error: authError } = await supabase.auth.getUser(token)

          if (authError || !userData.user) {
            return new Response(JSON.stringify({ error: 'Invalid token' }), {
              status: 401,
              headers: { 'Content-Type': 'application/json' },
            })
          }

          const userId = userData.user.id

          // Parse and validate body
          const body = await request.json()
          const parsed = createDocumentSchema.safeParse(body)

          if (!parsed.success) {
            return new Response(JSON.stringify({ error: 'Invalid request', details: parsed.error.issues }), {
              status: 400,
              headers: { 'Content-Type': 'application/json' },
            })
          }

          const data = parsed.data

          // Verify storage path belongs to user
          if (!data.storagePath.startsWith(userId + '/')) {
            return new Response(JSON.stringify({ error: 'Storage path mismatch' }), {
              status: 403,
              headers: { 'Content-Type': 'application/json' },
            })
          }

          // Get file info from storage
          const supabaseService = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY || env.SUPABASE_KEY)
          const { data: fileList } = await supabaseService.storage
            .from('documents')
            .list(data.storagePath.split('/').slice(0, -1).join('/'))

          const filename = data.storagePath.split('/').pop() || data.filename
          const fileInfo = fileList?.find(f => f.name === filename)
          const sizeBytes = fileInfo?.metadata?.size || 0

          // Create document record
          const service = new DocumentService({ db: prisma, logger })
          const document = await service.create(userId, {
            filename: data.filename,
            storagePath: data.storagePath,
            contentType: data.contentType,
            sizeBytes,
            propertyId: data.propertyId,
            systemId: data.systemId,
            componentId: data.componentId,
          })

          logger.info('Document created via API', { documentId: document.id, userId })

          return new Response(JSON.stringify(document), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (error) {
          logger.error('API error creating document', { error })
          return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      },

      // GET /api/documents - List user's documents
      GET: async ({ request }) => {
        const { getServerEnv } = await import('@/lib/env.server')
        const { prisma } = await import('@/lib/db/client')
        const { logger } = await import('@/lib/logger')
        const { DocumentService } = await import('@/features/documents/service')

        try {
          const authHeader = request.headers.get('Authorization')
          if (!authHeader?.startsWith('Bearer ')) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), {
              status: 401,
              headers: { 'Content-Type': 'application/json' },
            })
          }

          const token = authHeader.slice(7)
          const env = getServerEnv()

          const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_KEY)
          const { data: userData, error: authError } = await supabase.auth.getUser(token)

          if (authError || !userData.user) {
            return new Response(JSON.stringify({ error: 'Invalid token' }), {
              status: 401,
              headers: { 'Content-Type': 'application/json' },
            })
          }

          const service = new DocumentService({ db: prisma, logger })
          const documents = await service.findAllForUser(userData.user.id)

          return new Response(JSON.stringify(documents), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (error) {
          logger.error('API error listing documents', { error })
          return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      },
    },
  },
})
