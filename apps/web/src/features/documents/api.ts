import { createServerFn } from '@tanstack/react-start'
import { consoleLogger as logger } from '@/lib/console-logger'
import { prisma } from '@/lib/db/client'
import { EventService } from '../events/service'
import { ItemService } from '../items/service'
import { DocumentService } from './service'
import type { CreateDocumentInput, UpdateDocumentInput } from './types'

interface ExtractedData {
  documentType?: string
  confidence?: number
  rawText?: string
  extracted?: {
    manufacturer?: string
    model?: string
    serialNumber?: string
    productName?: string
    date?: string
    price?: number
    vendor?: string
    warrantyExpires?: string
  }
  suggestedItemName?: string
  suggestedCategory?: string
}

interface ResolveData {
  action?: 'NEW_ITEM' | 'ATTACH_TO_ITEM' | 'CHILD_OF_ITEM'
  matchedItemId?: string | null
  confidence?: number
  reasoning?: string
  suggestedEventType?: string | null
}

const getDocumentService = () => new DocumentService({ db: prisma, logger })

export const fetchDocumentsForProperty = createServerFn({ method: 'GET' })
  .inputValidator((d: { propertyId: string }) => d)
  .handler(async ({ data }) => {
    const service = getDocumentService()
    return service.findAllForProperty(data.propertyId)
  })

export const fetchPendingReviewDocuments = createServerFn({ method: 'GET' })
  .inputValidator((d: { propertyId: string }) => d)
  .handler(async ({ data }) => {
    const service = getDocumentService()
    return service.findPendingReview(data.propertyId)
  })

export const fetchDocumentsByStatus = createServerFn({ method: 'GET' })
  .inputValidator((d: { propertyId: string; status: string }) => d)
  .handler(async ({ data }) => {
    const service = getDocumentService()
    return service.findByStatus(data.propertyId, data.status)
  })

export const fetchDocument = createServerFn({ method: 'GET' })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const service = getDocumentService()
    return service.findById(data.id)
  })

export const createDocument = createServerFn({ method: 'POST' })
  .inputValidator((d: { userId: string; input: CreateDocumentInput }) => d)
  .handler(async ({ data }) => {
    const service = getDocumentService()
    return service.create(data.userId, data.input)
  })

export const updateDocument = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string; input: UpdateDocumentInput }) => d)
  .handler(async ({ data }) => {
    const service = getDocumentService()
    return service.update(data.id, data.input)
  })

export const updateDocumentStatus = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string; status: string }) => d)
  .handler(async ({ data }) => {
    const service = getDocumentService()
    return service.updateStatus(data.id, data.status)
  })

export const deleteDocument = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const service = getDocumentService()
    await service.delete(data.id)
    return { success: true }
  })

export const confirmDocumentAndCreateItem = createServerFn({ method: 'POST' })
  .inputValidator(
    (d: {
      documentId: string
      userId: string
      propertyId: string
      // Optional overrides for the extracted data
      overrides?: {
        itemName?: string
        category?: string
        manufacturer?: string
        model?: string
        serialNumber?: string
        spaceId?: string
      }
    }) => d,
  )
  .handler(async ({ data }) => {
    const documentService = getDocumentService()
    const itemService = new ItemService({ db: prisma, logger })
    const eventService = new EventService({ db: prisma, logger })

    // 1. Get the document
    const document = await documentService.findById(data.documentId)
    if (!document) {
      throw new Error('Document not found')
    }

    const extractedData = document.extractedData as ExtractedData | null
    const resolveData = document.resolveData as ResolveData | null

    // Default to NEW_ITEM if no resolve data
    const action = resolveData?.action || 'NEW_ITEM'

    let itemId: string | null = null

    // 2. Handle based on action
    if (action === 'NEW_ITEM' || action === 'CHILD_OF_ITEM') {
      // Create a new item
      const itemName =
        data.overrides?.itemName ||
        extractedData?.suggestedItemName ||
        extractedData?.extracted?.productName ||
        `Item from ${document.fileName}`

      const category = data.overrides?.category || extractedData?.suggestedCategory || 'other'

      const newItem = await itemService.create(data.userId, {
        propertyId: data.propertyId,
        spaceId: data.overrides?.spaceId ?? undefined,
        parentId:
          action === 'CHILD_OF_ITEM' ? (resolveData?.matchedItemId ?? undefined) : undefined,
        name: itemName,
        category,
        manufacturer:
          data.overrides?.manufacturer || extractedData?.extracted?.manufacturer || undefined,
        model: data.overrides?.model || extractedData?.extracted?.model || undefined,
        serialNumber:
          data.overrides?.serialNumber || extractedData?.extracted?.serialNumber || undefined,
        purchasePrice: extractedData?.extracted?.price || undefined,
        acquiredDate: extractedData?.extracted?.date
          ? new Date(extractedData.extracted.date)
          : undefined,
        warrantyExpires: extractedData?.extracted?.warrantyExpires
          ? new Date(extractedData.extracted.warrantyExpires)
          : undefined,
      })

      itemId = newItem.id
      logger.info('Created item from document', { documentId: data.documentId, itemId })
    } else if (action === 'ATTACH_TO_ITEM') {
      // Use the matched item
      itemId = resolveData?.matchedItemId || null
      logger.info('Attaching document to existing item', { documentId: data.documentId, itemId })
    }

    // 3. Create an event if suggested
    let eventId: string | null = null
    if (itemId && resolveData?.suggestedEventType) {
      const vendorInfo = extractedData?.extracted?.vendor
        ? ` (${extractedData.extracted.vendor})`
        : ''
      const event = await eventService.create(data.userId, {
        itemId,
        type: resolveData.suggestedEventType,
        date: extractedData?.extracted?.date ? new Date(extractedData.extracted.date) : new Date(),
        description: `Document: ${document.fileName}${vendorInfo}`,
        cost: extractedData?.extracted?.price || undefined,
      })
      eventId = event.id
      logger.info('Created event from document', { documentId: data.documentId, eventId })
    }

    // 4. Update the document with the item/event link and mark as confirmed
    await documentService.update(data.documentId, {
      itemId,
      eventId,
      status: 'confirmed',
    })

    logger.info('Document confirmed', {
      documentId: data.documentId,
      itemId,
      eventId,
      action,
    })

    return {
      success: true,
      itemId,
      eventId,
      action,
    }
  })
