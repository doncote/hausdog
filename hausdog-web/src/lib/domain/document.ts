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

// Processing status
export const processingStatuses = ['pending', 'processing', 'complete', 'failed'] as const

export const processingStatusSchema = z.enum(processingStatuses)

// Extracted data schema (from AI extraction)
export const extractedEquipmentSchema = z.object({
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  capacity: z.string().optional(),
  specs: z.record(z.string()).optional(),
})

export const extractedFinancialSchema = z.object({
  vendor: z.string().optional(),
  amount: z.number().optional(),
  currency: z.string().optional(),
  invoiceNumber: z.string().optional(),
  receiptNumber: z.string().optional(),
})

export const extractedServiceSchema = z.object({
  serviceType: z.string().optional(),
  provider: z.string().optional(),
  technician: z.string().optional(),
  workPerformed: z.string().optional(),
  partsUsed: z.array(z.string()).optional(),
})

export const extractedWarrantySchema = z.object({
  warrantyType: z.string().optional(),
  coverageStart: z.date().optional(),
  coverageEnd: z.date().optional(),
  provider: z.string().optional(),
  policyNumber: z.string().optional(),
})

export const extractedDataSchema = z.object({
  documentType: documentTypeSchema.optional(),
  confidence: z.number().min(0).max(1).optional(),
  equipment: extractedEquipmentSchema.optional(),
  financial: extractedFinancialSchema.optional(),
  service: extractedServiceSchema.optional(),
  warranty: extractedWarrantySchema.optional(),
  suggestedCategory: z.string().optional(),
  rawText: z.string().optional(),
})

// Base schema for input (upload)
export const createDocumentSchema = z.object({
  filename: z.string().min(1),
  storagePath: z.string().min(1),
  contentType: z.string().min(1),
  sizeBytes: z.number().int().positive(),
  propertyId: z.string().uuid().optional(),
  systemId: z.string().uuid().optional(),
  componentId: z.string().uuid().optional(),
})

// Update schema (for linking)
export const updateDocumentSchema = z.object({
  propertyId: z.string().uuid().optional().nullable(),
  systemId: z.string().uuid().optional().nullable(),
  componentId: z.string().uuid().optional().nullable(),
})

// Full domain type
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
  processedAt: z.date().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

// Derived types
export type DocumentType = z.infer<typeof documentTypeSchema>
export type ProcessingStatus = z.infer<typeof processingStatusSchema>
export type ExtractedData = z.infer<typeof extractedDataSchema>
export type Document = z.infer<typeof documentSchema>
export type CreateDocumentInput = z.infer<typeof createDocumentSchema>
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>
