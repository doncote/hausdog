import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  Box,
  Calendar,
  ChevronRight,
  MoreHorizontal,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
  Wrench,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { ItemChat } from '@/components/ItemChat'
import { Button } from '@/components/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
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
import {
  CreateEventSchema,
  type Event,
  EventType,
  useCreateEvent,
  useDeleteEvent,
  useEventsForItem,
} from '@/features/events'
import {
  ItemCategory,
  UpdateItemSchema,
  useDeleteItem,
  useItem,
  useUpdateItem,
} from '@/features/items'
import {
  useMaintenanceForItem,
  useTriggerMaintenanceSuggestions,
  useCompleteMaintenanceTask,
  useUpdateMaintenanceTask,
  useDeleteMaintenanceTask,
  useSnoozeMaintenanceTask,
  CompleteMaintenanceTaskSchema,
} from '@/features/maintenance'
import type { MaintenanceTaskWithRelations, CompleteMaintenanceTaskInput } from '@/features/maintenance'
import { useSpacesForProperty } from '@/features/spaces'

export const Route = createFileRoute('/_authenticated/items/$itemId')({
  component: ItemDetailPage,
})

function ItemDetailPage() {
  const { itemId } = Route.useParams()
  const { user } = Route.useRouteContext()
  const navigate = useNavigate()

  const { data: item, isPending, error } = useItem(itemId)
  const { data: spaces } = useSpacesForProperty(item?.propertyId)
  const { data: events } = useEventsForItem(itemId)
  const { data: maintenanceTasks, isPending: maintenanceLoading } = useMaintenanceForItem(itemId)
  const triggerSuggestions = useTriggerMaintenanceSuggestions()
  const completeMaintenance = useCompleteMaintenanceTask()
  const updateMaintenance = useUpdateMaintenanceTask()
  const deleteMaintenance = useDeleteMaintenanceTask()
  const snoozeMaintenance = useSnoozeMaintenanceTask()
  const updateItem = useUpdateItem()
  const deleteItem = useDeleteItem()
  const createEvent = useCreateEvent()
  const deleteEvent = useDeleteEvent()

  const [completingTask, setCompletingTask] = useState<MaintenanceTaskWithRelations | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showEventDialog, setShowEventDialog] = useState(false)
  const [showDeleteEventDialog, setShowDeleteEventDialog] = useState(false)
  const [eventToDelete, setEventToDelete] = useState<Event | null>(null)
  const [eventType, setEventType] = useState('')
  const [eventDate, setEventDate] = useState('')
  const [eventDescription, setEventDescription] = useState('')
  const [eventCost, setEventCost] = useState('')
  const [eventPerformedBy, setEventPerformedBy] = useState('')
  const [eventErrors, setEventErrors] = useState<Record<string, string>>({})
  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [spaceId, setSpaceId] = useState('none')
  const [manufacturer, setManufacturer] = useState('')
  const [model, setModel] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (item) {
      setName(item.name)
      setCategory(item.category)
      setSpaceId(item.spaceId ?? 'none')
      setManufacturer(item.manufacturer ?? '')
      setModel(item.model ?? '')
      setSerialNumber(item.serialNumber ?? '')
      setNotes(item.notes ?? '')
    }
  }, [item])

  const handleSave = async () => {
    setErrors({})

    const result = UpdateItemSchema.safeParse({
      name,
      category,
      spaceId: spaceId === 'none' ? undefined : spaceId,
      manufacturer: manufacturer || undefined,
      model: model || undefined,
      serialNumber: serialNumber || undefined,
      notes: notes || undefined,
    })

    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      result.error.issues.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message
        }
      })
      setErrors(fieldErrors)
      return
    }

    if (!user || !item) return

    try {
      await updateItem.mutateAsync({
        id: itemId,
        userId: user.id,
        propertyId: item.propertyId,
        input: result.data,
      })
      toast.success('Item updated')
      setIsEditing(false)
    } catch {
      toast.error('Failed to update item')
    }
  }

  const handleDelete = async () => {
    if (!item) return

    try {
      await deleteItem.mutateAsync({ id: itemId, propertyId: item.propertyId })
      toast.success('Item deleted')
      navigate({ to: '/properties/$propertyId', params: { propertyId: item.propertyId } })
    } catch {
      toast.error('Failed to delete item')
    }
  }

  const handleCancel = () => {
    if (item) {
      setName(item.name)
      setCategory(item.category)
      setSpaceId(item.spaceId ?? 'none')
      setManufacturer(item.manufacturer ?? '')
      setModel(item.model ?? '')
      setSerialNumber(item.serialNumber ?? '')
      setNotes(item.notes ?? '')
    }
    setErrors({})
    setIsEditing(false)
  }

  const resetEventForm = () => {
    setEventType('')
    setEventDate('')
    setEventDescription('')
    setEventCost('')
    setEventPerformedBy('')
    setEventErrors({})
  }

  const handleCreateEvent = async () => {
    setEventErrors({})

    const result = CreateEventSchema.safeParse({
      itemId,
      type: eventType,
      date: eventDate ? new Date(eventDate) : undefined,
      description: eventDescription || undefined,
      cost: eventCost ? parseFloat(eventCost) : undefined,
      performedBy: eventPerformedBy || undefined,
    })

    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      result.error.issues.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message
        }
      })
      setEventErrors(fieldErrors)
      return
    }

    if (!user) return

    try {
      await createEvent.mutateAsync({
        userId: user.id,
        input: {
          itemId,
          type: eventType,
          date: new Date(eventDate),
          description: eventDescription || undefined,
          cost: eventCost ? parseFloat(eventCost) : undefined,
          performedBy: eventPerformedBy || undefined,
        },
      })
      toast.success('Event added')
      setShowEventDialog(false)
      resetEventForm()
    } catch {
      toast.error('Failed to add event')
    }
  }

  const handleDeleteEvent = async () => {
    if (!eventToDelete || !item) return

    try {
      await deleteEvent.mutateAsync({
        id: eventToDelete.id,
        itemId,
      })
      toast.success('Event deleted')
      setShowDeleteEventDialog(false)
      setEventToDelete(null)
    } catch {
      toast.error('Failed to delete event')
    }
  }

  const formatDate = (date: Date | string) => {
    return new Date(date).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount)
  }

  if (isPending) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="h-5 w-24 bg-muted animate-pulse rounded mb-8" />
        <div className="rounded-xl border bg-card p-6 mb-8">
          <div className="h-8 w-48 bg-muted animate-pulse rounded mb-3" />
          <div className="h-4 w-64 bg-muted animate-pulse rounded" />
        </div>
      </div>
    )
  }

  if (error || !item) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="rounded-xl border border-destructive/50 bg-destructive/5 p-8 text-center">
          <p className="text-destructive font-medium mb-4">Item not found</p>
          <Link to="/properties">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Properties
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <nav className="flex items-center gap-2 text-sm mb-8">
        <Link
          to="/properties"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          Properties
        </Link>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <Link
          to="/properties/$propertyId"
          params={{ propertyId: item.propertyId }}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          Property
        </Link>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{item.name}</span>
      </nav>

      <div className="rounded-xl border bg-card p-6 mb-8">
        {isEditing ? (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold">Edit Item</h2>
            <div className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input
                  id="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  aria-invalid={!!errors.name}
                />
                {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="category">Category *</Label>
                  <Select value={category} onValueChange={setCategory}>
                    <SelectTrigger id="category" aria-invalid={!!errors.category}>
                      <SelectValue placeholder="Select a category" />
                    </SelectTrigger>
                    <SelectContent>
                      {Object.entries(ItemCategory).map(([key, value]) => (
                        <SelectItem key={value} value={value}>
                          {key.charAt(0) + key.slice(1).toLowerCase()}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {errors.category && <p className="text-sm text-destructive">{errors.category}</p>}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="space">Space</Label>
                  <Select value={spaceId} onValueChange={setSpaceId}>
                    <SelectTrigger id="space">
                      <SelectValue placeholder="Select a space (optional)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">No space</SelectItem>
                      {spaces?.map((space) => (
                        <SelectItem key={space.id} value={space.id}>
                          {space.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="manufacturer">Manufacturer</Label>
                  <Input
                    id="manufacturer"
                    value={manufacturer}
                    onChange={(e) => setManufacturer(e.target.value)}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="model">Model</Label>
                  <Input id="model" value={model} onChange={(e) => setModel(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="serialNumber">Serial Number</Label>
                <Input
                  id="serialNumber"
                  value={serialNumber}
                  onChange={(e) => setSerialNumber(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea
                  id="notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={3}
                />
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={updateItem.isPending}>
                {updateItem.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-4">
              <div className="rounded-lg bg-secondary p-3">
                <Box className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{item.name}</h1>
                <p className="text-muted-foreground mt-1">
                  {item.category}
                  {item.manufacturer && ` · ${item.manufacturer}`}
                  {item.model && ` ${item.model}`}
                </p>
                {item.serialNumber && (
                  <p className="text-sm text-muted-foreground mt-2">Serial: {item.serialNumber}</p>
                )}
                {item.notes && (
                  <p className="text-sm text-muted-foreground mt-4 whitespace-pre-wrap">
                    {item.notes}
                  </p>
                )}
              </div>
            </div>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon">
                  <MoreVertical className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setIsEditing(true)} className="gap-2">
                  <Pencil className="h-4 w-4" />
                  Edit
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => setShowDeleteDialog(true)}
                  className="text-destructive focus:text-destructive gap-2"
                >
                  <Trash2 className="h-4 w-4" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>

      {/* Sub-items section */}
      {item.children && item.children.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold">Sub-Items</h2>
              <p className="text-sm text-muted-foreground">Components or parts of this item</p>
            </div>
            <Link
              to="/items/new"
              search={{ propertyId: item.propertyId, parentId: item.id, spaceId: undefined }}
            >
              <Button variant="outline" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Sub-Item
              </Button>
            </Link>
          </div>

          <div className="space-y-3">
            {item.children.map((child) => (
              <Link
                key={child.id}
                to="/items/$itemId"
                params={{ itemId: child.id }}
                className="group block"
              >
                <div className="rounded-xl border bg-card p-4 transition-all hover:shadow-md hover:border-primary/30">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="rounded-lg bg-secondary p-2.5">
                        <Box className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div>
                        <h3 className="font-medium group-hover:text-primary transition-colors">
                          {child.name}
                        </h3>
                        <p className="text-sm text-muted-foreground">{child.category}</p>
                      </div>
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground" />
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Empty sub-items state */}
      {(!item.children || item.children.length === 0) && (
        <div className="rounded-xl border-2 border-dashed bg-muted/30 p-8 text-center">
          <h3 className="text-lg font-semibold mb-2">No sub-items</h3>
          <p className="text-muted-foreground mb-4 max-w-sm mx-auto">
            Add sub-items to track components or parts
          </p>
          <Link
            to="/items/new"
            search={{ propertyId: item.propertyId, parentId: item.id, spaceId: undefined }}
          >
            <Button variant="outline" className="gap-2">
              <Plus className="h-4 w-4" />
              Add Sub-Item
            </Button>
          </Link>
        </div>
      )}

      {/* Events section */}
      <div className="mt-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold">Maintenance History</h2>
            <p className="text-sm text-muted-foreground">
              Track repairs, maintenance, and other events
            </p>
          </div>
          <Button onClick={() => setShowEventDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Event
          </Button>
        </div>

        {events && events.length > 0 ? (
          <div className="space-y-3">
            {events.map((event) => (
              <div
                key={event.id}
                className="rounded-xl border bg-card p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start gap-4">
                    <div className="rounded-lg bg-secondary p-2.5">
                      <Wrench className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium capitalize">{event.type}</h3>
                        <span className="text-sm text-muted-foreground flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(event.date)}
                        </span>
                      </div>
                      {event.description && (
                        <p className="text-sm text-muted-foreground mt-1">{event.description}</p>
                      )}
                      <div className="flex gap-4 mt-2 text-sm text-muted-foreground">
                        {event.cost && <span>{formatCurrency(Number(event.cost))}</span>}
                        {event.performedBy && <span>By: {event.performedBy}</span>}
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => {
                      setEventToDelete(event)
                      setShowDeleteEventDialog(true)
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl border-2 border-dashed bg-muted/30 p-8 text-center">
            <div className="mx-auto w-fit rounded-full bg-primary/10 p-4 mb-4">
              <Wrench className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No events yet</h3>
            <p className="text-muted-foreground mb-4 max-w-sm mx-auto">
              Track maintenance, repairs, and other events for this item
            </p>
            <Button onClick={() => setShowEventDialog(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Add First Event
            </Button>
          </div>
        )}
      </div>

      {/* Maintenance Schedule */}
      <div className="mt-8">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>Maintenance Schedule</CardTitle>
              <CardDescription>Recurring maintenance tasks for this item</CardDescription>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => triggerSuggestions.mutate({ itemId, userId: user.id })}
              disabled={triggerSuggestions.isPending}
            >
              {triggerSuggestions.isPending ? 'Generating...' : 'Suggest Maintenance'}
            </Button>
          </CardHeader>
          <CardContent>
            {maintenanceLoading ? (
              <div className="space-y-3">
                <div className="h-12 bg-muted animate-pulse rounded" />
              </div>
            ) : maintenanceTasks && maintenanceTasks.length > 0 ? (
              <div className="space-y-2">
                {maintenanceTasks.map((task) => {
                  const isOverdue = new Date(task.nextDueDate) < new Date()
                  const dueDate = new Date(task.nextDueDate)
                  const now = new Date()
                  const diffDays = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
                  const dueLabel = isOverdue
                    ? `${Math.abs(diffDays)}d overdue`
                    : diffDays === 0
                      ? 'Due today'
                      : `${diffDays}d`

                  return (
                    <div
                      key={task.id}
                      className="flex items-center gap-3 p-3 rounded-lg border"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium truncate">{task.name}</p>
                          {task.source === 'ai_suggested' && (
                            <span className="text-xs bg-secondary px-1.5 py-0.5 rounded">AI</span>
                          )}
                          {task.status === 'paused' && (
                            <span className="text-xs bg-muted px-1.5 py-0.5 rounded">Paused</span>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground">
                          Every {task.intervalMonths} month{task.intervalMonths !== 1 ? 's' : ''} &middot;{' '}
                          <span className={isOverdue ? 'text-destructive font-medium' : ''}>{dueLabel}</span>
                        </p>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => setCompletingTask(task)}
                        >
                          Complete
                        </Button>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="sm">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              onClick={() =>
                                snoozeMaintenance.mutate({
                                  id: task.id,
                                  userId: user.id,
                                  propertyId: task.propertyId,
                                })
                              }
                            >
                              Snooze
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              onClick={() =>
                                updateMaintenance.mutate({
                                  id: task.id,
                                  userId: user.id,
                                  propertyId: task.propertyId,
                                  input: { status: task.status === 'paused' ? 'active' : 'paused' },
                                })
                              }
                            >
                              {task.status === 'paused' ? 'Resume' : 'Pause'}
                            </DropdownMenuItem>
                            <DropdownMenuItem
                              className="text-destructive"
                              onClick={() =>
                                deleteMaintenance.mutate({
                                  id: task.id,
                                  propertyId: task.propertyId,
                                })
                              }
                            >
                              Delete
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="py-6 text-center">
                <p className="text-muted-foreground mb-3">No maintenance tasks yet</p>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => triggerSuggestions.mutate({ itemId, userId: user.id })}
                  disabled={triggerSuggestions.isPending}
                >
                  {triggerSuggestions.isPending ? 'Generating...' : 'Suggest Maintenance'}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Item Chat */}
      {user && (
        <div className="mt-8">
          <ItemChat
            itemId={itemId}
            itemName={item.name}
            propertyId={item.propertyId}
            userId={user.id}
          />
        </div>
      )}

      {/* Add Event Dialog */}
      <Dialog
        open={showEventDialog}
        onOpenChange={(open) => {
          setShowEventDialog(open)
          if (!open) resetEventForm()
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Event</DialogTitle>
            <DialogDescription>
              Record a maintenance, repair, or other event for this item.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="event-type">Type *</Label>
                <Select value={eventType} onValueChange={setEventType}>
                  <SelectTrigger id="event-type" aria-invalid={!!eventErrors.type}>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {Object.entries(EventType).map(([key, value]) => (
                      <SelectItem key={value} value={value}>
                        {key.charAt(0) + key.slice(1).toLowerCase()}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {eventErrors.type && <p className="text-sm text-destructive">{eventErrors.type}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-date">Date *</Label>
                <Input
                  id="event-date"
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  aria-invalid={!!eventErrors.date}
                />
                {eventErrors.date && <p className="text-sm text-destructive">{eventErrors.date}</p>}
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="event-description">Description</Label>
              <Textarea
                id="event-description"
                value={eventDescription}
                onChange={(e) => setEventDescription(e.target.value)}
                placeholder="What was done..."
                rows={3}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="event-cost">Cost</Label>
                <Input
                  id="event-cost"
                  type="number"
                  step="0.01"
                  min="0"
                  value={eventCost}
                  onChange={(e) => setEventCost(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="event-performed-by">Performed By</Label>
                <Input
                  id="event-performed-by"
                  value={eventPerformedBy}
                  onChange={(e) => setEventPerformedBy(e.target.value)}
                  placeholder="e.g., ABC Plumbing"
                />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowEventDialog(false)
                resetEventForm()
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateEvent} disabled={createEvent.isPending}>
              {createEvent.isPending ? 'Adding...' : 'Add Event'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Event Dialog */}
      <Dialog open={showDeleteEventDialog} onOpenChange={setShowDeleteEventDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Event</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this {eventToDelete?.type} event from{' '}
              {eventToDelete && formatDate(eventToDelete.date)}? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteEventDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteEvent}
              disabled={deleteEvent.isPending}
            >
              {deleteEvent.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Item</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{item.name}"? This will also delete all sub-items and
              associated documents. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteItem.isPending}>
              {deleteItem.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Complete Maintenance Dialog */}
      <Dialog open={!!completingTask} onOpenChange={(open) => !open && setCompletingTask(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Complete: {completingTask?.name}</DialogTitle>
          </DialogHeader>
          <CompleteMaintenanceForm
            task={completingTask}
            onSubmit={(input) => {
              if (!completingTask) return
              completeMaintenance.mutate(
                {
                  id: completingTask.id,
                  userId: user.id,
                  propertyId: completingTask.propertyId,
                  itemId: completingTask.itemId,
                  input,
                },
                {
                  onSuccess: () => setCompletingTask(null),
                },
              )
            }}
            onSkip={() => {
              if (!completingTask) return
              completeMaintenance.mutate(
                {
                  id: completingTask.id,
                  userId: user.id,
                  propertyId: completingTask.propertyId,
                  itemId: completingTask.itemId,
                  input: { date: new Date() },
                },
                {
                  onSuccess: () => setCompletingTask(null),
                },
              )
            }}
            isPending={completeMaintenance.isPending}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}

function CompleteMaintenanceForm({
  task,
  onSubmit,
  onSkip,
  isPending,
}: {
  task: MaintenanceTaskWithRelations | null
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
