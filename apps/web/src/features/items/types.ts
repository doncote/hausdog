import { z } from 'zod'

export const ItemCategory = {
  APPLIANCE: 'appliance',
  HVAC: 'hvac',
  PLUMBING: 'plumbing',
  ELECTRICAL: 'electrical',
  STRUCTURE: 'structure',
  EXTERIOR: 'exterior',
  FURNITURE: 'furniture',
  ELECTRONICS: 'electronics',
  OTHER: 'other',
} as const

export type ItemCategoryType = (typeof ItemCategory)[keyof typeof ItemCategory]

export const CreateItemSchema = z.object({
  propertyId: z.string().uuid(),
  spaceId: z.string().uuid().optional(),
  parentId: z.string().uuid().optional(),
  name: z.string().min(1, 'Name is required'),
  category: z.string().min(1, 'Category is required'),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  acquiredDate: z.date().optional(),
  warrantyExpires: z.date().optional(),
  purchasePrice: z.number().positive().optional(),
  notes: z.string().optional(),
})

export const UpdateItemSchema = CreateItemSchema.partial().omit({ propertyId: true })

export type CreateItemInput = z.infer<typeof CreateItemSchema>
export type UpdateItemInput = z.infer<typeof UpdateItemSchema>

export interface Item {
  id: string
  propertyId: string
  spaceId: string | null
  parentId: string | null
  name: string
  category: string
  manufacturer: string | null
  model: string | null
  serialNumber: string | null
  acquiredDate: Date | null
  warrantyExpires: Date | null
  purchasePrice: number | null
  notes: string | null
  createdAt: Date
  updatedAt: Date
}

export interface ItemWithRelations extends Item {
  space?: { id: string; name: string } | null
  parent?: { id: string; name: string } | null
  children?: Item[]
  _count?: {
    events: number
    documents: number
    children: number
  }
}
