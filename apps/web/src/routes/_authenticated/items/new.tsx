import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { useState } from 'react'
import { ArrowLeft, Box } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { CreateItemSchema, ItemCategory, useCreateItem } from '@/features/items'
import { useProperty } from '@/features/properties'
import { useSpacesForProperty } from '@/features/spaces'

export const Route = createFileRoute('/_authenticated/items/new')({
  validateSearch: (search: Record<string, unknown>) => ({
    propertyId: search.propertyId as string | undefined,
    parentId: search.parentId as string | undefined,
    spaceId: search.spaceId as string | undefined,
  }),
  component: NewItemPage,
})

function NewItemPage() {
  const { user } = Route.useRouteContext()
  const { propertyId, parentId, spaceId } = Route.useSearch()
  const navigate = useNavigate()
  const createItem = useCreateItem()

  const { data: property } = useProperty(propertyId ?? '', user?.id)
  const { data: spaces } = useSpacesForProperty(propertyId)

  const [name, setName] = useState('')
  const [category, setCategory] = useState('')
  const [selectedSpaceId, setSelectedSpaceId] = useState(spaceId || 'none')
  const [manufacturer, setManufacturer] = useState('')
  const [model, setModel] = useState('')
  const [serialNumber, setSerialNumber] = useState('')
  const [notes, setNotes] = useState('')
  const [errors, setErrors] = useState<Record<string, string>>({})

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    if (!propertyId) {
      toast.error('Property ID is required')
      return
    }

    const result = CreateItemSchema.safeParse({
      propertyId,
      parentId: parentId || undefined,
      spaceId: selectedSpaceId === 'none' ? undefined : selectedSpaceId,
      name,
      category,
      manufacturer: manufacturer || undefined,
      model: model || undefined,
      serialNumber: serialNumber || undefined,
      notes: notes || undefined,
    })

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
      const item = await createItem.mutateAsync({
        userId: user.id,
        input: result.data,
      })
      toast.success('Item created')
      navigate({ to: '/items/$itemId', params: { itemId: item.id } })
    } catch {
      toast.error('Failed to create item')
    }
  }

  if (!propertyId) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-10">
        <div className="rounded-xl border border-destructive/50 bg-destructive/5 p-8 text-center">
          <p className="text-destructive font-medium mb-4">Property ID is required</p>
          <Link to="/properties">
            <Button variant="outline" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Properties
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Link
        to="/properties/$propertyId"
        params={{ propertyId }}
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to {property?.name || 'Property'}
      </Link>

      <div className="rounded-xl border bg-card p-8">
        <div className="flex items-center gap-4 mb-8">
          <div className="rounded-lg bg-primary/10 p-3">
            <Box className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">New Item</h1>
            <p className="text-muted-foreground">
              Add an appliance, system, or equipment to track
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Kitchen Refrigerator, Main HVAC Unit"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={!!errors.name}
              className="h-11"
            />
            {errors.name && <p className="text-sm text-destructive">{errors.name}</p>}
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="category">Category *</Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger id="category" aria-invalid={!!errors.category}>
                  <SelectValue placeholder="Select a category" />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(ItemCategory).map(([key, value]) => (
                    <SelectItem key={value} value={value}>
                      {key.charAt(0) + key.slice(1).toLowerCase()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.category && <p className="text-sm text-destructive">{errors.category}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="space">Space</Label>
              <Select value={selectedSpaceId} onValueChange={setSelectedSpaceId}>
                <SelectTrigger id="space">
                  <SelectValue placeholder="Select a space (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">No space</SelectItem>
                  {spaces?.map((space) => (
                    <SelectItem key={space.id} value={space.id}>
                      {space.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="manufacturer">Manufacturer</Label>
              <Input
                id="manufacturer"
                placeholder="e.g., Samsung, Carrier"
                value={manufacturer}
                onChange={(e) => setManufacturer(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="model">Model</Label>
              <Input
                id="model"
                placeholder="e.g., RF28R7351SR"
                value={model}
                onChange={(e) => setModel(e.target.value)}
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="serialNumber">Serial Number</Label>
            <Input
              id="serialNumber"
              placeholder="e.g., ABC123456789"
              value={serialNumber}
              onChange={(e) => setSerialNumber(e.target.value)}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              placeholder="Any additional details..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate({ to: '/properties/$propertyId', params: { propertyId } })}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={createItem.isPending}>
              {createItem.isPending ? 'Creating...' : 'Create Item'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
