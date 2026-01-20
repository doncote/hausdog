import { z } from 'zod'

// Main schema (categories are reference data, typically read-only)
export const categorySchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(100),
  icon: z.string().max(50).nullable(),
  sortOrder: z.number().int(),
})
export type Category = z.infer<typeof categorySchema>
