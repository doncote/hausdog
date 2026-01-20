import { createFileRoute, Link, useNavigate, useRouteContext } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { CategoryIcon } from '@/components/category-icon'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
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
      <div className="mx-auto max-w-5xl px-6 py-8">
        <Skeleton className="h-8 w-48 mb-2" />
        <Skeleton className="h-4 w-64 mb-8" />
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-24 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !property) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-8">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">Property not found</p>
            <Link to="/properties" className="mt-4 inline-block">
              <Button variant="outline">Back to Properties</Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-5xl px-6 py-8">
      {/* Breadcrumb */}
      <div className="mb-6">
        <Link to="/properties" className="text-sm text-muted-foreground hover:text-foreground">
          Properties
        </Link>
        <span className="text-sm text-muted-foreground mx-2">/</span>
        <span className="text-sm">{property.name}</span>
      </div>

      {/* Property Details */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>{isEditing ? 'Edit Property' : property.name}</CardTitle>
              {!isEditing && property.address && (
                <CardDescription>{property.address}</CardDescription>
              )}
            </div>
            {!isEditing && (
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  Edit
                </Button>
                <Button variant="destructive" onClick={() => setShowDeleteDialog(true)}>
                  Delete
                </Button>
              </div>
            )}
          </div>
        </CardHeader>
        {isEditing && (
          <CardContent>
            <div className="space-y-6">
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

              <div className="flex gap-4">
                <Button variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={updateProperty.isPending}>
                  {updateProperty.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </CardContent>
        )}
      </Card>

      {/* Systems Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Systems</h2>
          <Button onClick={() => setShowCreateSystemDialog(true)}>Add System</Button>
        </div>

        {systemsPending ? (
          <div className="space-y-3">
            <Skeleton className="h-20 w-full" />
            <Skeleton className="h-20 w-full" />
          </div>
        ) : systems && systems.length > 0 ? (
          <div className="space-y-3">
            {systems.map((system) => (
              <SystemCard key={system.id} system={system} propertyId={propertyId} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <h3 className="text-lg font-medium mb-2">No systems yet</h3>
              <p className="text-muted-foreground mb-4">
                Add systems like HVAC, plumbing, or appliances to track
              </p>
              <Button variant="outline" onClick={() => setShowCreateSystemDialog(true)}>
                Add Your First System
              </Button>
            </CardContent>
          </Card>
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
  )
}

function SystemCard({ system, propertyId }: { system: SystemWithCounts; propertyId: string }) {
  return (
    <Link
      to="/properties/$propertyId/systems/$systemId"
      params={{ propertyId, systemId: system.id }}
      className="block"
    >
      <Card className="hover:bg-muted/50 transition-colors">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <CategoryIcon icon={system.category?.icon ?? null} className="size-6 text-muted-foreground" />
              <div>
                <h3 className="font-medium">{system.name}</h3>
                <p className="text-sm text-muted-foreground">
                  {system.category?.name}
                  {system.manufacturer && ` · ${system.manufacturer}`}
                  {system.model && ` ${system.model}`}
                </p>
              </div>
            </div>
            <div className="text-sm text-muted-foreground">
              {system._count.components} component{system._count.components !== 1 && 's'}
            </div>
          </div>
        </CardContent>
      </Card>
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

