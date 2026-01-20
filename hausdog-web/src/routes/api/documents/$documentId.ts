import { createFileRoute } from '@tanstack/react-router'
import { createClient } from '@supabase/supabase-js'

export const Route = createFileRoute('/api/documents/$documentId')({
  server: {
    handlers: {
      // GET /api/documents/:documentId - Get a single document
      GET: async ({ request, params }) => {
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
          const document = await service.findById(params.documentId, userData.user.id)

          if (!document) {
            return new Response(JSON.stringify({ error: 'Document not found' }), {
              status: 404,
              headers: { 'Content-Type': 'application/json' },
            })
          }

          return new Response(JSON.stringify(document), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (error) {
          logger.error('API error getting document', { error, documentId: params.documentId })
          return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      },

      // DELETE /api/documents/:documentId - Delete a document
      DELETE: async ({ request, params }) => {
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
          await service.delete(params.documentId, userData.user.id)

          logger.info('Document deleted via API', { documentId: params.documentId })

          return new Response(JSON.stringify({ success: true }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
          })
        } catch (error) {
          logger.error('API error deleting document', { error, documentId: params.documentId })
          return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
          })
        }
      },
    },
  },
})
