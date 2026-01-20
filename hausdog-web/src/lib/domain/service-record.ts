import { z } from 'zod'

// Base schema for input
const serviceRecordBase = z.object({
  serviceDate: z.date(),
  serviceType: z.string().min(1, 'Service type is required').max(255),
  provider: z.string().max(255).optional(),
  cost: z.number().positive().optional(),
  notes: z.string().optional(),
})

// Input schemas
export const createServiceRecordSchema = serviceRecordBase.extend({
  systemId: z.string().uuid().optional(),
  componentId: z.string().uuid().optional(),
  documentId: z.string().uuid().optional(),
})

export const updateServiceRecordSchema = serviceRecordBase.partial()

// Full domain type
export const serviceRecordSchema = serviceRecordBase.extend({
  id: z.string().uuid(),
  systemId: z.string().uuid().nullable(),
  componentId: z.string().uuid().nullable(),
  documentId: z.string().uuid().nullable(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

// Derived types
export type ServiceRecord = z.infer<typeof serviceRecordSchema>
export type CreateServiceRecordInput = z.infer<typeof createServiceRecordSchema>
export type UpdateServiceRecordInput = z.infer<typeof updateServiceRecordSchema>
