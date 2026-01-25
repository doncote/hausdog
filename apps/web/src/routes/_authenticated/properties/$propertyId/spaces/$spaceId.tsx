import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { Box, ChevronRight, DoorOpen, MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import {
  UpdateSpaceSchema,
  useSpace,
  useUpdateSpace,
  useDeleteSpace,
} from '@/features/spaces'
import { useProperty } from '@/features/properties'
import { useItemsForProperty, type ItemWithRelations } from '@/features/items'

export const Route = createFileRoute('/_authenticated/properties/$propertyId/spaces/$spaceId')({
  component: SpaceDetailPage,
})

function SpaceDetailPage() {
  const { propertyId, spaceId } = Route.useParams()
  const { user } = Route.useRouteContext()
  const navigate = useNavigate()

  const { data: property } = useProperty(propertyId, user?.id)
  const { data: space, isPending, error } = useSpace(spaceId)
  const { data: allItems } = useItemsForProperty(propertyId)

  // Filter items that belong to this space
  const itemsInSpace = allItems?.filter(item => item.spaceId === spaceId) || []

  const updateSpace = useUpdateSpace()
  const deleteSpace = useDeleteSpace()

  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [name, setName] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (space) {
      setName(space.name)
    }
  }, [space])

  const handleSave = async () => {
    setErrors({})

    const result = UpdateSpaceSchema.safeParse({ name })

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
      await updateSpace.mutateAsync({
        id: spaceId,
        userId: user.id,
        propertyId,
        input: result.data,
      })
      toast.success('Space updated')
      setIsEditing(false)
    } catch {
      toast.error('Failed to update space')
    }
  }

  const handleDelete = async () => {
    try {
      await deleteSpace.mutateAsync({
        id: spaceId,
        propertyId,
      })
      toast.success('Space deleted')
      navigate({ to: '/properties/$propertyId/spaces', params: { propertyId } })
    } catch {
      toast.error('Failed to delete space')
    }
  }

  const handleCancel = () => {
    if (space) {
      setName(space.name)
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
        </div>
      </div>
    )
  }

  if (error || !space) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="rounded-xl border border-destructive/50 bg-destructive/5 p-8 text-center">
          <p className="text-destructive font-medium mb-4">Space not found</p>
          <Link to="/properties/$propertyId/spaces" params={{ propertyId }}>
            <Button variant="outline" className="gap-2">
              Back to Spaces
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
          params={{ propertyId }}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          {property?.name || 'Property'}
        </Link>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <Link
          to="/properties/$propertyId/spaces"
          params={{ propertyId }}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          Spaces
        </Link>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{space.name}</span>
      </nav>

      <div className="rounded-xl border bg-card p-6 mb-8">
        {isEditing ? (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold">Edit Space</h2>
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
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={updateSpace.isPending}>
                {updateSpace.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="rounded-lg bg-primary/10 p-3">
                <DoorOpen className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{space.name}</h1>
                <p className="text-muted-foreground mt-1">
                  {itemsInSpace.length} item{itemsInSpace.length !== 1 ? 's' : ''} in this space
                </p>
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

      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold">Items in this Space</h2>
            <p className="text-sm text-muted-foreground">
              Items located in {space.name}
            </p>
          </div>
          <Link to="/items/new" search={{ propertyId, parentId: undefined, spaceId }}>
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Item
            </Button>
          </Link>
        </div>

        {itemsInSpace.length > 0 ? (
          <div className="space-y-3">
            {itemsInSpace.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border-2 border-dashed bg-muted/30 p-12 text-center">
            <div className="mx-auto w-fit rounded-full bg-primary/10 p-4 mb-4">
              <Box className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No items in this space</h3>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
              Add items to this space to keep track of everything
            </p>
            <Link to="/items/new" search={{ propertyId, parentId: undefined, spaceId }}>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Item to {space.name}
              </Button>
            </Link>
          </div>
        )}
      </div>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Space</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{space.name}"? Items in this space will not
              be deleted but will no longer be assigned to a space.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteSpace.isPending}
            >
              {deleteSpace.isPending ? 'Deleting...' : 'Delete'}
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
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </div>
      </div>
    </Link>
  )
}
