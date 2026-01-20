# Components CRUD Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add full CRUD functionality for components within systems, enabling users to track individual parts/components of their home systems.

**Architecture:** Components are children of systems (system_id FK). Follow exact same feature pattern as systems: service → api → queries → mutations → UI. Components list on system detail page, separate detail page for view/edit/delete.

**Tech Stack:** TanStack Start, TanStack Query, Prisma, Zod, shadcn/ui

---

### Task 1: Create ComponentService

**Files:**
- Create: `src/features/components/service.ts`

**Step 1: Create the service file**

```typescript
import type { PrismaClient, components as PrismaComponent } from '@generated/prisma/client'
import type {
  Component,
  CreateComponentInput,
  UpdateComponentInput,
} from '@hausdog/domain/components'
import type { Logger } from '@/lib/logger'

export interface ComponentServiceDeps {
  db: PrismaClient
  logger: Logger
}

export class ComponentService {
  private db: PrismaClient
  private logger: Logger

  constructor(deps: ComponentServiceDeps) {
    this.db = deps.db
    this.logger = deps.logger
  }

  async findAllForSystem(systemId: string, userId: string): Promise<Component[]> {
    this.logger.debug('Finding all components for system', { systemId, userId })

    // Verify system ownership via property
    const system = await this.db.systems.findFirst({
      where: { id: systemId, properties: { user_id: userId } },
      select: { id: true },
    })
    if (!system) {
      throw new Error('System not found')
    }

    const records = await this.db.components.findMany({
      where: { system_id: systemId },
      orderBy: { name: 'asc' },
    })

    return records.map((r) => this.toDomain(r))
  }

  async findById(id: string, userId: string): Promise<Component | null> {
    this.logger.debug('Finding component by id', { id, userId })

    const record = await this.db.components.findFirst({
      where: {
        id,
        systems: { properties: { user_id: userId } },
      },
    })

    return record ? this.toDomain(record) : null
  }

  async create(userId: string, input: CreateComponentInput): Promise<Component> {
    this.logger.info('Creating component', { userId, systemId: input.systemId, name: input.name })

    // Verify system ownership via property
    const system = await this.db.systems.findFirst({
      where: { id: input.systemId, properties: { user_id: userId } },
      select: { id: true },
    })
    if (!system) {
      throw new Error('System not found')
    }

    const record = await this.db.components.create({
      data: {
        system_id: input.systemId,
        name: input.name,
        manufacturer: input.manufacturer ?? null,
        model: input.model ?? null,
        serial_number: input.serialNumber ?? null,
        install_date: input.installDate ?? null,
        warranty_expires: input.warrantyExpires ?? null,
        notes: input.notes ?? null,
      },
    })

    return this.toDomain(record)
  }

  async update(id: string, userId: string, input: UpdateComponentInput): Promise<Component> {
    this.logger.info('Updating component', { id, userId })

    // Verify ownership via system -> property
    const existing = await this.db.components.findFirst({
      where: {
        id,
        systems: { properties: { user_id: userId } },
      },
    })
    if (!existing) {
      throw new Error('Component not found')
    }

    const record = await this.db.components.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.manufacturer !== undefined && { manufacturer: input.manufacturer ?? null }),
        ...(input.model !== undefined && { model: input.model ?? null }),
        ...(input.serialNumber !== undefined && { serial_number: input.serialNumber ?? null }),
        ...(input.installDate !== undefined && { install_date: input.installDate ?? null }),
        ...(input.warrantyExpires !== undefined && { warranty_expires: input.warrantyExpires ?? null }),
        ...(input.notes !== undefined && { notes: input.notes ?? null }),
        updated_at: new Date(),
      },
    })

    return this.toDomain(record)
  }

  async delete(id: string, userId: string): Promise<void> {
    this.logger.info('Deleting component', { id, userId })

    // Verify ownership via system -> property
    const existing = await this.db.components.findFirst({
      where: {
        id,
        systems: { properties: { user_id: userId } },
      },
    })
    if (!existing) {
      throw new Error('Component not found')
    }

    await this.db.components.delete({ where: { id } })
  }

  private toDomain(record: PrismaComponent): Component {
    return {
      id: record.id,
      systemId: record.system_id,
      name: record.name,
      manufacturer: record.manufacturer,
      model: record.model,
      serialNumber: record.serial_number,
      installDate: record.install_date,
      warrantyExpires: record.warranty_expires,
      notes: record.notes,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    }
  }
}
```

**Step 2: Verify no syntax errors**

Run: `cd /Users/don/code/hausdog/hausdog-web && bun run typecheck`

---

### Task 2: Create Component API (Server Functions)

**Files:**
- Create: `src/features/components/api.ts`

**Step 1: Create the API file**

```typescript
import { createServerFn } from '@tanstack/react-start'
import type { CreateComponentInput, UpdateComponentInput } from '@hausdog/domain/components'
import { prisma } from '@/lib/db/client'
import { logger } from '@/lib/logger'
import { ComponentService } from './service'

const getComponentService = () => new ComponentService({ db: prisma, logger })

export const fetchComponentsForSystem = createServerFn({ method: 'GET' })
  .inputValidator((d: { systemId: string; userId: string }) => d)
  .handler(async ({ data }) => {
    const service = getComponentService()
    return service.findAllForSystem(data.systemId, data.userId)
  })

export const fetchComponent = createServerFn({ method: 'GET' })
  .inputValidator((d: { id: string; userId: string }) => d)
  .handler(async ({ data }) => {
    const service = getComponentService()
    return service.findById(data.id, data.userId)
  })

export const createComponent = createServerFn({ method: 'POST' })
  .inputValidator((d: { userId: string; input: CreateComponentInput }) => d)
  .handler(async ({ data }) => {
    const service = getComponentService()
    return service.create(data.userId, data.input)
  })

export const updateComponent = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string; userId: string; input: UpdateComponentInput }) => d)
  .handler(async ({ data }) => {
    const service = getComponentService()
    return service.update(data.id, data.userId, data.input)
  })

export const deleteComponent = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string; userId: string }) => d)
  .handler(async ({ data }) => {
    const service = getComponentService()
    await service.delete(data.id, data.userId)
    return { success: true }
  })
```

---

### Task 3: Create Component Queries

**Files:**
- Create: `src/features/components/queries.ts`

**Step 1: Create the queries file**

```typescript
import { queryOptions, useQuery } from '@tanstack/react-query'
import { fetchComponentsForSystem, fetchComponent } from './api'

export const componentKeys = {
  all: ['components'] as const,
  forSystem: (systemId: string) => [...componentKeys.all, 'system', systemId] as const,
  details: () => [...componentKeys.all, 'detail'] as const,
  detail: (id: string) => [...componentKeys.details(), id] as const,
}

export const componentsForSystemQueryOptions = (systemId: string, userId: string) =>
  queryOptions({
    queryKey: componentKeys.forSystem(systemId),
    queryFn: () => fetchComponentsForSystem({ data: { systemId, userId } }),
  })

export const componentQueryOptions = (id: string, userId: string) =>
  queryOptions({
    queryKey: componentKeys.detail(id),
    queryFn: () => fetchComponent({ data: { id, userId } }),
  })

export function useComponentsForSystem(systemId: string, userId: string | undefined) {
  return useQuery({
    ...componentsForSystemQueryOptions(systemId, userId ?? ''),
    enabled: !!userId && !!systemId,
  })
}

export function useComponent(id: string, userId: string | undefined) {
  return useQuery({
    ...componentQueryOptions(id, userId ?? ''),
    enabled: !!userId && !!id,
  })
}
```

---

### Task 4: Create Component Mutations

**Files:**
- Create: `src/features/components/mutations.ts`

**Step 1: Create the mutations file**

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { CreateComponentInput, UpdateComponentInput } from '@hausdog/domain/components'
import { createComponent, updateComponent, deleteComponent } from './api'
import { componentKeys } from './queries'

export function useCreateComponent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { userId: string; input: CreateComponentInput }) =>
      createComponent({ data: input }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: componentKeys.forSystem(variables.input.systemId),
      })
    },
  })
}

export function useUpdateComponent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { id: string; userId: string; systemId: string; input: UpdateComponentInput }) =>
      updateComponent({ data: { id: input.id, userId: input.userId, input: input.input } }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: componentKeys.forSystem(variables.systemId),
      })
      queryClient.invalidateQueries({ queryKey: componentKeys.detail(variables.id) })
    },
  })
}

export function useDeleteComponent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { id: string; userId: string; systemId: string }) =>
      deleteComponent({ data: { id: input.id, userId: input.userId } }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: componentKeys.forSystem(variables.systemId),
      })
      queryClient.removeQueries({ queryKey: componentKeys.detail(variables.id) })
    },
  })
}
```

---

### Task 5: Create Component Feature Index

**Files:**
- Create: `src/features/components/index.ts`

**Step 1: Create the index file**

```typescript
export * from './queries'
export * from './mutations'
export type {
  Component,
  CreateComponentInput,
  UpdateComponentInput,
} from '@hausdog/domain/components'
```

**Step 2: Verify typecheck passes**

Run: `cd /Users/don/code/hausdog/hausdog-web && bun run typecheck`

---

### Task 6: Update System Detail Page - Add Components List and Create Dialog

**Files:**
- Modify: `src/routes/properties/$propertyId/systems/$systemId.tsx`

**Step 1: Add imports for components feature**

Add to imports section:
```typescript
import { useComponentsForSystem, useCreateComponent, type Component } from '@/features/components'
import { createComponentSchema } from '@hausdog/domain/components'
```

**Step 2: Add state and hooks in SystemDetailPage component**

After the existing hooks (around line 48), add:
```typescript
const { data: components, isPending: componentsPending } = useComponentsForSystem(systemId, user?.id)
const createComponent = useCreateComponent()
const [showCreateComponentDialog, setShowCreateComponentDialog] = useState(false)
```

**Step 3: Replace the Components Section placeholder (lines 339-353)**

Replace with:
```typescript
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
```

**Step 4: Add CreateComponentDialog before the closing return tag**

Add before the final `</div>` of the return:
```typescript
{/* Create Component Dialog */}
<CreateComponentDialog
  open={showCreateComponentDialog}
  onOpenChange={setShowCreateComponentDialog}
  systemId={systemId}
  userId={user?.id}
  createComponent={createComponent}
/>
```

**Step 5: Add ComponentCard component after SystemDetailPage function**

```typescript
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
```

**Step 6: Add CreateComponentDialog component**

```typescript
interface CreateComponentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  systemId: string
  userId: string | undefined
  createComponent: ReturnType<typeof useCreateComponent>
}

function CreateComponentDialog({
  open,
  onOpenChange,
  systemId,
  userId,
  createComponent,
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
      await createComponent.mutateAsync({
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
          <Button onClick={handleCreate} disabled={createComponent.isPending}>
            {createComponent.isPending ? 'Creating...' : 'Create Component'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
```

---

### Task 7: Create Component Detail Page

**Files:**
- Create: `src/routes/properties/$propertyId/systems/$systemId/components/$componentId.tsx`

**Step 1: Create the component detail page**

```typescript
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
```

---

### Task 8: Verify and Test

**Step 1: Run typecheck**

Run: `cd /Users/don/code/hausdog/hausdog-web && bun run typecheck`

**Step 2: Start dev server and test manually**

Run: `cd /Users/don/code/hausdog && make dev`

Test:
1. Navigate to a property
2. Click on a system
3. Click "Add Component" - verify dialog opens
4. Create a component - verify it appears in list
5. Click on component - verify detail page loads
6. Edit component - verify save works
7. Delete component - verify redirect to system page

**Step 3: Commit**

```bash
git add hausdog-web/src/features/components
git add hausdog-web/src/routes/properties/\$propertyId/systems/\$systemId.tsx
git add hausdog-web/src/routes/properties/\$propertyId/systems/\$systemId/components/\$componentId.tsx
git commit -m "feat: add Components CRUD

- ComponentService with ownership verification via system -> property
- Server functions for CRUD operations
- TanStack Query hooks for data fetching
- Mutations with cache invalidation
- Components list on system detail page
- Create component dialog
- Component detail page with view/edit/delete"
```

---

### Task 9: Update Beads

**Step 1: Update epic description**

Run: `bd show haus-k53` to review current state, then update the epic to mark Components CRUD as complete.
