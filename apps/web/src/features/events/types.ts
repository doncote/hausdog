import { z } from 'zod'

export const EventType = {
  INSTALLATION: 'installation',
  MAINTENANCE: 'maintenance',
  REPAIR: 'repair',
  INSPECTION: 'inspection',
  REPLACEMENT: 'replacement',
  OBSERVATION: 'observation',
} as const

export type EventTypeValue = (typeof EventType)[keyof typeof EventType]

export const CreateEventSchema = z.object({
  itemId: z.string().uuid(),
  type: z.string().min(1, 'Type is required'),
  date: z.date(),
  description: z.string().optional(),
  cost: z.number().positive().optional(),
  performedBy: z.string().optional(),
})

export const UpdateEventSchema = CreateEventSchema.partial().omit({ itemId: true })

export type CreateEventInput = z.infer<typeof CreateEventSchema>
export type UpdateEventInput = z.infer<typeof UpdateEventSchema>

export interface Event {
  id: string
  itemId: string
  type: string
  date: Date
  description: string | null
  cost: number | null
  performedBy: string | null
  createdAt: Date
  updatedAt: Date
}

export interface EventWithRelations extends Event {
  item?: { id: string; name: string }
  _count?: {
    documents: number
  }
}
