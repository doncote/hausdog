import { task } from '@trigger.dev/sdk/v3'
import { createClient } from '@supabase/supabase-js'
import { PrismaClient } from '@generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { extractWithGemini, resolveWithClaude } from '@/lib/llm'

interface ProcessDocumentPayload {
  documentId: string
  userId: string
  propertyId: string
}

// Create a Prisma client for the task
function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required')
  }
  const adapter = new PrismaPg({ connectionString })
  return new PrismaClient({ adapter })
}

export const processDocumentTask = task({
  id: 'process-document',
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 10000,
  },
  run: async (payload: ProcessDocumentPayload) => {
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

      // 2. Update status to processing
      await prisma.document.update({
        where: { id: documentId },
        data: { status: 'processing' },
      })

      // 3. Get file from Supabase Storage
      const supabaseUrl = process.env.SUPABASE_URL
      const supabaseKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_KEY
      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase credentials not configured')
      }

      const supabase = createClient(supabaseUrl, supabaseKey)

      const { data: fileData, error: downloadError } = await supabase.storage
        .from('documents')
        .download(document.storagePath)

      if (downloadError || !fileData) {
        throw new Error(`Failed to download file: ${downloadError?.message}`)
      }

      // 4. Convert to base64
      const arrayBuffer = await fileData.arrayBuffer()
      const base64Data = Buffer.from(arrayBuffer).toString('base64')

      // 5. Extract with Gemini
      console.log(`Extracting document ${documentId} with Gemini`)
      const extractedData = await extractWithGemini(base64Data, document.contentType)

      // 6. Update document with extraction results
      await prisma.document.update({
        where: { id: documentId },
        data: {
          extractedText: extractedData.rawText,
          extractedData: JSON.parse(JSON.stringify(extractedData)),
        },
      })

      // 7. Get inventory for resolution
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

      // 8. Resolve with Claude
      console.log(`Resolving document ${documentId} with Claude`)
      const resolveData = await resolveWithClaude(extractedData, items)

      // 9. Update document with resolution and mark as ready for review
      await prisma.document.update({
        where: { id: documentId },
        data: {
          resolveData: JSON.parse(JSON.stringify(resolveData)),
          status: 'ready_for_review',
        },
      })

      console.log(`Document ${documentId} processed successfully`, {
        action: resolveData.action,
        confidence: resolveData.confidence,
      })

      return {
        documentId,
        extractedData,
        resolveData,
      }
    } catch (error) {
      console.error(`Failed to process document ${documentId}:`, error)

      // Update status back to pending for retry
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
