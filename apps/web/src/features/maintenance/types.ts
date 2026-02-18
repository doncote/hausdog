import { z } from 'zod'

export const MaintenanceTaskSource = {
  AI_SUGGESTED: 'ai_suggested',
  USER_CREATED: 'user_created',
} as const

export type MaintenanceTaskSourceValue =
  (typeof MaintenanceTaskSource)[keyof typeof MaintenanceTaskSource]

export const MaintenanceTaskStatus = {
  ACTIVE: 'active',
  PAUSED: 'paused',
  DISMISSED: 'dismissed',
} as const

export type MaintenanceTaskStatusValue =
  (typeof MaintenanceTaskStatus)[keyof typeof MaintenanceTaskStatus]

export const CreateMaintenanceTaskSchema = z.object({
  propertyId: z.string().uuid(),
  itemId: z.string().uuid().optional(),
  name: z.string().min(1, 'Name is required').max(255),
  description: z.string().optional(),
  intervalMonths: z.number().int().min(1).max(120),
  nextDueDate: z.date(),
})

export const UpdateMaintenanceTaskSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
  intervalMonths: z.number().int().min(1).max(120).optional(),
  nextDueDate: z.date().optional(),
  status: z.string().optional(),
})

export const CompleteMaintenanceTaskSchema = z.object({
  date: z.date(),
  cost: z.number().positive().optional(),
  performedBy: z.string().optional(),
  description: z.string().optional(),
})

export type CreateMaintenanceTaskInput = z.infer<typeof CreateMaintenanceTaskSchema>
export type UpdateMaintenanceTaskInput = z.infer<typeof UpdateMaintenanceTaskSchema>
export type CompleteMaintenanceTaskInput = z.infer<typeof CompleteMaintenanceTaskSchema>

export interface MaintenanceTask {
  id: string
  propertyId: string
  itemId: string | null
  name: string
  description: string | null
  intervalMonths: number
  nextDueDate: Date
  lastCompletedAt: Date | null
  source: string
  status: string
  createdAt: Date
  updatedAt: Date
}

export interface MaintenanceTaskWithRelations extends MaintenanceTask {
  property?: { id: string; name: string }
  item?: { id: string; name: string }
}
