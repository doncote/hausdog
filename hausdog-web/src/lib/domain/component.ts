import { z } from 'zod'

// Base schema - shared fields for input
const componentBase = z.object({
  name: z.string().min(1, 'Name is required').max(255),
  manufacturer: z.string().max(255).optional(),
  model: z.string().max(255).optional(),
  serialNumber: z.string().max(255).optional(),
  installDate: z.date().optional(),
  warrantyExpires: z.date().optional(),
  notes: z.string().optional(),
})

// Input schemas
export const createComponentSchema = componentBase.extend({
  systemId: z.string().uuid(),
})

export const updateComponentSchema = componentBase.partial()

// Full domain type (what services return)
export const componentSchema = componentBase.extend({
  id: z.string().uuid(),
  systemId: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

// Derived types
export type Component = z.infer<typeof componentSchema>
export type CreateComponentInput = z.infer<typeof createComponentSchema>
export type UpdateComponentInput = z.infer<typeof updateComponentSchema>
