import { createServerFn } from '@tanstack/react-start'
import type { CreateDocumentInput, ExtractedData } from '@hausdog/domain/documents'
import { prisma } from '@/lib/db/client'
import { logger } from '@/lib/logger'
import { DocumentService } from './service'

const getDocumentService = () => new DocumentService({ db: prisma, logger })

export const fetchDocumentsForUser = createServerFn({ method: 'GET' })
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data }) => {
    const service = getDocumentService()
    return service.findAllForUser(data.userId)
  })

export const fetchDocumentsForProperty = createServerFn({ method: 'GET' })
  .inputValidator((d: { propertyId: string; userId: string }) => d)
  .handler(async ({ data }) => {
    const service = getDocumentService()
    return service.findAllForProperty(data.propertyId, data.userId)
  })

export const fetchDocumentsForSystem = createServerFn({ method: 'GET' })
  .inputValidator((d: { systemId: string; userId: string }) => d)
  .handler(async ({ data }) => {
    const service = getDocumentService()
    return service.findAllForSystem(data.systemId, data.userId)
  })

export const fetchDocument = createServerFn({ method: 'GET' })
  .inputValidator((d: { id: string; userId: string }) => d)
  .handler(async ({ data }) => {
    const service = getDocumentService()
    return service.findById(data.id, data.userId)
  })

export const createDocument = createServerFn({ method: 'POST' })
  .inputValidator((d: { userId: string; input: CreateDocumentInput }) => d)
  .handler(async ({ data }) => {
    const service = getDocumentService()
    return service.create(data.userId, data.input)
  })

export const updateDocumentExtraction = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string; userId: string; extractedData: ExtractedData }) => d)
  .handler(async ({ data }) => {
    const service = getDocumentService()
    return service.updateExtractedData(data.id, data.userId, data.extractedData)
  })

export const updateDocumentStatus = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string; userId: string; status: string; retryCount?: number }) => d)
  .handler(async ({ data }) => {
    const service = getDocumentService()
    return service.updateStatus(data.id, data.userId, data.status, data.retryCount)
  })

export const deleteDocument = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string; userId: string }) => d)
  .handler(async ({ data }) => {
    const service = getDocumentService()
    await service.delete(data.id, data.userId)
    return { success: true }
  })
