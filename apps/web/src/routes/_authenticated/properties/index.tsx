import { createFileRoute, Link } from '@tanstack/react-router'
import { Box, Building2, Home, MapPin, MoreVertical, Pencil, Plus, Trash2 } from 'lucide-react'
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
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useDeleteProperty, useProperties } from '@/features/properties'

export const Route = createFileRoute('/_authenticated/properties/')({
  component: PropertiesPage,
})

function PropertiesPage() {
  const { user } = Route.useRouteContext()
  const { data: properties, isPending, error } = useProperties(user?.id)
  const deleteProperty = useDeleteProperty()
  const [deleteId, setDeleteId] = useState<string | null>(null)

  const handleDelete = async () => {
    if (!deleteId || !user) return

    try {
      await deleteProperty.mutateAsync({ id: deleteId, userId: user.id })
      toast.success('Property deleted')
      setDeleteId(null)
    } catch {
      toast.error('Failed to delete property')
    }
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="flex items-start justify-between mb-10">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Properties</h1>
          <p className="text-muted-foreground mt-2">Manage your homes and rental properties</p>
        </div>
        <Link to="/properties/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Property
          </Button>
        </Link>
      </div>

      {isPending && <PropertiesLoading />}

      {error && (
        <div className="rounded-xl border border-destructive/50 bg-destructive/5 p-6">
          <p className="text-destructive">Failed to load properties</p>
        </div>
      )}

      {properties && properties.length === 0 && (
        <div className="rounded-xl border-2 border-dashed bg-muted/30 p-12 text-center">
          <div className="mx-auto w-fit rounded-full bg-primary/10 p-4 mb-4">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No properties yet</h3>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
            Add your first property to start tracking your home documentation
          </p>
          <Link to="/properties/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Your First Property
            </Button>
          </Link>
        </div>
      )}

      {properties && properties.length > 0 && (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {properties.map((property) => (
            <Link
              key={property.id}
              to="/properties/$propertyId"
              params={{ propertyId: property.id }}
              className="group"
            >
              <div className="h-full rounded-xl border bg-card p-5 transition-all hover:shadow-md hover:border-primary/30">
                <div className="flex items-start justify-between mb-4">
                  <div className="rounded-lg bg-secondary p-2.5">
                    <Home className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => e.preventDefault()}
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link
                          to="/properties/$propertyId"
                          params={{ propertyId: property.id }}
                          className="gap-2"
                        >
                          <Pencil className="h-4 w-4" />
                          Edit
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive gap-2"
                        onClick={(e) => {
                          e.preventDefault()
                          setDeleteId(property.id)
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>

                <h3 className="font-semibold text-lg group-hover:text-primary transition-colors">
                  {property.name}
                </h3>

                {property.formattedAddress && (
                  <p className="text-sm text-muted-foreground mt-1 flex items-center gap-1.5">
                    <MapPin className="h-3.5 w-3.5" />
                    <span className="truncate">{property.formattedAddress}</span>
                  </p>
                )}

                <div className="flex items-center gap-4 mt-4 pt-4 border-t text-sm text-muted-foreground">
                  <span className="flex items-center gap-1.5">
                    <Box className="h-4 w-4" />
                    {property._count?.items ?? 0} items
                  </span>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      <Dialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Property</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete this property? This will also delete all associated
              items and documents. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteId(null)}>
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

function PropertiesLoading() {
  return (
    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-xl border bg-card p-5">
          <div className="h-10 w-10 bg-muted animate-pulse rounded-lg mb-4" />
          <div className="h-5 w-32 bg-muted animate-pulse rounded mb-2" />
          <div className="h-4 w-48 bg-muted animate-pulse rounded mb-4" />
          <div className="pt-4 border-t">
            <div className="h-4 w-20 bg-muted animate-pulse rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}
