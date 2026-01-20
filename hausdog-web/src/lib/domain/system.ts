import { z } from 'zod'
import { categorySchema } from './category'

// Base schema - shared fields for input
const systemBase = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  manufacturer: z.string().max(255).optional(),
  model: z.string().max(255).optional(),
  serialNumber: z.string().max(255).optional(),
  installDate: z.date().optional(),
  warrantyExpires: z.date().optional(),
  notes: z.string().optional(),
})

// Input schemas
export const createSystemSchema = systemBase.extend({
  propertyId: z.string().uuid(),
  categoryId: z.string().uuid(),
})

export const updateSystemSchema = systemBase.partial().extend({
  categoryId: z.string().uuid().optional(),
})

// Full domain type (what services return)
export const systemSchema = systemBase.extend({
  id: z.string().uuid(),
  propertyId: z.string().uuid(),
  categoryId: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

// With relations
export const systemWithCategorySchema = systemSchema.extend({
  category: categorySchema.optional(),
})

export const systemWithComponentsSchema = systemSchema.extend({
  category: categorySchema.optional(),
  _count: z
    .object({
      components: z.number(),
      documents: z.number(),
    })
    .optional(),
})

// Derived types
export type System = z.infer<typeof systemSchema>
export type SystemWithCategory = z.infer<typeof systemWithCategorySchema>
export type SystemWithComponents = z.infer<typeof systemWithComponentsSchema>
export type CreateSystemInput = z.infer<typeof createSystemSchema>
export type UpdateSystemInput = z.infer<typeof updateSystemSchema>
