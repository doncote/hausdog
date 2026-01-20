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
  useDeleteDocument,
  type Document,
} from '@/features/documents'
import { Badge } from '@/components/ui/badge'
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Receipt,
  FileText,
  Shield,
  FileCheck,
  ClipboardCheck,
  Wrench,
  Camera,
  File,
  Box,
  MoreVertical,
  Pencil,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

function DocTypeIcon({ type }: { type?: string }) {
  const iconClass = 'size-5 text-muted-foreground'
  switch (type) {
    case 'manual':
      return <BookOpen className={iconClass} />
    case 'receipt':
      return <Receipt className={iconClass} />
    case 'invoice':
      return <FileText className={iconClass} />
    case 'warranty':
      return <Shield className={iconClass} />
    case 'permit':
      return <FileCheck className={iconClass} />
    case 'inspection':
      return <ClipboardCheck className={iconClass} />
    case 'service_record':
      return <Wrench className={iconClass} />
    case 'photo':
      return <Camera className={iconClass} />
    default:
      return <File className={iconClass} />
  }
}

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

  // All hooks must be called before any conditional returns
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
  const deleteDocumentMutation = useDeleteDocument()

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

  // Now safe to do conditional return after all hooks
  if (componentMatch) {
    return <Outlet />
  }

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
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="h-5 w-48 bg-muted animate-pulse rounded mb-8" />
          <div className="rounded-xl border bg-card p-6 mb-8">
            <div className="flex items-center gap-4 mb-4">
              <div className="h-12 w-12 bg-muted animate-pulse rounded-lg" />
              <div>
                <div className="h-6 w-40 bg-muted animate-pulse rounded mb-2" />
                <div className="h-4 w-32 bg-muted animate-pulse rounded" />
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  if (error || !system) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-6xl px-6 py-10">
          <div className="rounded-xl border border-destructive/50 bg-destructive/5 p-8 text-center">
            <p className="text-destructive font-medium mb-4">System not found</p>
            <Link to="/properties/$propertyId" params={{ propertyId }}>
              <Button variant="outline" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back to Property
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-6 py-10">
        {/* Breadcrumb */}
        <nav className="flex items-center gap-2 text-sm mb-8">
          <Link to="/properties" className="text-muted-foreground hover:text-foreground transition-colors">
            Properties
          </Link>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <Link
            to="/properties/$propertyId"
            params={{ propertyId }}
            className="text-muted-foreground hover:text-foreground transition-colors"
          >
            {property?.name ?? 'Property'}
          </Link>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{system.name}</span>
        </nav>

        {/* System Header */}
        <div className="rounded-xl border bg-card p-6 mb-8">
          {isEditing ? (
            <EditSystemForm />
          ) : (
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="rounded-lg bg-secondary p-3">
                  <CategoryIcon icon={category?.icon} className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <h1 className="text-2xl font-bold tracking-tight">{system.name}</h1>
                  <p className="text-muted-foreground mt-1">
                    {category?.name}
                    {system.manufacturer && ` · ${system.manufacturer}`}
                    {system.model && ` ${system.model}`}
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

        {/* System Details when not editing */}
        {!isEditing && (system.serialNumber || system.installDate || system.warrantyExpires || system.notes) && (
          <div className="rounded-xl border bg-card p-6 mb-8">
            <h2 className="text-sm font-medium text-muted-foreground mb-4">Details</h2>
            <dl className="grid gap-4 sm:grid-cols-2">
              {system.serialNumber && (
                <div>
                  <dt className="text-sm text-muted-foreground">Serial Number</dt>
                  <dd className="mt-1 font-medium">{system.serialNumber}</dd>
                </div>
              )}
              {system.installDate && (
                <div>
                  <dt className="text-sm text-muted-foreground">Install Date</dt>
                  <dd className="mt-1 font-medium">{new Date(system.installDate).toLocaleDateString()}</dd>
                </div>
              )}
              {system.warrantyExpires && (
                <div>
                  <dt className="text-sm text-muted-foreground">Warranty Expires</dt>
                  <dd className="mt-1 font-medium">{new Date(system.warrantyExpires).toLocaleDateString()}</dd>
                </div>
              )}
              {system.notes && (
                <div className="sm:col-span-2">
                  <dt className="text-sm text-muted-foreground">Notes</dt>
                  <dd className="mt-1 whitespace-pre-wrap">{system.notes}</dd>
                </div>
              )}
            </dl>
          </div>
        )}

        {/* Edit Form - extracted to keep render function cleaner */}
        {isEditing && (
          <div className="rounded-xl border bg-card p-6 mb-8">
            <h2 className="text-lg font-semibold mb-6">Edit System</h2>
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
                {errors.categoryId && <p className="text-sm text-destructive">{errors.categoryId}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="name">Name *</Label>
                <Input id="name" value={name} onChange={(e) => setName(e.target.value)} aria-invalid={!!errors.name} />
                {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="manufacturer">Manufacturer</Label>
                  <Input id="manufacturer" value={manufacturer} onChange={(e) => setManufacturer(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="model">Model</Label>
                  <Input id="model" value={model} onChange={(e) => setModel(e.target.value)} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="serialNumber">Serial Number</Label>
                <Input id="serialNumber" value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} />
              </div>

              <div className="space-y-2">
                <Label htmlFor="notes">Notes</Label>
                <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} />
              </div>

              <div className="flex gap-3 pt-2">
                <Button variant="outline" onClick={handleCancel}>Cancel</Button>
                <Button onClick={handleSave} disabled={updateSystem.isPending}>
                  {updateSystem.isPending ? 'Saving...' : 'Save Changes'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Components Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold">Components</h2>
              <p className="text-sm text-muted-foreground">Individual parts and replaceable items</p>
            </div>
            <Button onClick={() => setShowCreateComponentDialog(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Add Component
            </Button>
          </div>

          {componentsPending ? (
            <div className="space-y-3">
              <div className="h-16 w-full bg-muted animate-pulse rounded-xl" />
              <div className="h-16 w-full bg-muted animate-pulse rounded-xl" />
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
            <div className="rounded-xl border-2 border-dashed bg-muted/30 p-12 text-center">
              <div className="mx-auto w-fit rounded-full bg-primary/10 p-4 mb-4">
                <Box className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No components yet</h3>
              <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                Add components like filters, motors, or parts to track
              </p>
              <Button onClick={() => setShowCreateComponentDialog(true)} className="gap-2">
                <Plus className="h-4 w-4" />
                Add Your First Component
              </Button>
            </div>
          )}
        </div>

        {/* Documents Section */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="text-lg font-semibold">Documents</h2>
              <p className="text-sm text-muted-foreground">Receipts, manuals, warranties, and photos</p>
            </div>
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
                    const base64 = await new Promise<string>((resolve, reject) => {
                      const reader = new FileReader()
                      reader.onload = () => {
                        const result = reader.result as string
                        const base64Data = result.split(',')[1]
                        resolve(base64Data)
                      }
                      reader.onerror = reject
                      reader.readAsDataURL(file)
                    })

                    const doc = await uploadDocument.mutateAsync({
                      userId: user.id,
                      filename: file.name,
                      contentType: file.type,
                      fileData: base64,
                      systemId,
                      propertyId,
                    })

                    toast.success('Document uploaded, extracting...')

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
              <Button asChild disabled={isUploading} className="gap-2">
                <span>
                  <Upload className="h-4 w-4" />
                  {isUploading ? 'Uploading...' : 'Upload Document'}
                </span>
              </Button>
            </label>
          </div>

          {documentsPending ? (
            <div className="space-y-3">
              <div className="h-20 w-full bg-muted animate-pulse rounded-xl" />
              <div className="h-20 w-full bg-muted animate-pulse rounded-xl" />
            </div>
          ) : documents && documents.length > 0 ? (
          <div className="space-y-3">
            {documents.map((doc) => (
              <DocumentCard
                key={doc.id}
                document={doc}
                userId={user!.id}
                systemId={systemId}
                onDelete={async () => {
                  try {
                    await deleteDocumentMutation.mutateAsync({
                      id: doc.id,
                      userId: user!.id,
                      systemId,
                      propertyId,
                    })
                    toast.success('Document deleted')
                  } catch {
                    toast.error('Failed to delete document')
                  }
                }}
                onCreateComponent={async () => {
                  if (!doc.extractedData?.equipment) return
                  const eq = doc.extractedData.equipment
                  const name = eq.manufacturer && eq.model
                    ? `${eq.manufacturer} ${eq.model}`
                    : eq.manufacturer || eq.model || doc.extractedData.documentType || 'Component'
                  try {
                    await createComponentMutation.mutateAsync({
                      userId: user!.id,
                      input: {
                        systemId,
                        name,
                        manufacturer: eq.manufacturer || undefined,
                        model: eq.model || undefined,
                        serialNumber: eq.serialNumber || undefined,
                      },
                    })
                    toast.success(`Created component: ${name}`)
                  } catch {
                    toast.error('Failed to create component')
                  }
                }}
                onUpdateSystem={async () => {
                  if (!doc.extractedData?.equipment) return
                  const eq = doc.extractedData.equipment
                  try {
                    await updateSystem.mutateAsync({
                      id: systemId,
                      userId: user!.id,
                      propertyId,
                      input: {
                        categoryId: system!.categoryId,
                        name: system!.name,
                        manufacturer: eq.manufacturer || system!.manufacturer || undefined,
                        model: eq.model || system!.model || undefined,
                        serialNumber: eq.serialNumber || system!.serialNumber || undefined,
                      },
                    })
                    toast.success('System updated with document data')
                  } catch {
                    toast.error('Failed to update system')
                  }
                }}
              />
            ))}
          </div>
          ) : (
            <div className="rounded-xl border-2 border-dashed bg-muted/30 p-12 text-center">
              <div className="mx-auto w-fit rounded-full bg-primary/10 p-4 mb-4">
                <FileText className="h-8 w-8 text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No documents yet</h3>
              <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                Upload receipts, manuals, or photos to extract information automatically
              </p>
            </div>
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
    </div>
  )
}

function EditSystemForm() {
  return null // Form is rendered inline above
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
      className="group block"
    >
      <div className="rounded-xl border bg-card p-4 transition-all hover:shadow-md hover:border-primary/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-secondary p-2.5">
              <Box className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-medium group-hover:text-primary transition-colors">{component.name}</h3>
              <p className="text-sm text-muted-foreground">
                {component.manufacturer && component.manufacturer}
                {component.manufacturer && component.model && ' '}
                {component.model && component.model}
                {!component.manufacturer && !component.model && 'No details'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {component.warrantyExpires && (
              <span>Warranty: {new Date(component.warrantyExpires).toLocaleDateString()}</span>
            )}
            <ChevronRight className="h-5 w-5" />
          </div>
        </div>
      </div>
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

function DocumentCard({
  document,
  userId,
  systemId,
  onDelete,
  onCreateComponent,
  onUpdateSystem,
}: {
  document: Document
  userId: string
  systemId: string
  onDelete: () => void
  onCreateComponent: () => void
  onUpdateSystem: () => void
}) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)
  const hasEquipmentData = document.extractedData?.equipment?.manufacturer || document.extractedData?.equipment?.model

  useEffect(() => {
    // Get signed URL for thumbnail
    if (document.contentType.startsWith('image/')) {
      import('@/features/documents').then(({ getSignedUrl }) => {
        getSignedUrl({ data: { storagePath: document.storagePath, userId } })
          .then((result) => setThumbnailUrl(result.signedUrl))
          .catch(() => {}) // Ignore errors
      })
    }
  }, [document.storagePath, document.contentType, userId])

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    processing: 'bg-blue-100 text-blue-800',
    complete: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
  }

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center gap-4">
          {/* Thumbnail */}
          <div className="flex-shrink-0 w-16 h-16 rounded overflow-hidden bg-muted">
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt={document.filename}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground text-xs">
                {document.contentType.startsWith('image/') ? '...' : 'PDF'}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            {document.extractedData ? (
              <>
                <div className="flex items-center gap-2">
                  <DocTypeIcon type={document.extractedData.documentType} />
                  <h3 className="font-medium">
                    {document.extractedData.equipment?.manufacturer && document.extractedData.equipment?.model
                      ? `${document.extractedData.equipment.manufacturer} ${document.extractedData.equipment.model}`
                      : document.extractedData.equipment?.manufacturer || document.extractedData.documentType || 'Document'}
                  </h3>
                  {document.processingStatus !== 'complete' && (
                    <Badge className={statusColors[document.processingStatus] || ''}>
                      {document.processingStatus}
                    </Badge>
                  )}
                </div>
                {document.extractedData.financial?.amount && (
                  <div className="mt-1 text-sm">
                    ${document.extractedData.financial.amount.toFixed(2)}
                    {document.extractedData.financial.vendor && (
                      <span className="text-muted-foreground"> from {document.extractedData.financial.vendor}</span>
                    )}
                  </div>
                )}
                <p className="text-xs text-muted-foreground mt-1 truncate">{document.filename}</p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <h3 className="font-medium truncate">{document.filename}</h3>
                  <Badge className={statusColors[document.processingStatus] || ''}>
                    {document.processingStatus}
                  </Badge>
                </div>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            {hasEquipmentData && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault()
                    onCreateComponent()
                  }}
                >
                  + Component
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={(e) => {
                    e.preventDefault()
                    onUpdateSystem()
                  }}
                >
                  Update System
                </Button>
              </>
            )}
            <span className="text-sm text-muted-foreground">
              {new Date(document.createdAt).toLocaleDateString()}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="text-destructive hover:text-destructive"
              onClick={(e) => {
                e.preventDefault()
                if (confirm('Delete this document?')) {
                  onDelete()
                }
              }}
            >
              Delete
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
