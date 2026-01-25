import { z } from 'zod'
import type { Prisma } from '@generated/prisma/client'

export const CreatePropertySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  address: z.string().optional(),
  yearBuilt: z.number().int().min(1800).max(2100).optional(),
  squareFeet: z.number().int().positive().optional(),
  lotSquareFeet: z.number().int().positive().optional(),
  bedrooms: z.number().int().min(0).optional(),
  bathrooms: z.number().min(0).optional(),
  stories: z.number().int().min(1).optional(),
  propertyType: z.string().optional(),
  purchaseDate: z.date().optional(),
  purchasePrice: z.number().positive().optional(),
  estimatedValue: z.number().positive().optional(),
  lookupData: z.unknown().optional(),
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
  lotSquareFeet: number | null
  bedrooms: number | null
  bathrooms: number | null
  stories: number | null
  propertyType: string | null
  purchaseDate: Date | null
  purchasePrice: number | null
  estimatedValue: number | null
  lookupData: Prisma.JsonValue | null
  createdAt: Date
  updatedAt: Date
}

export interface PropertyWithCounts extends Property {
  _count: {
    items: number
    spaces: number
  }
}
