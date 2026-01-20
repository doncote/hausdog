import { z } from 'zod'

// Base schema - shared fields for input
const propertyBase = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  address: z.string().max(500).optional(),
})

// Input schemas
export const createPropertySchema = propertyBase
export const updatePropertySchema = propertyBase.partial()

// Full domain type (what services return)
export const propertySchema = propertyBase.extend({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

// With relations
export const propertyWithSystemsSchema = propertySchema.extend({
  systems: z.array(z.lazy(() => import('./system').then((m) => m.systemSchema))).optional(),
  _count: z
    .object({
      systems: z.number(),
    })
    .optional(),
})

// Derived types
export type Property = z.infer<typeof propertySchema>
export type PropertyWithSystems = z.infer<typeof propertyWithSystemsSchema>
export type CreatePropertyInput = z.infer<typeof createPropertySchema>
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>
