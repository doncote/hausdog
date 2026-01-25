import { createFileRoute, Link, useNavigate, useRouteContext, Outlet, useMatch } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { ArrowLeft, ChevronRight, Layers, MapPin, MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { CategoryIcon } from '@/components/category-icon'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Skeleton } from '@/components/ui/skeleton'
import { Textarea } from '@/components/ui/textarea'
import { requireAuthFromContext } from '@/lib/auth'
import { updatePropertySchema } from '@hausdog/domain/properties'
import { useDeleteProperty, useProperty, useUpdateProperty } from '@/features/properties'
import { useSystemsForProperty, useCreateSystem, type SystemWithCounts } from '@/features/systems'
import { useCategories } from '@/features/categories'
import { createSystemSchema } from '@hausdog/domain/systems'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

export const Route = createFileRoute('/properties/$propertyId')({
  beforeLoad: ({ context }) => {
    requireAuthFromContext(context)
  },
  component: PropertyDetailPage,
})

function PropertyDetailPage() {
  const { propertyId } = Route.useParams()
  const { user } = useRouteContext({ from: '/properties/$propertyId' })
  const navigate = useNavigate()

  // Check if we're on a child route (system or component detail)
  const systemMatch = useMatch({ from: '/properties/$propertyId/systems/$systemId', shouldThrow: false })
  const componentMatch = useMatch({ from: '/properties/$propertyId/systems/$systemId/components/$componentId', shouldThrow: false })

  // All hooks must be called before any conditional returns
  const { data: property, isPending, error } = useProperty(propertyId, user?.id)
  const { data: systems, isPending: systemsPending } = useSystemsForProperty(propertyId, user?.id)
  const { data: categories } = useCategories()
  const updateProperty = useUpdateProperty()
  const deleteProperty = useDeleteProperty()
  const createSystem = useCreateSystem()

  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showCreateSystemDialog, setShowCreateSystemDialog] = useState(false)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Sync form state with property data
  useEffect(() => {
    if (property) {
      setName(property.name)
      setAddress(property.address ?? '')
    }
  }, [property])

  // Now safe to do conditional return after all hooks
  if (systemMatch || componentMatch) {
    return <Outlet />
  }

  const handleSave = async () => {
    setErrors({})

    const result = updatePropertySchema.safeParse({
      name,
      address: address || undefined,
    })

    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message
        }
      })
      setErrors(fieldErrors)
      return
    }

    if (!user) return

    try {
      await updateProperty.mutateAsync({
        id: propertyId,
        userId: user.id,
        input: result.data,
      })
      toast.success('Property updated')
      setIsEditing(false)
    } catch {
      toast.error('Failed to update property')
    }
  }

  const handleDelete = async () => {
    if (!user) return

    try {
      await deleteProperty.mutateAsync({ id: propertyId, userId: user.id })
      toast.success('Property deleted')
      navigate({ to: '/properties' })
    } catch {
      toast.error('Failed to delete property')
    }
  }

  const handleCancel = () => {
    if (property) {
      setName(property.name)
      setAddress(property.address ?? '')
    }
    setErrors({})
    setIsEditing(false)
  }

  if (isPending) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="h-5 w-24 bg-muted animate-pulse rounded mb-8" />
          <div className="rounded-xl border bg-card p-6 mb-8">
            <div className="h-8 w-48 bg-muted animate-pulse rounded mb-3" />
            <div className="h-4 w-64 bg-muted animate-pulse rounded" />
          </div>
          <div className="space-y-3">
            <div className="h-20 w-full bg-muted animate-pulse rounded-xl" />
            <div className="h-20 w-full bg-muted animate-pulse rounded-xl" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !property) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="rounded-xl border border-destructive/50 bg-destructive/5 p-8 text-center">
            <p className="text-destructive font-medium mb-4">Property not found</p>
            <Link to="/properties">
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Properties
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm mb-8">
          <Link
            to="/properties"
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            Properties
          </Link>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{property.name}</span>
        </nav>

        {/* Property Header */}
        <div className="rounded-xl border bg-card p-6 mb-8">
          {isEditing ? (
            <div className="space-y-6">
              <h2 className="text-lg font-semibold">Edit Property</h2>
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

                <div className="space-y-2">
                  <Label htmlFor="address">Address</Label>
                  <Textarea
                    id="address"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    rows={3}
                  />
                  {errors.address && <p className="text-sm text-destructive">{errors.address}</p>}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={updateProperty.isPending}>
                  {updateProperty.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-start justify-between">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{property.name}</h1>
                {property.address && (
                  <p className="text-muted-foreground mt-1 flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />
                    {property.address}
                  </p>
                )}
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

        {/* Systems Section */}
        <div>
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold">Systems</h2>
              <p className="text-sm text-muted-foreground">
                Track HVAC, plumbing, appliances, and more
              </p>
            </div>
            <Button onClick={() => setShowCreateSystemDialog(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Add System
            </Button>
          </div>

          {systemsPending ? (
            <div className="space-y-3">
              <div className="h-20 w-full bg-muted animate-pulse rounded-xl" />
              <div className="h-20 w-full bg-muted animate-pulse rounded-xl" />
            </div>
          ) : systems && systems.length > 0 ? (
            <div className="space-y-3">
              {systems.map((system) => (
                <SystemCard key={system.id} system={system} propertyId={propertyId} />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border-2 border-dashed bg-muted/30 p-12 text-center">
              <div className="mx-auto w-fit rounded-full bg-primary/10 p-4 mb-4">
                <Layers className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No systems yet</h3>
              <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                Add systems like HVAC, plumbing, or appliances to track their details and maintenance
              </p>
              <Button onClick={() => setShowCreateSystemDialog(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Your First System
              </Button>
            </div>
          )}
        </div>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Property</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{property.name}"? This will also delete all
              associated systems and components. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteProperty.isPending}
            >
              {deleteProperty.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Create System Dialog */}
      <CreateSystemDialog
        open={showCreateSystemDialog}
        onOpenChange={setShowCreateSystemDialog}
        propertyId={propertyId}
        userId={user?.id}
        categories={categories ?? []}
        createSystem={createSystem}
      />
      </div>
    </div>
  )
}

function SystemCard({ system, propertyId }: { system: SystemWithCounts; propertyId: string }) {
  return (
    <Link
      to="/properties/$propertyId/systems/$systemId"
      params={{ propertyId, systemId: system.id }}
      className="group block"
    >
      <div className="rounded-xl border bg-card p-4 transition-all hover:shadow-md hover:border-primary/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-secondary p-2.5">
              <CategoryIcon icon={system.category?.icon ?? null} className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-medium group-hover:text-primary transition-colors">
                {system.name}
              </h3>
              <p className="text-sm text-muted-foreground">
                {system.category?.name}
                {system.manufacturer && ` · ${system.manufacturer}`}
                {system.model && ` ${system.model}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="hidden sm:inline">
              {system._count.components} component{system._count.components !== 1 && 's'}
            </span>
            <ChevronRight className="h-5 w-5" />
          </div>
        </div>
      </div>
    </Link>
  )
}

interface CreateSystemDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  propertyId: string
  userId: string | undefined
  categories: Array<{ id: string; name: string; icon: string | null }>
  createSystem: ReturnType<typeof useCreateSystem>
}

function CreateSystemDialog({
  open,
  onOpenChange,
  propertyId,
  userId,
  categories,
  createSystem,
}: CreateSystemDialogProps) {
  const [categoryId, setCategoryId] = useState('')
  const [systemName, setSystemName] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [model, setModel] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const resetForm = () => {
    setCategoryId('')
    setSystemName('')
    setManufacturer('')
    setModel('')
    setSerialNumber('')
    setNotes('')
    setErrors({})
  }

  const handleCreate = async () => {
    if (!userId) return
    setErrors({})

    const result = createSystemSchema.safeParse({
      propertyId,
      categoryId,
      name: systemName,
      manufacturer: manufacturer || undefined,
      model: model || undefined,
      serialNumber: serialNumber || undefined,
      notes: notes || undefined,
    })

    if (!result.success) {
      const fieldErrors: Record<string, string> = {}
      result.error.errors.forEach((err) => {
        if (err.path[0]) {
          fieldErrors[err.path[0] as string] = err.message
        }
      })
      setErrors(fieldErrors)
      return
    }

    try {
      await createSystem.mutateAsync({
        userId,
        input: result.data,
      })
      toast.success('System created')
      resetForm()
      onOpenChange(false)
    } catch {
      toast.error('Failed to create system')
    }
  }

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      resetForm()
    }
    onOpenChange(newOpen)
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add System</DialogTitle>
          <DialogDescription>
            Add a new system to track for this property.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="category">Category *</Label>
            <Select value={categoryId} onValueChange={setCategoryId}>
              <SelectTrigger aria-invalid={!!errors.categoryId}>
                <SelectValue placeholder="Select a category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    <span className="flex items-center gap-2">
                      <CategoryIcon icon={cat.icon} className="size-4" />
                      {cat.name}
                    </span>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.categoryId && (
              <p className="text-sm text-destructive">{errors.categoryId}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="systemName">Name *</Label>
            <Input
              id="systemName"
              value={systemName}
              onChange={(e) => setSystemName(e.target.value)}
              placeholder="e.g., Main HVAC Unit"
              aria-invalid={!!errors.name}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="manufacturer">Manufacturer</Label>
              <Input
                id="manufacturer"
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
                placeholder="e.g., Carrier"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                value={model}
                onChange={(e) => setModel(e.target.value)}
                placeholder="e.g., 24ACC636"
              />
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
              rows={2}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => handleOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleCreate} disabled={createSystem.isPending}>
            {createSystem.isPending ? 'Creating...' : 'Create System'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

