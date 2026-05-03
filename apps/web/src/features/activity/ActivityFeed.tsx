import { Box, CheckSquare, ChevronRight, DoorOpen, FileText, Users } from 'lucide-react'
import { useActivityFeed } from './queries'
import type { ActivityAction, ActivityEntityType, ActivityEvent } from './types'

interface ActivityFeedProps {
  propertyId: string
  currentUserId: string
}

function getEntityIcon(entityType: ActivityEntityType) {
  switch (entityType) {
    case 'item':
      return Box
    case 'space':
      return DoorOpen
    case 'document':
      return FileText
    case 'maintenance_task':
      return CheckSquare
    case 'member':
      return Users
    default:
      return ChevronRight
  }
}

function getActionLabel(action: ActivityAction, entityType: ActivityEntityType): string {
  switch (action) {
    case 'created':
      return entityType === 'space' ? 'added space' : 'added'
    case 'updated':
      return 'updated'
    case 'deleted':
      return 'removed'
    case 'invited':
      return 'invited'
    case 'accepted':
      return 'accepted invite to'
    case 'declined':
      return 'declined invite to'
    case 'removed':
      return 'removed collaborator'
    case 'completed':
      return 'completed'
    default:
      return action
  }
}

function formatRelativeTime(date: Date): string {
  const now = new Date()
  const diffMs = now.getTime() - new Date(date).getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMins / 60)
  const diffDays = Math.floor(diffHours / 24)

  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return new Date(date).toLocaleDateString()
}

function ActivityRow({ event, currentUserId }: { event: ActivityEvent; currentUserId: string }) {
  const Icon = getEntityIcon(event.entityType)
  const actor = event.userId === currentUserId ? 'You' : 'A collaborator'
  const actionLabel = getActionLabel(event.action, event.entityType)
  const showEntity = event.action !== 'removed' && event.entityName

  return (
    <div className="flex items-start gap-3 py-3">
      <div className="rounded-lg bg-muted p-1.5 mt-0.5 shrink-0">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm">
          <span className="font-medium">{actor}</span>{' '}
          <span className="text-muted-foreground">{actionLabel}</span>
          {showEntity && (
            <>
              {' '}
              <span className="font-medium truncate">{event.entityName}</span>
            </>
          )}
          {event.action === 'invited' && event.entityName && (
            <>
              {' '}
              <span className="text-muted-foreground">as a collaborator</span>
            </>
          )}
        </p>
      </div>
      <span className="text-xs text-muted-foreground shrink-0 mt-0.5">
        {formatRelativeTime(event.createdAt)}
      </span>
    </div>
  )
}

export function ActivityFeed({ propertyId, currentUserId }: ActivityFeedProps) {
  const { data: events, isPending } = useActivityFeed(propertyId, 20)

  return (
    <div className="rounded-xl border bg-card p-6 mb-8">
      <div className="flex items-center gap-3 mb-4">
        <div className="rounded-lg bg-primary/10 p-2">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Activity</h2>
          <p className="text-sm text-muted-foreground">Recent changes to this property</p>
        </div>
      </div>

      {isPending ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-start gap-3 py-3">
              <div className="h-7 w-7 rounded-lg bg-muted animate-pulse shrink-0" />
              <div className="flex-1 space-y-1">
                <div className="h-4 w-3/4 bg-muted animate-pulse rounded" />
              </div>
              <div className="h-3 w-12 bg-muted animate-pulse rounded" />
            </div>
          ))}
        </div>
      ) : !events || events.length === 0 ? (
        <div className="py-6 text-center">
          <p className="text-sm text-muted-foreground">No activity yet</p>
        </div>
      ) : (
        <div className="divide-y">
          {events.map((event) => (
            <ActivityRow key={event.id} event={event} currentUserId={currentUserId} />
          ))}
        </div>
      )}
    </div>
  )
}
