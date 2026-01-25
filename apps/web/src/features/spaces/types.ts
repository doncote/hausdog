import { z } from 'zod'

export const CreateSpaceSchema = z.object({
  propertyId: z.string().uuid(),
  name: z.string().min(1, 'Name is required'),
})

export const UpdateSpaceSchema = z.object({
  name: z.string().min(1, 'Name is required').optional(),
})

export type CreateSpaceInput = z.infer<typeof CreateSpaceSchema>
export type UpdateSpaceInput = z.infer<typeof UpdateSpaceSchema>

export interface Space {
  id: string
  propertyId: string
  name: string
  createdAt: Date
  updatedAt: Date
}

export interface SpaceWithCounts extends Space {
  _count?: {
    items: number
  }
}
