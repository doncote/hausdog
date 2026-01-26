import type { Prisma } from '@generated/prisma/client'
import { z } from 'zod'

export const CreatePropertySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  // Address fields
  streetAddress: z.string().nullish(),
  city: z.string().nullish(),
  state: z.string().nullish(),
  postalCode: z.string().nullish(),
  country: z.string().nullish(),
  county: z.string().nullish(),
  neighborhood: z.string().nullish(),
  latitude: z.number().nullish(),
  longitude: z.number().nullish(),
  timezone: z.string().nullish(),
  plusCode: z.string().nullish(),
  googlePlaceId: z.string().nullish(),
  formattedAddress: z.string().nullish(),
  googlePlaceData: z.record(z.string(), z.unknown()).nullish(),
  // Other fields
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
  // Address fields
  streetAddress: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  country: string | null
  county: string | null
  neighborhood: string | null
  latitude: number | null
  longitude: number | null
  timezone: string | null
  plusCode: string | null
  googlePlaceId: string | null
  formattedAddress: string | null
  googlePlaceData: Prisma.JsonValue | null
  // Other fields
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
  ingestToken: string | null
  createdAt: Date
  updatedAt: Date
}

export interface PropertyWithCounts extends Property {
  _count: {
    items: number
    spaces: number
  }
}
