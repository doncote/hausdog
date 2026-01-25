import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import {
  ChevronRight,
  Home,
  Layers,
  Loader2,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react'
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  useSpacesForProperty,
  useCreateSpace,
  useUpdateSpace,
  useDeleteSpace,
  type Space,
} from '@/features/spaces'
import { useCurrentProperty } from '@/hooks/use-current-property'

export const Route = createFileRoute('/_authenticated/spaces/')({
  component: SpacesPage,
})

function SpacesPage() {
  const { user } = Route.useRouteContext()
  const { currentProperty, isLoaded } = useCurrentProperty()

  const { data: spaces, isPending: spacesLoading } = useSpacesForProperty(currentProperty?.id)
  const createSpace = useCreateSpace()
  const updateSpace = useUpdateSpace()
  const deleteSpace = useDeleteSpace()

  const [showCreateDialog, setShowCreateDialog] = useState(false)
  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [selectedSpace, setSelectedSpace] = useState<Space | null>(null)

  const [name, setName] = useState('')

  const resetForm = () => {
    setName('')
  }

  const handleCreate = async () => {
    if (!currentProperty || !name.trim() || !user) return

    try {
      await createSpace.mutateAsync({
        userId: user.id,
        input: {
          propertyId: currentProperty.id,
          name: name.trim(),
        },
      })
      toast.success('Space created')
      setShowCreateDialog(false)
      resetForm()
    } catch {
      toast.error('Failed to create space')
    }
  }

  const handleEdit = async () => {
    if (!selectedSpace || !name.trim() || !user) return

    try {
      await updateSpace.mutateAsync({
        id: selectedSpace.id,
        userId: user.id,
        propertyId: selectedSpace.propertyId,
        input: {
          name: name.trim(),
        },
      })
      toast.success('Space updated')
      setShowEditDialog(false)
      setSelectedSpace(null)
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
        propertyId: selectedSpace.propertyId,
      })
      toast.success('Space deleted')
      setShowDeleteDialog(false)
      setSelectedSpace(null)
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

  if (!isLoaded) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!currentProperty) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="rounded-xl border-2 border-dashed bg-muted/30 p-12 text-center">
          <div className="mx-auto w-fit rounded-full bg-primary/10 p-4 mb-4">
            <Home className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No property selected</h3>
          <p className="text-muted-foreground mb-6">
            Select a property from the header to view spaces.
          </p>
          <Link to="/properties/new">
            <Button>Add Your First Property</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <nav className="flex items-center gap-2 text-sm mb-8">
        <Link
          to="/dashboard"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          Dashboard
        </Link>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">Spaces</span>
      </nav>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Spaces</h1>
          <p className="text-muted-foreground mt-1">
            Rooms and areas in {currentProperty.name}
          </p>
        </div>
        <Button className="gap-2" onClick={() => setShowCreateDialog(true)}>
          <Plus className="h-4 w-4" />
          Add Space
        </Button>
      </div>

      {spacesLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : !spaces || spaces.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed bg-muted/30 p-12 text-center">
          <div className="mx-auto w-fit rounded-full bg-primary/10 p-4 mb-4">
            <Layers className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No spaces yet</h3>
          <p className="text-muted-foreground mb-6">
            Add spaces like Kitchen, Garage, or Master Bedroom to organize your items.
          </p>
          <Button className="gap-2" onClick={() => setShowCreateDialog(true)}>
            <Plus className="h-4 w-4" />
            Add Space
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {spaces.map((space) => (
            <div
              key={space.id}
              className="rounded-xl border bg-card p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between">
                <Link
                  to="/spaces/$spaceId"
                  params={{ spaceId: space.id }}
                  className="flex items-start gap-3 flex-1 min-w-0"
                >
                  <div className="rounded-lg bg-secondary p-2.5">
                    <Layers className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{space.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {space._count?.items || 0} items
                    </p>
                  </div>
                </Link>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="h-8 w-8">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => openEditDialog(space)}>
                      <Pencil className="h-4 w-4 mr-2" />
                      Edit
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onClick={() => openDeleteDialog(space)}
                      className="text-destructive"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Space Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Space</DialogTitle>
            <DialogDescription>
              Create a new space to organize items in {currentProperty.name}.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                placeholder="e.g., Kitchen, Garage, Master Bedroom"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreate} disabled={!name.trim() || createSpace.isPending}>
              {createSpace.isPending ? 'Creating...' : 'Create Space'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit Space Dialog */}
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
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleEdit} disabled={!name.trim() || updateSpace.isPending}>
              {updateSpace.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Space</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{selectedSpace?.name}"? Items in this space
              will not be deleted but will no longer be assigned to a space.
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
