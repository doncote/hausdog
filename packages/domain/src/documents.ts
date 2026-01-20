import { z } from 'zod'

// Document types
export const documentTypes = [
  'manual',
  'receipt',
  'invoice',
  'warranty',
  'permit',
  'inspection',
  'service_record',
  'photo',
  'other',
] as const
export const documentTypeSchema = z.enum(documentTypes)
export type DocumentType = z.infer<typeof documentTypeSchema>

// Processing status
export const processingStatuses = ['pending', 'processing', 'complete', 'failed'] as const
export const processingStatusSchema = z.enum(processingStatuses)
export type ProcessingStatus = z.infer<typeof processingStatusSchema>

// Extracted data schema (from AI extraction)
export const extractedEquipmentSchema = z.object({
  manufacturer: z.string().nullish(),
  model: z.string().nullish(),
  serialNumber: z.string().nullish(),
  capacity: z.string().nullish(),
  specs: z.record(z.string()).nullish(),
})

export const extractedFinancialSchema = z.object({
  vendor: z.string().nullish(),
  amount: z.number().nullish(),
  currency: z.string().nullish(),
  invoiceNumber: z.string().nullish(),
  receiptNumber: z.string().nullish(),
})

export const extractedServiceSchema = z.object({
  serviceType: z.string().nullish(),
  provider: z.string().nullish(),
  technician: z.string().nullish(),
  workPerformed: z.string().nullish(),
  partsUsed: z.array(z.string()).nullish(),
})

export const extractedWarrantySchema = z.object({
  warrantyType: z.string().nullish(),
  coverageStart: z.coerce.date().nullish(),
  coverageEnd: z.coerce.date().nullish(),
  provider: z.string().nullish(),
  policyNumber: z.string().nullish(),
})

export const extractedDataSchema = z.object({
  documentType: documentTypeSchema.nullish(),
  confidence: z.number().min(0).max(1).nullish(),
  equipment: extractedEquipmentSchema.nullish(),
  financial: extractedFinancialSchema.nullish(),
  service: extractedServiceSchema.nullish(),
  warranty: extractedWarrantySchema.nullish(),
  suggestedCategory: z.string().nullish(),
  rawText: z.string().nullish(),
})
export type ExtractedData = z.infer<typeof extractedDataSchema>

// Main schema
export const documentSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  propertyId: z.string().uuid().nullable(),
  systemId: z.string().uuid().nullable(),
  componentId: z.string().uuid().nullable(),
  filename: z.string(),
  storagePath: z.string(),
  contentType: z.string(),
  sizeBytes: z.number(),
  extractedData: extractedDataSchema.nullable(),
  processingStatus: processingStatusSchema,
  retryCount: z.number(),
  processedAt: z.coerce.date().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})
export type Document = z.infer<typeof documentSchema>

// API schema (ISO datetime strings for OpenAPI compatibility)
export const documentApiSchema = documentSchema
  .omit({ processedAt: true, createdAt: true, updatedAt: true })
  .extend({
    processedAt: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
export type DocumentApi = z.infer<typeof documentApiSchema>

// Converter: Domain -> API
export const toDocumentApi = (doc: Document): DocumentApi => ({
  ...doc,
  processedAt: doc.processedAt?.toISOString() ?? null,
  createdAt: doc.createdAt.toISOString(),
  updatedAt: doc.updatedAt.toISOString(),
})

// Converter: API -> Domain
export const fromDocumentApi = (api: DocumentApi): Document => ({
  ...api,
  processedAt: api.processedAt ? new Date(api.processedAt) : null,
  createdAt: new Date(api.createdAt),
  updatedAt: new Date(api.updatedAt),
})

// Create schema
export const createDocumentSchema = z.object({
  filename: z.string().min(1),
  storagePath: z.string().min(1),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  propertyId: z.string().uuid().nullish(),
  systemId: z.string().uuid().nullish(),
  componentId: z.string().uuid().nullish(),
})
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>

// Update schema (for linking)
export const updateDocumentSchema = z.object({
  propertyId: z.string().uuid().nullish(),
  systemId: z.string().uuid().nullish(),
  componentId: z.string().uuid().nullish(),
})
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>
