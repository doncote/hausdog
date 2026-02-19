import { task } from '@trigger.dev/sdk/v3'
import { PrismaClient } from '@generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { resolveWithClaude, type GeminiExtractionResult } from '@/lib/llm'

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
      const extractedData: GeminiExtractionResult = {
        documentType: 'email',
        rawText: document.extractedText,
        confidence: 0.8,
        extracted: {
          manufacturer: null,
          model: null,
          serialNumber: null,
          productName: null,
          date: null,
          price: null,
          vendor: null,
          warrantyExpires: null,
          specs: {},
        },
        suggestedItemName: 'Email Document',
        suggestedDescription: '',
        suggestedCategory: 'other',
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
