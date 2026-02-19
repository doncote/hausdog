import { createFileRoute } from '@tanstack/react-router'
import { AlertTriangle, Clock, MoreHorizontal, Plus, Wrench } from 'lucide-react'
import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import type {
  CompleteMaintenanceTaskInput,
  MaintenanceTaskWithRelations,
} from '@/features/maintenance'
import {
  useCompleteMaintenanceTask,
  useCreateMaintenanceTask,
  useDeleteMaintenanceTask,
  useSnoozeMaintenanceTask,
  useUpcomingMaintenance,
  useUpdateMaintenanceTask,
} from '@/features/maintenance'
import { useProperties } from '@/features/properties'

export const Route = createFileRoute('/_authenticated/maintenance')({
  component: MaintenancePage,
})

function MaintenancePage() {
  const { user } = Route.useRouteContext()
  const { data: tasks, isPending } = useUpcomingMaintenance(user?.id)
  const completeMutation = useCompleteMaintenanceTask()
  const snoozeMutation = useSnoozeMaintenanceTask()
  const updateMutation = useUpdateMaintenanceTask()
  const deleteMutation = useDeleteMaintenanceTask()
  const [completingTask, setCompletingTask] = useState<MaintenanceTaskWithRelations | null>(null)
  const [showCreateDialog, setShowCreateDialog] = useState(false)

  const now = new Date()
  const overdue = tasks?.filter((t) => new Date(t.nextDueDate) < now) ?? []
  const endOfWeek = new Date(now)
  endOfWeek.setDate(endOfWeek.getDate() + (7 - endOfWeek.getDay()))
  const thisWeek =
    tasks?.filter((t) => {
      const d = new Date(t.nextDueDate)
      return d >= now && d <= endOfWeek
    }) ?? []
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0)
  const thisMonth =
    tasks?.filter((t) => {
      const d = new Date(t.nextDueDate)
      return d > endOfWeek && d <= endOfMonth
    }) ?? []
  const future = tasks?.filter((t) => new Date(t.nextDueDate) > endOfMonth) ?? []

  return (
    <div className="mx-auto max-w-4xl px-6 py-10">
      <header className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Maintenance</h1>
          <p className="mt-1 text-muted-foreground">
            Recurring maintenance tasks across your properties
          </p>
        </div>
        <Button className="gap-2" onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4" />
          Add Task
        </Button>
      </header>

      {isPending ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
          ))}
        </div>
      ) : !tasks || tasks.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Wrench className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No maintenance tasks yet</h3>
            <p className="text-muted-foreground mb-4">
              Add maintenance schedules to your items or let AI suggest them
            </p>
            <Button onClick={() => setShowCreateDialog(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Create your first task
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {overdue.length > 0 && (
            <TaskGroup
              title="Overdue"
              icon={<AlertTriangle className="h-4 w-4 text-destructive" />}
              tasks={overdue}
              isOverdue
              onComplete={setCompletingTask}
              onSnooze={(t) =>
                snoozeMutation.mutate({
                  id: t.id,
                  userId: user!.id,
                  propertyId: t.propertyId,
                })
              }
              onPauseToggle={(t) =>
                updateMutation.mutate({
                  id: t.id,
                  userId: user!.id,
                  propertyId: t.propertyId,
                  input: {
                    status: t.status === 'paused' ? 'active' : 'paused',
                  },
                })
              }
              onDelete={(t) =>
                deleteMutation.mutate({
                  id: t.id,
                  propertyId: t.propertyId,
                })
              }
            />
          )}
          {thisWeek.length > 0 && (
            <TaskGroup
              title="This Week"
              icon={<Clock className="h-4 w-4" />}
              tasks={thisWeek}
              onComplete={setCompletingTask}
              onSnooze={(t) =>
                snoozeMutation.mutate({
                  id: t.id,
                  userId: user!.id,
                  propertyId: t.propertyId,
                })
              }
              onPauseToggle={(t) =>
                updateMutation.mutate({
                  id: t.id,
                  userId: user!.id,
                  propertyId: t.propertyId,
                  input: {
                    status: t.status === 'paused' ? 'active' : 'paused',
                  },
                })
              }
              onDelete={(t) =>
                deleteMutation.mutate({
                  id: t.id,
                  propertyId: t.propertyId,
                })
              }
            />
          )}
          {thisMonth.length > 0 && (
            <TaskGroup
              title="This Month"
              icon={<Clock className="h-4 w-4" />}
              tasks={thisMonth}
              onComplete={setCompletingTask}
              onSnooze={(t) =>
                snoozeMutation.mutate({
                  id: t.id,
                  userId: user!.id,
                  propertyId: t.propertyId,
                })
              }
              onPauseToggle={(t) =>
                updateMutation.mutate({
                  id: t.id,
                  userId: user!.id,
                  propertyId: t.propertyId,
                  input: {
                    status: t.status === 'paused' ? 'active' : 'paused',
                  },
                })
              }
              onDelete={(t) =>
                deleteMutation.mutate({
                  id: t.id,
                  propertyId: t.propertyId,
                })
              }
            />
          )}
          {future.length > 0 && (
            <TaskGroup
              title="Later"
              icon={<Clock className="h-4 w-4 text-muted-foreground" />}
              tasks={future}
              onComplete={setCompletingTask}
              onSnooze={(t) =>
                snoozeMutation.mutate({
                  id: t.id,
                  userId: user!.id,
                  propertyId: t.propertyId,
                })
              }
              onPauseToggle={(t) =>
                updateMutation.mutate({
                  id: t.id,
                  userId: user!.id,
                  propertyId: t.propertyId,
                  input: {
                    status: t.status === 'paused' ? 'active' : 'paused',
                  },
                })
              }
              onDelete={(t) =>
                deleteMutation.mutate({
                  id: t.id,
                  propertyId: t.propertyId,
                })
              }
            />
          )}
        </div>
      )}

      {/* Completion Dialog */}
      <Dialog open={!!completingTask} onOpenChange={(open) => !open && setCompletingTask(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete: {completingTask?.name}</DialogTitle>
          </DialogHeader>
          <CompleteMaintenanceForm
            onSubmit={(input) => {
              if (!completingTask) return
              completeMutation.mutate(
                {
                  id: completingTask.id,
                  userId: user!.id,
                  propertyId: completingTask.propertyId,
                  itemId: completingTask.itemId,
                  input,
                },
                { onSuccess: () => setCompletingTask(null) },
              )
            }}
            onSkip={() => {
              if (!completingTask) return
              completeMutation.mutate(
                {
                  id: completingTask.id,
                  userId: user!.id,
                  propertyId: completingTask.propertyId,
                  itemId: completingTask.itemId,
                  input: { date: new Date() },
                },
                { onSuccess: () => setCompletingTask(null) },
              )
            }}
            isPending={completeMutation.isPending}
          />
        </DialogContent>
      </Dialog>

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>New Maintenance Task</DialogTitle>
          </DialogHeader>
          <CreateMaintenanceForm userId={user!.id} onClose={() => setShowCreateDialog(false)} />
        </DialogContent>
      </Dialog>
    </div>
  )
}

// ---------------------------------------------------------------------------
// TaskGroup
// ---------------------------------------------------------------------------

function TaskGroup({
  title,
  icon,
  tasks,
  isOverdue,
  onComplete,
  onSnooze,
  onPauseToggle,
  onDelete,
}: {
  title: string
  icon: React.ReactNode
  tasks: MaintenanceTaskWithRelations[]
  isOverdue?: boolean
  onComplete: (task: MaintenanceTaskWithRelations) => void
  onSnooze: (task: MaintenanceTaskWithRelations) => void
  onPauseToggle: (task: MaintenanceTaskWithRelations) => void
  onDelete: (task: MaintenanceTaskWithRelations) => void
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          {title}
          <span className="ml-2 text-xs font-normal">({tasks.length})</span>
        </h2>
      </div>
      <div className="space-y-2">
        {tasks.map((task) => {
          const dueDate = new Date(task.nextDueDate)
          const now = new Date()
          const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))

          return (
            <div
              key={task.id}
              className={`flex items-center gap-3 p-3 rounded-lg border ${isOverdue ? 'border-destructive/30 bg-destructive/5' : ''}`}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium truncate">{task.name}</p>
                  {task.source === 'ai_suggested' && (
                    <span className="text-xs bg-secondary px-1.5 py-0.5 rounded shrink-0">AI</span>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">
                  {task.item?.name ?? task.property?.name ?? 'Property'} &middot; Every{' '}
                  {task.intervalMonths} mo &middot;{' '}
                  {isOverdue ? (
                    <span className="text-destructive font-medium">
                      {Math.abs(diffDays)}d overdue
                    </span>
                  ) : (
                    dueDate.toLocaleDateString()
                  )}
                </p>
              </div>
              <Button variant="outline" size="sm" onClick={() => onComplete(task)}>
                Complete
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => onSnooze(task)}>Snooze</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => onPauseToggle(task)}>
                    {task.status === 'paused' ? 'Resume' : 'Pause'}
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-destructive" onClick={() => onDelete(task)}>
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CompleteMaintenanceForm
// ---------------------------------------------------------------------------

function CompleteMaintenanceForm({
  onSubmit,
  onSkip,
  isPending,
}: {
  onSubmit: (input: CompleteMaintenanceTaskInput) => void
  onSkip: () => void
  isPending: boolean
}) {
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [cost, setCost] = useState('')
  const [performedBy, setPerformedBy] = useState('')
  const [description, setDescription] = useState('')

  return (
    <div className="space-y-4">
      <div>
        <Label>Date Performed</Label>
        <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <div>
        <Label>Cost</Label>
        <Input
          type="number"
          placeholder="Optional"
          value={cost}
          onChange={(e) => setCost(e.target.value)}
        />
      </div>
      <div>
        <Label>Performed By</Label>
        <Input
          placeholder="Optional (e.g., Self, ABC Plumbing)"
          value={performedBy}
          onChange={(e) => setPerformedBy(e.target.value)}
        />
      </div>
      <div>
        <Label>Notes</Label>
        <Textarea
          placeholder="Optional notes"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </div>
      <div className="flex justify-between">
        <Button variant="ghost" onClick={onSkip} disabled={isPending}>
          Skip details
        </Button>
        <Button
          onClick={() =>
            onSubmit({
              date: new Date(date),
              ...(cost ? { cost: parseFloat(cost) } : {}),
              ...(performedBy ? { performedBy } : {}),
              ...(description ? { description } : {}),
            })
          }
          disabled={isPending}
        >
          {isPending ? 'Saving...' : 'Complete'}
        </Button>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// CreateMaintenanceForm
// ---------------------------------------------------------------------------

function CreateMaintenanceForm({ userId, onClose }: { userId: string; onClose: () => void }) {
  const createMutation = useCreateMaintenanceTask()
  const { data: properties, isPending: propertiesLoading } = useProperties(userId)

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [intervalMonths, setIntervalMonths] = useState('12')
  const [nextDueDate, setNextDueDate] = useState(
    new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  )
  const [propertyId, setPropertyId] = useState('')

  // Auto-select first property when loaded
  const firstProperty = properties?.[0]
  if (firstProperty && !propertyId) {
    setPropertyId(firstProperty.id)
  }

  const handleSubmit = () => {
    if (!name || !propertyId) return
    createMutation.mutate(
      {
        userId,
        input: {
          propertyId,
          name,
          description: description || undefined,
          intervalMonths: parseInt(intervalMonths, 10),
          nextDueDate: new Date(nextDueDate),
        },
      },
      { onSuccess: () => onClose() },
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <Label>Property</Label>
        {propertiesLoading ? (
          <div className="h-10 bg-muted animate-pulse rounded" />
        ) : (
          <Select value={propertyId} onValueChange={setPropertyId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a property" />
            </SelectTrigger>
            <SelectContent>
              {properties?.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <div>
        <Label>Task Name</Label>
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Clean gutters"
        />
      </div>
      <div>
        <Label>Description</Label>
        <Textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Optional guidance"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <Label>Every N Months</Label>
          <Input
            type="number"
            min="1"
            max="120"
            value={intervalMonths}
            onChange={(e) => setIntervalMonths(e.target.value)}
          />
        </div>
        <div>
          <Label>Next Due Date</Label>
          <Input type="date" value={nextDueDate} onChange={(e) => setNextDueDate(e.target.value)} />
        </div>
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={onClose}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={!name || !propertyId || createMutation.isPending}>
          {createMutation.isPending ? 'Creating...' : 'Create Task'}
        </Button>
      </div>
    </div>
  )
}
