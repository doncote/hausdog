export type ActivityAction =
  | 'created'
  | 'updated'
  | 'deleted'
  | 'invited'
  | 'accepted'
  | 'declined'
  | 'removed'
  | 'completed'

export type ActivityEntityType = 'item' | 'space' | 'document' | 'maintenance_task' | 'member'

export interface ActivityEvent {
  id: string
  propertyId: string
  userId: string
  action: ActivityAction
  entityType: ActivityEntityType
  entityId: string
  entityName: string | null
  metadata: Record<string, unknown> | null
  createdAt: Date
}

export interface RecordActivityInput {
  propertyId: string
  userId: string
  action: ActivityAction
  entityType: ActivityEntityType
  entityId: string
  entityName?: string
  metadata?: Record<string, unknown>
}
