import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import {
  ArrowLeft,
  Box,
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
import { useSpace, useUpdateSpace, useDeleteSpace } from '@/features/spaces'
import { useItemsForSpace } from '@/features/items'
import { useCurrentProperty } from '@/hooks/use-current-property'

export const Route = createFileRoute('/_authenticated/spaces/$spaceId')({
  component: SpaceDetailPage,
})

function SpaceDetailPage() {
  const { spaceId } = Route.useParams()
  const { user } = Route.useRouteContext()
  const { currentProperty } = useCurrentProperty()
  const navigate = useNavigate()

  const { data: space, isPending: spaceLoading } = useSpace(spaceId)
  const { data: items, isPending: itemsLoading } = useItemsForSpace(spaceId)
  const updateSpace = useUpdateSpace()
  const deleteSpace = useDeleteSpace()

  const [showEditDialog, setShowEditDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [name, setName] = useState('')

  const openEditDialog = () => {
    if (space) {
      setName(space.name)
      setShowEditDialog(true)
    }
  }

  const handleEdit = async () => {
    if (!space || !name.trim() || !user) return

    try {
      await updateSpace.mutateAsync({
        id: space.id,
        userId: user.id,
        propertyId: space.propertyId,
        input: {
          name: name.trim(),
        },
      })
      toast.success('Space updated')
      setShowEditDialog(false)
    } catch {
      toast.error('Failed to update space')
    }
  }

  const handleDelete = async () => {
    if (!space) return

    try {
      await deleteSpace.mutateAsync({
        id: space.id,
        propertyId: space.propertyId,
      })
      toast.success('Space deleted')
      navigate({ to: '/spaces' })
    } catch {
      toast.error('Failed to delete space')
    }
  }

  if (spaceLoading) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!space) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="rounded-xl border-2 border-dashed bg-muted/30 p-12 text-center">
          <h3 className="text-lg font-semibold mb-2">Space not found</h3>
          <p className="text-muted-foreground mb-6">
            This space may have been deleted.
          </p>
          <Link to="/spaces">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Spaces
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <Link
        to="/spaces"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Spaces
      </Link>

      <div className="flex items-start justify-between mb-8">
        <div className="flex items-start gap-4">
          <div className="rounded-lg bg-primary/10 p-3">
            <Layers className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{space.name}</h1>
            <p className="text-muted-foreground mt-1">
              {items?.length || 0} items
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
            <DropdownMenuItem onClick={openEditDialog}>
              <Pencil className="h-4 w-4 mr-2" />
              Edit Space
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => setShowDeleteDialog(true)}
              className="text-destructive"
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Delete Space
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Items Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Items in this space</h2>
          {currentProperty && (
            <Link
              to="/items/new"
              search={{ propertyId: currentProperty.id, spaceId: space.id, parentId: undefined }}
            >
              <Button size="sm" className="gap-2">
                <Plus className="h-4 w-4" />
                Add Item
              </Button>
            </Link>
          )}
        </div>

        {itemsLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : !items || items.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed bg-muted/30 p-8 text-center">
            <p className="text-muted-foreground mb-4">No items in this space yet</p>
            {currentProperty && (
              <Link
                to="/items/new"
                search={{ propertyId: currentProperty.id, spaceId: space.id, parentId: undefined }}
              >
                <Button size="sm" variant="outline" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Add Item
                </Button>
              </Link>
            )}
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <Link
                key={item.id}
                to="/items/$itemId"
                params={{ itemId: item.id }}
                className="rounded-xl border bg-card p-4 hover:shadow-md transition-shadow block"
              >
                <div className="flex items-start gap-3">
                  <div className="rounded-lg bg-secondary p-2.5">
                    <Box className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{item.name}</p>
                    <p className="text-sm text-muted-foreground">{item.category}</p>
                    {(item.manufacturer || item.model) && (
                      <p className="text-xs text-muted-foreground mt-1 truncate">
                        {[item.manufacturer, item.model].filter(Boolean).join(' ')}
                      </p>
                    )}
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

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

      {/* Delete Dialog */}
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
