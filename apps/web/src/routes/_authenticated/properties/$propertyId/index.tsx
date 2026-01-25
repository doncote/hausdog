import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { ArrowLeft, Box, ChevronRight, DoorOpen, MapPin, MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
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
import { Textarea } from '@/components/ui/textarea'
import { UpdatePropertySchema, useDeleteProperty, useProperty, useUpdateProperty } from '@/features/properties'
import { useRootItemsForProperty, type ItemWithRelations } from '@/features/items'
import { useSpacesForProperty } from '@/features/spaces'

export const Route = createFileRoute('/_authenticated/properties/$propertyId/')({
  component: PropertyDetailPage,
})

function PropertyDetailPage() {
  const { propertyId } = Route.useParams()
  const { user } = Route.useRouteContext()
  const navigate = useNavigate()

  const { data: property, isPending, error } = useProperty(propertyId, user?.id)
  const { data: items, isPending: itemsPending } = useRootItemsForProperty(propertyId)
  const { data: spaces, isPending: spacesPending } = useSpacesForProperty(propertyId)
  const updateProperty = useUpdateProperty()
  const deleteProperty = useDeleteProperty()

  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (property) {
      setName(property.name)
      setAddress(property.address ?? '')
    }
  }, [property])

  const handleSave = async () => {
    setErrors({})

    const result = UpdatePropertySchema.safeParse({
      name,
      address: address || undefined,
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
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="h-5 w-24 bg-muted animate-pulse rounded mb-8" />
        <div className="rounded-xl border bg-card p-6 mb-8">
          <div className="h-8 w-48 bg-muted animate-pulse rounded mb-3" />
          <div className="h-4 w-64 bg-muted animate-pulse rounded" />
        </div>
      </div>
    )
  }

  if (error || !property) {
    return (
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
        <span className="font-medium">{property.name}</span>
      </nav>

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

      {/* Spaces Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold">Spaces</h2>
            <p className="text-sm text-muted-foreground">
              Rooms and areas in your property
            </p>
          </div>
          <Link to="/properties/$propertyId/spaces" params={{ propertyId }}>
            <Button variant="outline" className="gap-2">
              <DoorOpen className="h-4 w-4" />
              Manage Spaces
            </Button>
          </Link>
        </div>

        {spacesPending ? (
          <div className="flex gap-3 overflow-x-auto pb-2">
            <div className="h-16 w-32 bg-muted animate-pulse rounded-xl shrink-0" />
            <div className="h-16 w-32 bg-muted animate-pulse rounded-xl shrink-0" />
          </div>
        ) : spaces && spaces.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {spaces.map((space) => (
              <Link
                key={space.id}
                to="/properties/$propertyId/spaces/$spaceId"
                params={{ propertyId, spaceId: space.id }}
                className="shrink-0"
              >
                <div className="rounded-xl border bg-card px-4 py-3 hover:shadow-md hover:border-primary/30 transition-all">
                  <div className="flex items-center gap-2">
                    <DoorOpen className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{space.name}</span>
                  </div>
                </div>
              </Link>
            ))}
            <Link
              to="/properties/$propertyId/spaces"
              params={{ propertyId }}
              className="shrink-0"
            >
              <div className="rounded-xl border-2 border-dashed px-4 py-3 hover:border-primary/50 transition-all flex items-center gap-2 text-muted-foreground hover:text-foreground">
                <Plus className="h-4 w-4" />
                <span>Add Space</span>
              </div>
            </Link>
          </div>
        ) : (
          <Link to="/properties/$propertyId/spaces" params={{ propertyId }}>
            <div className="rounded-xl border-2 border-dashed bg-muted/30 p-6 text-center hover:border-primary/50 transition-all cursor-pointer">
              <p className="text-muted-foreground">
                No spaces yet. <span className="text-primary hover:underline">Add spaces</span> to organize your items by room.
              </p>
            </div>
          </Link>
        )}
      </div>

      {/* Items Section */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold">Items</h2>
            <p className="text-sm text-muted-foreground">
              Track appliances, systems, and equipment
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/properties/$propertyId/items" params={{ propertyId }}>
              <Button variant="outline" className="gap-2">
                View All
              </Button>
            </Link>
            <Link to="/items/new" search={{ propertyId, parentId: undefined, spaceId: undefined }}>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Item
              </Button>
            </Link>
          </div>
        </div>

        {itemsPending ? (
          <div className="space-y-3">
            <div className="h-20 w-full bg-muted animate-pulse rounded-xl" />
            <div className="h-20 w-full bg-muted animate-pulse rounded-xl" />
          </div>
        ) : items && items.length > 0 ? (
          <div className="space-y-3">
            {items.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border-2 border-dashed bg-muted/30 p-12 text-center">
            <div className="mx-auto w-fit rounded-full bg-primary/10 p-4 mb-4">
              <Box className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No items yet</h3>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
              Add items like appliances, HVAC systems, or furniture to track their details
            </p>
            <Link to="/items/new" search={{ propertyId, parentId: undefined, spaceId: undefined }}>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Your First Item
              </Button>
            </Link>
          </div>
        )}
      </div>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Property</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{property.name}"? This will also delete all
              associated items and documents. This action cannot be undone.
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
    </div>
  )
}

function ItemCard({ item }: { item: ItemWithRelations }) {
  return (
    <Link
      to="/items/$itemId"
      params={{ itemId: item.id }}
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
                {item.name}
              </h3>
              <p className="text-sm text-muted-foreground">
                {item.category}
                {item.manufacturer && ` · ${item.manufacturer}`}
                {item.model && ` ${item.model}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {item._count && (
              <span className="hidden sm:inline">
                {item._count.children > 0 && `${item._count.children} sub-items`}
              </span>
            )}
            <ChevronRight className="h-5 w-5" />
          </div>
        </div>
      </div>
    </Link>
  )
}
