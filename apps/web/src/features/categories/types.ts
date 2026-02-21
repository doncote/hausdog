import { z } from 'zod'

export const CreateCategorySchema = z.object({
  slug: z
    .string()
    .min(1)
    .max(50)
    .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase alphanumeric with hyphens'),
  name: z.string().min(1, 'Name is required').max(100),
  icon: z.string().max(50).optional(),
})

export const UpdateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  icon: z.string().max(50).optional(),
})

export type CreateCategoryInput = z.infer<typeof CreateCategorySchema>
export type UpdateCategoryInput = z.infer<typeof UpdateCategorySchema>

export interface Category {
  id: string
  slug: string
  name: string
  icon: string | null
  isSystem: boolean
  userId: string | null
  createdAt: Date
  updatedAt: Date
}
