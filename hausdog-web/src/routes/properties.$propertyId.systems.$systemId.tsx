import { createFileRoute, Link, useNavigate, useRouteContext, Outlet, useMatch } from '@tanstack/react-router'
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { requireAuthFromContext } from '@/lib/auth'
import { updateSystemSchema } from '@hausdog/domain/systems'
import { useSystem, useUpdateSystem, useDeleteSystem } from '@/features/systems'
import { useProperty } from '@/features/properties'
import { useCategories } from '@/features/categories'
import { useComponentsForSystem, useCreateComponent, type Component } from '@/features/components'
import { createComponentSchema } from '@hausdog/domain/components'
import {
  useDocumentsForSystem,
  useUploadDocument,
  useExtractDocument,
  type Document,
} from '@/features/documents'
import { Badge } from '@/components/ui/badge'

export const Route = createFileRoute('/properties/$propertyId/systems/$systemId')({
  beforeLoad: ({ context }) => {
    requireAuthFromContext(context)
  },
  component: SystemDetailPage,
})

function SystemDetailPage() {
  const { propertyId, systemId } = Route.useParams()
  const { user } = useRouteContext({ from: '/properties/$propertyId/systems/$systemId' })
  const navigate = useNavigate()

  // Check if we're on a child route (component detail)
  const componentMatch = useMatch({ from: '/properties/$propertyId/systems/$systemId/components/$componentId', shouldThrow: false })
  if (componentMatch) {
    return <Outlet />
  }

  const { data: property } = useProperty(propertyId, user?.id)
  const { data: system, isPending, error } = useSystem(systemId, user?.id)
  const { data: categories } = useCategories()
  const updateSystem = useUpdateSystem()
  const deleteSystem = useDeleteSystem()
  const { data: components, isPending: componentsPending } = useComponentsForSystem(systemId, user?.id)
  const createComponentMutation = useCreateComponent()
  const { data: documents, isPending: documentsPending } = useDocumentsForSystem(systemId, user?.id)
  const uploadDocument = useUploadDocument()
  const extractDocument = useExtractDocument()

  const [isEditing, setIsEditing] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [showCreateComponentDialog, setShowCreateComponentDialog] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [categoryId, setCategoryId] = useState('')
  const [name, setName] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [model, setModel] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Sync form state with system data
  useEffect(() => {
    if (system) {
      setCategoryId(system.categoryId)
      setName(system.name)
      setManufacturer(system.manufacturer ?? '')
      setModel(system.model ?? '')
      setSerialNumber(system.serialNumber ?? '')
      setNotes(system.notes ?? '')
    }
  }, [system])

  const handleSave = async () => {
    setErrors({})

    const result = updateSystemSchema.safeParse({
      categoryId,
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
      await updateSystem.mutateAsync({
        id: systemId,
        userId: user.id,
        propertyId,
        input: result.data,
      })
      toast.success('System updated')
      setIsEditing(false)
    } catch {
      toast.error('Failed to update system')
    }
  }

  const handleDelete = async () => {
    if (!user) return

    try {
      await deleteSystem.mutateAsync({ id: systemId, userId: user.id, propertyId })
      toast.success('System deleted')
      navigate({ to: '/properties/$propertyId', params: { propertyId } })
    } catch {
      toast.error('Failed to delete system')
    }
  }

  const handleCancel = () => {
    if (system) {
      setCategoryId(system.categoryId)
      setName(system.name)
      setManufacturer(system.manufacturer ?? '')
      setModel(system.model ?? '')
      setSerialNumber(system.serialNumber ?? '')
      setNotes(system.notes ?? '')
    }
    setErrors({})
    setIsEditing(false)
  }

  const category = categories?.find((c) => c.id === system?.categoryId)

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

  if (error || !system) {
    return (
      <div className="mx-auto max-w-5xl px-6 py-8">
        <Card className="border-destructive">
          <CardContent className="pt-6">
            <p className="text-destructive">System not found</p>
            <Link to="/properties/$propertyId" params={{ propertyId }} className="mt-4 inline-block">
              <Button variant="outline">Back to Property</Button>
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
        <span className="text-sm">{system.name}</span>
      </div>

      {/* System Details */}
      <Card className="mb-8">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <CategoryIcon icon={category?.icon} className="size-8 text-muted-foreground" />
              <div>
                <CardTitle>{isEditing ? 'Edit System' : system.name}</CardTitle>
                {!isEditing && (
                  <CardDescription>
                    {category?.name}
                    {system.manufacturer && ` · ${system.manufacturer}`}
                    {system.model && ` ${system.model}`}
                  </CardDescription>
                )}
              </div>
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
                <Label htmlFor="category">Category *</Label>
                <Select value={categoryId} onValueChange={setCategoryId}>
                  <SelectTrigger aria-invalid={!!errors.categoryId}>
                    <SelectValue placeholder="Select a category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map((cat) => (
                      <SelectItem key={cat.id} value={cat.id}>
                        {cat.icon && <span className="mr-2">{cat.icon}</span>}
                        {cat.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {errors.categoryId && (
                  <p className="text-sm text-destructive">{errors.categoryId}</p>
                )}
              </div>

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
                <Button onClick={handleSave} disabled={updateSystem.isPending}>
                  {updateSystem.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </CardContent>
        ) : (
          <CardContent>
            <dl className="space-y-4">
              {system.serialNumber && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Serial Number</dt>
                  <dd className="mt-1">{system.serialNumber}</dd>
                </div>
              )}
              {system.installDate && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Install Date</dt>
                  <dd className="mt-1">{new Date(system.installDate).toLocaleDateString()}</dd>
                </div>
              )}
              {system.warrantyExpires && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Warranty Expires</dt>
                  <dd className="mt-1">{new Date(system.warrantyExpires).toLocaleDateString()}</dd>
                </div>
              )}
              {system.notes && (
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">Notes</dt>
                  <dd className="mt-1 whitespace-pre-wrap">{system.notes}</dd>
                </div>
              )}
              {!system.serialNumber && !system.installDate && !system.warrantyExpires && !system.notes && (
                <p className="text-muted-foreground">No additional details.</p>
              )}
            </dl>
          </CardContent>
        )}
      </Card>

      {/* Components Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Components</h2>
          <Button onClick={() => setShowCreateComponentDialog(true)}>Add Component</Button>
        </div>

        {componentsPending ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : components && components.length > 0 ? (
          <div className="space-y-3">
            {components.map((component) => (
              <ComponentCard
                key={component.id}
                component={component}
                propertyId={propertyId}
                systemId={systemId}
              />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <h3 className="text-lg font-medium mb-2">No components yet</h3>
              <p className="text-muted-foreground mb-4">
                Add components like filters, motors, or parts to track
              </p>
              <Button variant="outline" onClick={() => setShowCreateComponentDialog(true)}>
                Add Your First Component
              </Button>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Documents Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold">Documents</h2>
          <label className="cursor-pointer">
            <input
              type="file"
              className="hidden"
              accept="image/*,application/pdf"
              onChange={async (e) => {
                const file = e.target.files?.[0]
                if (!file || !user) return

                setIsUploading(true)
                try {
                  // Convert file to base64 using FileReader (browser-compatible)
                  const base64 = await new Promise<string>((resolve, reject) => {
                    const reader = new FileReader()
                    reader.onload = () => {
                      const result = reader.result as string
                      // Remove data URL prefix (e.g., "data:image/jpeg;base64,")
                      const base64Data = result.split(',')[1]
                      resolve(base64Data)
                    }
                    reader.onerror = reject
                    reader.readAsDataURL(file)
                  })

                  // Upload document
                  const doc = await uploadDocument.mutateAsync({
                    userId: user.id,
                    filename: file.name,
                    contentType: file.type,
                    fileData: base64,
                    systemId,
                    propertyId,
                  })

                  toast.success('Document uploaded, extracting...')

                  // Trigger extraction
                  await extractDocument.mutateAsync({
                    documentId: doc.id,
                    userId: user.id,
                    systemId,
                  })

                  toast.success('Document processed!')
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : 'Upload failed')
                } finally {
                  setIsUploading(false)
                  e.target.value = ''
                }
              }}
              disabled={isUploading}
            />
            <Button asChild disabled={isUploading}>
              <span>{isUploading ? 'Uploading...' : 'Upload Document'}</span>
            </Button>
          </label>
        </div>

        {documentsPending ? (
          <div className="space-y-3">
            <Skeleton className="h-16 w-full" />
            <Skeleton className="h-16 w-full" />
          </div>
        ) : documents && documents.length > 0 ? (
          <div className="space-y-3">
            {documents.map((doc) => (
              <DocumentCard key={doc.id} document={doc} />
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="py-12 text-center">
              <h3 className="text-lg font-medium mb-2">No documents yet</h3>
              <p className="text-muted-foreground mb-4">
                Upload receipts, manuals, or photos to extract information
              </p>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Create Component Dialog */}
      <CreateComponentDialog
        open={showCreateComponentDialog}
        onOpenChange={setShowCreateComponentDialog}
        systemId={systemId}
        userId={user?.id}
        createComponentMutation={createComponentMutation}
      />

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete System</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{system.name}"? This will also delete all
              associated components and documents. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteSystem.isPending}
            >
              {deleteSystem.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ComponentCard({
  component,
  propertyId,
  systemId,
}: {
  component: Component
  propertyId: string
  systemId: string
}) {
  return (
    <Link
      to="/properties/$propertyId/systems/$systemId/components/$componentId"
      params={{ propertyId, systemId, componentId: component.id }}
      className="block"
    >
      <Card className="hover:bg-muted/50 transition-colors">
        <CardContent className="py-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-medium">{component.name}</h3>
              <p className="text-sm text-muted-foreground">
                {component.manufacturer && component.manufacturer}
                {component.manufacturer && component.model && ' '}
                {component.model && component.model}
                {!component.manufacturer && !component.model && 'No details'}
              </p>
            </div>
            {component.warrantyExpires && (
              <div className="text-sm text-muted-foreground">
                Warranty: {new Date(component.warrantyExpires).toLocaleDateString()}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </Link>
  )
}

interface CreateComponentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  systemId: string
  userId: string | undefined
  createComponentMutation: ReturnType<typeof useCreateComponent>
}

function CreateComponentDialog({
  open,
  onOpenChange,
  systemId,
  userId,
  createComponentMutation,
}: CreateComponentDialogProps) {
  const [componentName, setComponentName] = useState('')
  const [manufacturer, setManufacturer] = useState('')
  const [model, setModel] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const resetForm = () => {
    setComponentName('')
    setManufacturer('')
    setModel('')
    setSerialNumber('')
    setNotes('')
    setErrors({})
  }

  const handleCreate = async () => {
    if (!userId) return
    setErrors({})

    const result = createComponentSchema.safeParse({
      systemId,
      name: componentName,
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
      await createComponentMutation.mutateAsync({
        userId,
        input: result.data,
      })
      toast.success('Component created')
      resetForm()
      onOpenChange(false)
    } catch {
      toast.error('Failed to create component')
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
          <DialogTitle>Add Component</DialogTitle>
          <DialogDescription>
            Add a new component to track for this system.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="componentName">Name *</Label>
            <Input
              id="componentName"
              value={componentName}
              onChange={(e) => setComponentName(e.target.value)}
              placeholder="e.g., Air Filter, Compressor"
              aria-invalid={!!errors.name}
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="componentManufacturer">Manufacturer</Label>
              <Input
                id="componentManufacturer"
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="componentModel">Model</Label>
              <Input
                id="componentModel"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="componentSerialNumber">Serial Number</Label>
            <Input
              id="componentSerialNumber"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="componentNotes">Notes</Label>
            <Textarea
              id="componentNotes"
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
          <Button onClick={handleCreate} disabled={createComponentMutation.isPending}>
            {createComponentMutation.isPending ? 'Creating...' : 'Create Component'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function DocumentCard({ document }: { document: Document }) {
  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    processing: 'bg-blue-100 text-blue-800',
    complete: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
  }

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center justify-between">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium truncate">{document.filename}</h3>
              <Badge className={statusColors[document.processingStatus] || ''}>
                {document.processingStatus}
              </Badge>
            </div>
            {document.extractedData && (
              <div className="mt-1 text-sm text-muted-foreground">
                {document.extractedData.documentType && (
                  <span className="capitalize">{document.extractedData.documentType}</span>
                )}
                {document.extractedData.equipment?.manufacturer && (
                  <span> · {document.extractedData.equipment.manufacturer}</span>
                )}
                {document.extractedData.equipment?.model && (
                  <span> {document.extractedData.equipment.model}</span>
                )}
              </div>
            )}
            {document.extractedData?.financial?.amount && (
              <div className="mt-1 text-sm">
                ${document.extractedData.financial.amount.toFixed(2)}
                {document.extractedData.financial.vendor && (
                  <span className="text-muted-foreground"> from {document.extractedData.financial.vendor}</span>
                )}
              </div>
            )}
          </div>
          <div className="text-sm text-muted-foreground">
            {new Date(document.createdAt).toLocaleDateString()}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
