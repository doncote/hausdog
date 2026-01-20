import { createFileRoute, Link, useNavigate, useRouteContext } from '@tanstack/react-router'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
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
  const updateProperty = useUpdateProperty()
  const deleteProperty = useDeleteProperty()

  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
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
          <Link to="/properties/$propertyId/systems/new" params={{ propertyId }}>
            <Button>Add System</Button>
          </Link>
        </div>

        {/* TODO: Systems list will be added with Systems CRUD */}
        <Card>
          <CardContent className="py-12 text-center">
            <h3 className="text-lg font-medium mb-2">No systems yet</h3>
            <p className="text-muted-foreground mb-4">
              Add systems like HVAC, plumbing, or appliances to track
            </p>
            <Link to="/properties/$propertyId/systems/new" params={{ propertyId }}>
              <Button variant="outline">Add Your First System</Button>
            </Link>
          </CardContent>
        </Card>
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
    </div>
  )
}
