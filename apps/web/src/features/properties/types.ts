import { z } from 'zod'

export const CreatePropertySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  address: z.string().optional(),
  yearBuilt: z.number().int().min(1800).max(2100).optional(),
  squareFeet: z.number().int().positive().optional(),
  propertyType: z.string().optional(),
  purchaseDate: z.date().optional(),
})

export const UpdatePropertySchema = CreatePropertySchema.partial()

export type CreatePropertyInput = z.infer<typeof CreatePropertySchema>
export type UpdatePropertyInput = z.infer<typeof UpdatePropertySchema>

export interface Property {
  id: string
  userId: string
  name: string
  address: string | null
  yearBuilt: number | null
  squareFeet: number | null
  propertyType: string | null
  purchaseDate: Date | null
  createdAt: Date
  updatedAt: Date
}

export interface PropertyWithCounts extends Property {
  _count: {
    items: number
    spaces: number
  }
}
