import { z } from 'zod'

// Category names enum
export const categoryNames = [
  'HVAC',
  'Plumbing',
  'Electrical',
  'Appliances',
  'Roofing',
  'Exterior',
  'Interior',
  'Landscaping',
  'Security',
  'Other',
] as const

export const categoryNameSchema = z.enum(categoryNames)

// Full domain type
export const categorySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  icon: z.string().nullable(),
  sortOrder: z.number(),
})

// Derived types
export type CategoryName = z.infer<typeof categoryNameSchema>
export type Category = z.infer<typeof categorySchema>
