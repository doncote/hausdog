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
import { updateComponentSchema } from '@hausdog/domain/components'
import { useComponent, useUpdateComponent, useDeleteComponent } from '@/features/components'
import { useSystem } from '@/features/systems'
import { useProperty } from '@/features/properties'

export const Route = createFileRoute('/properties/$propertyId/systems/$systemId/components/$componentId')({
  beforeLoad: ({ context }) => {
    requireAuthFromContext(context)
  },
  component: ComponentDetailPage,
})

function ComponentDetailPage() {
  const { propertyId, systemId, componentId } = Route.useParams()
  const { user } = useRouteContext({ from: '/properties/$propertyId/systems/$systemId/components/$componentId' })
  const navigate = useNavigate()

  const { data: property } = useProperty(propertyId, user?.id)
  const { data: system } = useSystem(systemId, user?.id)
  const { data: component, isPending, error } = useComponent(componentId, user?.id)
  const updateComponent = useUpdateComponent()
  const deleteComponent = useDeleteComponent()

  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [name, setName] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [model, setModel] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Sync form state with component data
  useEffect(() => {
    if (component) {
      setName(component.name)
      setManufacturer(component.manufacturer ?? '')
      setModel(component.model ?? '')
      setSerialNumber(component.serialNumber ?? '')
      setNotes(component.notes ?? '')
    }
  }, [component])

  const handleSave = async () => {
    setErrors({})

    const result = updateComponentSchema.safeParse({
      name,
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

    if (!user) return

    try {
      await updateComponent.mutateAsync({
        id: componentId,
        userId: user.id,
        systemId,
        input: result.data,
      })
      toast.success('Component updated')
      setIsEditing(false)
    } catch {
      toast.error('Failed to update component')
    }
  }

  const handleDelete = async () => {
    if (!user) return

    try {
      await deleteComponent.mutateAsync({ id: componentId, userId: user.id, systemId })
      toast.success('Component deleted')
      navigate({ to: '/properties/$propertyId/systems/$systemId', params: { propertyId, systemId } })
    } catch {
      toast.error('Failed to delete component')
    }
  }

  const handleCancel = () => {
    if (component) {
      setName(component.name)
      setManufacturer(component.manufacturer ?? '')
      setModel(component.model ?? '')
      setSerialNumber(component.serialNumber ?? '')
      setNotes(component.notes ?? '')
    }
    setErrors({})
    setIsEditing(false)
  }

  if (isPending) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-8">
        <Skeleton className="h-4 w-64 mb-6" />
        <Card>
          <CardHeader>
            <Skeleton className="h-8 w-48" />
            <Skeleton className="h-4 w-32" />
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Skeleton className="h-10 w-full" />
              <Skeleton className="h-10 w-full" />
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !component) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-8">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">Component not found</p>
            <Link
              to="/properties/$propertyId/systems/$systemId"
              params={{ propertyId, systemId }}
              className="mt-4 inline-block"
            >
              <Button variant="outline">Back to System</Button>
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
        <Link
          to="/properties/$propertyId"
          params={{ propertyId }}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {property?.name ?? 'Property'}
        </Link>
        <span className="text-sm text-muted-foreground mx-2">/</span>
        <Link
          to="/properties/$propertyId/systems/$systemId"
          params={{ propertyId, systemId }}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          {system?.name ?? 'System'}
        </Link>
        <span className="text-sm text-muted-foreground mx-2">/</span>
        <span className="text-sm">{component.name}</span>
      </div>

      {/* Component Details */}
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>{isEditing ? 'Edit Component' : component.name}</CardTitle>
              {!isEditing && (
                <CardDescription>
                  {component.manufacturer && component.manufacturer}
                  {component.manufacturer && component.model && ' '}
                  {component.model && component.model}
                </CardDescription>
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

        {isEditing ? (
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

              <div className="grid grid-cols-2 gap-4">
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
                  <Input
                    id="model"
                    value={model}
                    onChange={(e) => setModel(e.target.value)}
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
                  rows={3}
                />
              </div>

              <div className="flex gap-4">
                <Button variant="outline" onClick={handleCancel}>
                  Cancel
                </Button>
                <Button onClick={handleSave} disabled={updateComponent.isPending}>
                  {updateComponent.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </CardContent>
        ) : (
          <CardContent>
            <dl className="space-y-4">
              {component.serialNumber && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Serial Number</dt>
                  <dd className="mt-1">{component.serialNumber}</dd>
                </div>
              )}
              {component.installDate && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Install Date</dt>
                  <dd className="mt-1">{new Date(component.installDate).toLocaleDateString()}</dd>
                </div>
              )}
              {component.warrantyExpires && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Warranty Expires</dt>
                  <dd className="mt-1">{new Date(component.warrantyExpires).toLocaleDateString()}</dd>
                </div>
              )}
              {component.notes && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Notes</dt>
                  <dd className="mt-1 whitespace-pre-wrap">{component.notes}</dd>
                </div>
              )}
              {!component.serialNumber && !component.installDate && !component.warrantyExpires && !component.notes && (
                <p className="text-muted-foreground">No additional details.</p>
              )}
            </dl>
          </CardContent>
        )}
      </Card>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Component</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{component.name}"? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteComponent.isPending}
            >
              {deleteComponent.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
