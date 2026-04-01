export type JsonValue =
  | string
  | number
  | boolean
  | null
  | { [key: string]: JsonValue }
  | JsonValue[]
export type JsonObject = { [key: string]: JsonValue }

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
  metadata: JsonObject | null
  createdAt: Date
}

export interface RecordActivityInput {
  propertyId: string
  userId: string
  action: ActivityAction
  entityType: ActivityEntityType
  entityId: string
  entityName?: string
  metadata?: JsonObject
}
