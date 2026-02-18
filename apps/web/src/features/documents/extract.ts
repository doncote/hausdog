import { createClient } from '@supabase/supabase-js'
import { createServerFn } from '@tanstack/react-start'
import { ItemService } from '@/features/items/service'
import { consoleLogger as logger } from '@/lib/console-logger'
import { prisma } from '@/lib/db/client'
import { getServerEnv } from '@/lib/env'
import { extractWithGemini, resolveWithClaude } from '@/lib/llm'
import { DocumentService } from './service'

interface ExtractDocumentInput {
  documentId: string
  userId: string
  propertyId: string
}

/**
 * Extract information from a document using Gemini Vision API.
 * Updates the document with extracted data and marks as processing.
 */
export const extractDocument = createServerFn({ method: 'POST' })
  .inputValidator((d: ExtractDocumentInput) => d)
  .handler(async ({ data }) => {
    const env = getServerEnv()
    const documentService = new DocumentService({ db: prisma, logger })

    // Get the document
    const document = await documentService.findById(data.documentId)
    if (!document) {
      throw new Error('Document not found')
    }

    // Update status to processing
    await documentService.updateStatus(data.documentId, 'processing')

    try {
      // Get file from Supabase Storage
      const supabaseServiceKey = env.SUPABASE_SERVICE_KEY || env.SUPABASE_KEY
      const supabase = createClient(env.SUPABASE_URL, supabaseServiceKey)

      const { data: fileData, error: downloadError } = await supabase.storage
        .from('documents')
        .download(document.storagePath)

      if (downloadError || !fileData) {
        throw new Error(`Failed to download file: ${downloadError?.message}`)
      }

      // Convert to base64
      const arrayBuffer = await fileData.arrayBuffer()
      const base64Data = Buffer.from(arrayBuffer).toString('base64')

      logger.info('Starting document extraction', { documentId: document.id })

      // Extract with Gemini
      const extractedData = await extractWithGemini(base64Data, document.contentType)

      // Update document with extraction results
      const updatedDocument = await documentService.update(data.documentId, {
        extractedText: extractedData.rawText,
        extractedData: extractedData as unknown as Record<string, unknown>,
        status: 'ready_for_review',
      })

      logger.info('Document extraction complete', {
        documentId: document.id,
        documentType: extractedData.documentType,
      })

      return updatedDocument
    } catch (error) {
      logger.error('Document extraction failed', {
        documentId: document.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      // Update status to failed (keep as pending for retry)
      await documentService.updateStatus(data.documentId, 'pending')

      throw error
    }
  })

interface ResolveDocumentInput {
  documentId: string
  userId: string
  propertyId: string
}

/**
 * Resolve how a document should be handled using Claude.
 * Determines if this is a new item, should attach to existing, or is a child component.
 */
export const resolveDocument = createServerFn({ method: 'POST' })
  .inputValidator((d: ResolveDocumentInput) => d)
  .handler(async ({ data }) => {
    const documentService = new DocumentService({ db: prisma, logger })
    const itemService = new ItemService({ db: prisma, logger })

    // Get the document with extracted data
    const document = await documentService.findById(data.documentId)
    if (!document) {
      throw new Error('Document not found')
    }

    if (!document.extractedData) {
      throw new Error('Document has not been extracted yet')
    }

    // Get user's inventory for this property
    const items = await itemService.findAllForProperty(data.propertyId)
    const inventory = items.map((item) => ({
      id: item.id,
      name: item.name,
      manufacturer: item.manufacturer,
      model: item.model,
      category: item.category,
    }))

    logger.info('Starting document resolution', {
      documentId: document.id,
      inventoryCount: inventory.length,
    })

    // Resolve with Claude
    const resolveData = await resolveWithClaude(
      document.extractedData as Parameters<typeof resolveWithClaude>[0],
      inventory,
    )

    // Update document with resolution results
    const updatedDocument = await documentService.update(data.documentId, {
      resolveData: resolveData as unknown as Record<string, unknown>,
    })

    logger.info('Document resolution complete', {
      documentId: document.id,
      action: resolveData.action,
      matchedItemId: resolveData.matchedItemId,
    })

    return updatedDocument
  })

interface ProcessDocumentInput {
  documentId: string
  userId: string
  propertyId: string
}

/**
 * Full document processing pipeline: extract then resolve.
 * This is the main entry point for processing uploaded documents.
 */
export const processDocument = createServerFn({ method: 'POST' })
  .inputValidator((d: ProcessDocumentInput) => d)
  .handler(async ({ data }) => {
    logger.info('Starting full document processing', { documentId: data.documentId })

    // Step 1: Extract with Gemini
    await extractDocument({ data })

    // Step 2: Resolve with Claude
    const result = await resolveDocument({ data })

    logger.info('Full document processing complete', {
      documentId: data.documentId,
      status: result.status,
    })

    return result
  })
