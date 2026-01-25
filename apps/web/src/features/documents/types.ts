import { z } from 'zod'

export const DocumentType = {
  PHOTO: 'photo',
  RECEIPT: 'receipt',
  MANUAL: 'manual',
  WARRANTY: 'warranty',
  INVOICE: 'invoice',
  OTHER: 'other',
} as const

export type DocumentTypeValue = (typeof DocumentType)[keyof typeof DocumentType]

export const DocumentStatus = {
  PENDING: 'pending',
  PROCESSING: 'processing',
  READY_FOR_REVIEW: 'ready_for_review',
  CONFIRMED: 'confirmed',
  DISCARDED: 'discarded',
} as const

export type DocumentStatusValue = (typeof DocumentStatus)[keyof typeof DocumentStatus]

export const CreateDocumentSchema = z.object({
  propertyId: z.string().uuid(),
  itemId: z.string().uuid().optional(),
  eventId: z.string().uuid().optional(),
  type: z.string().min(1, 'Type is required'),
  fileName: z.string().min(1, 'File name is required'),
  storagePath: z.string().min(1, 'Storage path is required'),
  contentType: z.string().min(1, 'Content type is required'),
  sizeBytes: z.number().int().positive(),
})

export const UpdateDocumentSchema = z.object({
  itemId: z.string().uuid().nullable().optional(),
  eventId: z.string().uuid().nullable().optional(),
  type: z.string().optional(),
  status: z.string().optional(),
  extractedText: z.string().nullable().optional(),
  extractedData: z.any().nullable().optional(),
  resolveData: z.any().nullable().optional(),
  documentDate: z.date().nullable().optional(),
})

export type CreateDocumentInput = z.infer<typeof CreateDocumentSchema>
export type UpdateDocumentInput = z.infer<typeof UpdateDocumentSchema>

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export type JsonValue = any

export interface Document {
  id: string
  propertyId: string
  itemId: string | null
  eventId: string | null
  type: string
  fileName: string
  storagePath: string
  contentType: string
  sizeBytes: number
  status: string
  extractedText: string | null
  extractedData: JsonValue | null
  resolveData: JsonValue | null
  documentDate: Date | null
  createdAt: Date
}

export interface DocumentWithRelations extends Document {
  property?: { id: string; name: string }
  item?: { id: string; name: string } | null
  event?: { id: string; type: string; date: Date } | null
}

export interface ExtractedDocumentData {
  documentType?: string
  title?: string
  date?: string
  vendor?: string
  amount?: number
  currency?: string
  items?: Array<{
    name?: string
    quantity?: number
    price?: number
  }>
  warranty?: {
    startDate?: string
    endDate?: string
    terms?: string
  }
  manufacturer?: string
  model?: string
  serialNumber?: string
  rawText?: string
  confidence?: number
}

export interface ResolveData {
  suggestedItem?: {
    id?: string
    name?: string
    isNew?: boolean
    category?: string
    manufacturer?: string
    model?: string
  }
  suggestedEvent?: {
    type?: string
    date?: string
    description?: string
    cost?: number
  }
  confidence?: number
  reasoning?: string
}
