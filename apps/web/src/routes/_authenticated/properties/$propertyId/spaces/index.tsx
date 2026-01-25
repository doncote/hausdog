import { createFileRoute, Link } from '@tanstack/react-router'
import { ChevronRight, DoorOpen, MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
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
import { useProperty } from '@/features/properties'
import {
  CreateSpaceSchema,
  type Space,
  UpdateSpaceSchema,
  useCreateSpace,
  useDeleteSpace,
  useSpacesForProperty,
  useUpdateSpace,
} from '@/features/spaces'

export const Route = createFileRoute('/_authenticated/properties/$propertyId/spaces/')({
  component: SpacesPage,
})

function SpacesPage() {
  const { propertyId } = Route.useParams()
  const { user } = Route.useRouteContext()

  const { data: property, isPending: propertyPending } = useProperty(propertyId, user?.id)
  const { data: spaces, isPending: spacesPending } = useSpacesForProperty(propertyId)

  const createSpace = useCreateSpace()
  const updateSpace = useUpdateSpace()
  const deleteSpace = useDeleteSpace()

  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedSpace, setSelectedSpace] = useState<Space | null>(null)
  const [name, setName] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const resetForm = () => {
    setName('')
    setErrors({})
    setSelectedSpace(null)
  }

  const handleCreate = async () => {
    setErrors({})

    const result = CreateSpaceSchema.safeParse({ propertyId, name })

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
      await createSpace.mutateAsync({
        userId: user.id,
        input: result.data,
      })
      toast.success('Space created')
      setShowCreateDialog(false)
      resetForm()
    } catch {
      toast.error('Failed to create space')
    }
  }

  const handleUpdate = async () => {
    if (!selectedSpace) return
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
        id: selectedSpace.id,
        userId: user.id,
        propertyId,
        input: result.data,
      })
      toast.success('Space updated')
      setShowEditDialog(false)
      resetForm()
    } catch {
      toast.error('Failed to update space')
    }
  }

  const handleDelete = async () => {
    if (!selectedSpace) return

    try {
      await deleteSpace.mutateAsync({
        id: selectedSpace.id,
        propertyId,
      })
      toast.success('Space deleted')
      setShowDeleteDialog(false)
      resetForm()
    } catch {
      toast.error('Failed to delete space')
    }
  }

  const openEditDialog = (space: Space) => {
    setSelectedSpace(space)
    setName(space.name)
    setShowEditDialog(true)
  }

  const openDeleteDialog = (space: Space) => {
    setSelectedSpace(space)
    setShowDeleteDialog(true)
  }

  const isPending = propertyPending || spacesPending

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
        <span className="font-medium">Spaces</span>
      </nav>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Spaces</h1>
          <p className="text-muted-foreground mt-1">Organize your property into rooms and areas</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
          <Plus className="h-4 w-4" />
          Add Space
        </Button>
      </div>

      {isPending ? (
        <div className="space-y-3">
          <div className="h-20 w-full bg-muted animate-pulse rounded-xl" />
          <div className="h-20 w-full bg-muted animate-pulse rounded-xl" />
        </div>
      ) : spaces && spaces.length > 0 ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {spaces.map((space) => (
            <div
              key={space.id}
              className="rounded-xl border bg-card p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <Link
                  to="/properties/$propertyId/spaces/$spaceId"
                  params={{ propertyId, spaceId: space.id }}
                  className="flex items-center gap-3 flex-1 group"
                >
                  <div className="rounded-lg bg-secondary p-2.5">
                    <DoorOpen className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div>
                    <h3 className="font-medium group-hover:text-primary transition-colors">
                      {space.name}
                    </h3>
                    {(space as any)._count?.items !== undefined && (
                      <p className="text-sm text-muted-foreground">
                        {(space as any)._count.items} items
                      </p>
                    )}
                  </div>
                </Link>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEditDialog(space)} className="gap-2">
                      <Pencil className="h-4 w-4" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      onClick={() => openDeleteDialog(space)}
                      className="text-destructive focus:text-destructive gap-2"
                    >
                      <Trash2 className="h-4 w-4" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border-2 border-dashed bg-muted/30 p-12 text-center">
          <div className="mx-auto w-fit rounded-full bg-primary/10 p-4 mb-4">
            <DoorOpen className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No spaces yet</h3>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
            Create spaces like rooms or areas to organize your items
          </p>
          <Button onClick={() => setShowCreateDialog(true)} className="gap-2">
            <Plus className="h-4 w-4" />
            Add Your First Space
          </Button>
        </div>
      )}

      {/* Create Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Space</DialogTitle>
            <DialogDescription>
              Create a new space to organize items in your property.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="create-name">Name *</Label>
              <Input
                id="create-name"
                placeholder="e.g., Kitchen, Garage, Master Bedroom"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={!!errors.name}
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false)
                resetForm()
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={createSpace.isPending}>
              {createSpace.isPending ? 'Creating...' : 'Create'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Space</DialogTitle>
            <DialogDescription>Update the space name.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="edit-name">Name *</Label>
              <Input
                id="edit-name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                aria-invalid={!!errors.name}
              />
              {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowEditDialog(false)
                resetForm()
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleUpdate} disabled={updateSpace.isPending}>
              {updateSpace.isPending ? 'Saving...' : 'Save'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Space</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedSpace?.name}"? Items in this space will not
              be deleted but will no longer be assigned to a space.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowDeleteDialog(false)
                resetForm()
              }}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteSpace.isPending}>
              {deleteSpace.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
