import { z } from 'zod'

// Main schema
export const componentSchema = z.object({
  id: z.string().uuid(),
  systemId: z.string().uuid(),
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
export type Component = z.infer<typeof componentSchema>

// API schema (ISO datetime strings for OpenAPI compatibility)
export const componentApiSchema = componentSchema
  .omit({ installDate: true, warrantyExpires: true, createdAt: true, updatedAt: true })
  .extend({
    installDate: z.string().datetime().nullable(),
    warrantyExpires: z.string().datetime().nullable(),
    createdAt: z.string().datetime(),
    updatedAt: z.string().datetime(),
  })
export type ComponentApi = z.infer<typeof componentApiSchema>

// Converter: Domain -> API
export const toComponentApi = (component: Component): ComponentApi => ({
  ...component,
  installDate: component.installDate?.toISOString() ?? null,
  warrantyExpires: component.warrantyExpires?.toISOString() ?? null,
  createdAt: component.createdAt.toISOString(),
  updatedAt: component.updatedAt.toISOString(),
})

// Converter: API -> Domain
export const fromComponentApi = (api: ComponentApi): Component => ({
  ...api,
  installDate: api.installDate ? new Date(api.installDate) : null,
  warrantyExpires: api.warrantyExpires ? new Date(api.warrantyExpires) : null,
  createdAt: new Date(api.createdAt),
  updatedAt: new Date(api.updatedAt),
})

// Create schema
export const createComponentSchema = z.object({
  systemId: z.string().uuid(),
  name: z.string().min(1, 'Name is required').max(255),
  manufacturer: z.string().max(255).nullish(),
  model: z.string().max(255).nullish(),
  serialNumber: z.string().max(255).nullish(),
  installDate: z.coerce.date().nullish(),
  warrantyExpires: z.coerce.date().nullish(),
  notes: z.string().nullish(),
})
export type CreateComponentInput = z.infer<typeof createComponentSchema>

// Update schema
export const updateComponentSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  manufacturer: z.string().max(255).nullish(),
  model: z.string().max(255).nullish(),
  serialNumber: z.string().max(255).nullish(),
  installDate: z.coerce.date().nullish(),
  warrantyExpires: z.coerce.date().nullish(),
  notes: z.string().nullish(),
})
export type UpdateComponentInput = z.infer<typeof updateComponentSchema>
