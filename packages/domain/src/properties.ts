import { z } from 'zod'

// Main schema
export const propertySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string().min(1, 'Name is required').max(255),
  address: z.string().max(500).nullable(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
})
export type Property = z.infer<typeof propertySchema>

// With counts (for list views)
export const propertyWithCountsSchema = propertySchema.extend({
  _count: z.object({
    systems: z.number(),
  }),
})
export type PropertyWithCounts = z.infer<typeof propertyWithCountsSchema>

// API schema (ISO datetime strings for OpenAPI compatibility)
export const propertyApiSchema = propertySchema
  .omit({ createdAt: true, updatedAt: true })
  .extend({
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
export type PropertyApi = z.infer<typeof propertyApiSchema>

// Converter: Domain -> API
export const toPropertyApi = (property: Property): PropertyApi => ({
  ...property,
  createdAt: property.createdAt.toISOString(),
  updatedAt: property.updatedAt.toISOString(),
})

// Converter: API -> Domain
export const fromPropertyApi = (api: PropertyApi): Property => ({
  ...api,
  createdAt: new Date(api.createdAt),
  updatedAt: new Date(api.updatedAt),
})

// Create schema
export const createPropertySchema = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  address: z.string().max(500).nullish(),
})
export type CreatePropertyInput = z.infer<typeof createPropertySchema>

// Update schema
export const updatePropertySchema = z.object({
  name: z.string().min(1).max(255).optional(),
  address: z.string().max(500).nullish(),
})
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>
