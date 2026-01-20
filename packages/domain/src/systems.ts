import { z } from 'zod'
import { categorySchema, type Category } from './categories'

// Main schema
export const systemSchema = z.object({
  id: z.string().uuid(),
  propertyId: z.string().uuid(),
  categoryId: z.string().uuid(),
  name: z.string().min(1, 'Name is required').max(255),
  manufacturer: z.string().max(255).nullable(),
  model: z.string().max(255).nullable(),
  serialNumber: z.string().max(255).nullable(),
  installDate: z.coerce.date().nullable(),
  warrantyExpires: z.coerce.date().nullable(),
  notes: z.string().nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})
export type System = z.infer<typeof systemSchema>

// With category relation
export const systemWithCategorySchema = systemSchema.extend({
  category: categorySchema.nullable(),
})
export type SystemWithCategory = z.infer<typeof systemWithCategorySchema>

// With counts (for list views)
export const systemWithCountsSchema = systemSchema.extend({
  category: categorySchema.nullable(),
  _count: z.object({
    components: z.number(),
    documents: z.number(),
  }),
})
export type SystemWithCounts = z.infer<typeof systemWithCountsSchema>

// API schema (ISO datetime strings for OpenAPI compatibility)
export const systemApiSchema = systemSchema
  .omit({ installDate: true, warrantyExpires: true, createdAt: true, updatedAt: true })
  .extend({
    installDate: z.string().datetime().nullable(),
    warrantyExpires: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
export type SystemApi = z.infer<typeof systemApiSchema>

// Converter: Domain -> API
export const toSystemApi = (system: System): SystemApi => ({
  ...system,
  installDate: system.installDate?.toISOString() ?? null,
  warrantyExpires: system.warrantyExpires?.toISOString() ?? null,
  createdAt: system.createdAt.toISOString(),
  updatedAt: system.updatedAt.toISOString(),
})

// Converter: API -> Domain
export const fromSystemApi = (api: SystemApi): System => ({
  ...api,
  installDate: api.installDate ? new Date(api.installDate) : null,
  warrantyExpires: api.warrantyExpires ? new Date(api.warrantyExpires) : null,
  createdAt: new Date(api.createdAt),
  updatedAt: new Date(api.updatedAt),
})

// Create schema
export const createSystemSchema = z.object({
  propertyId: z.string().uuid(),
  categoryId: z.string().uuid(),
  name: z.string().min(1, 'Name is required').max(255),
  manufacturer: z.string().max(255).nullish(),
  model: z.string().max(255).nullish(),
  serialNumber: z.string().max(255).nullish(),
  installDate: z.coerce.date().nullish(),
  warrantyExpires: z.coerce.date().nullish(),
  notes: z.string().nullish(),
})
export type CreateSystemInput = z.infer<typeof createSystemSchema>

// Update schema
export const updateSystemSchema = z.object({
  categoryId: z.string().uuid().optional(),
  name: z.string().min(1).max(255).optional(),
  manufacturer: z.string().max(255).nullish(),
  model: z.string().max(255).nullish(),
  serialNumber: z.string().max(255).nullish(),
  installDate: z.coerce.date().nullish(),
  warrantyExpires: z.coerce.date().nullish(),
  notes: z.string().nullish(),
})
export type UpdateSystemInput = z.infer<typeof updateSystemSchema>
