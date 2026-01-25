import { createServerFn } from '@tanstack/react-start'
import { prisma } from '@/lib/db/client'
import { logger } from '@/lib/logger'
import { DocumentService } from './service'
import type { CreateDocumentInput, UpdateDocumentInput } from './types'

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
