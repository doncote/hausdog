import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import {
  ArrowLeft,
  Box,
  ChevronRight,
  Copy,
  DoorOpen,
  Loader2,
  Mail,
  MapPin,
  MoreVertical,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import { toast } from 'sonner'
import { AddressInput } from '@/components/ui/address-input'
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
import { type ItemWithRelations, useRootItemsForProperty } from '@/features/items'
import {
  lookupPropertyData,
  type PropertyLookupResponse,
  UpdatePropertySchema,
  useDeleteProperty,
  useProperty,
  useUpdateProperty,
} from '@/features/properties'
import { useSpacesForProperty } from '@/features/spaces'
import type { AddressData } from '@/lib/address'

export const Route = createFileRoute('/_authenticated/properties/$propertyId/')({
  component: PropertyDetailPage,
})

function PropertyDetailPage() {
  const { propertyId } = Route.useParams()
  const { user } = Route.useRouteContext()
  const navigate = useNavigate()

  const { data: property, isPending, error } = useProperty(propertyId, user?.id)
  const { data: items, isPending: itemsPending } = useRootItemsForProperty(propertyId)
  const { data: spaces, isPending: spacesPending } = useSpacesForProperty(propertyId)
  const updateProperty = useUpdateProperty()
  const deleteProperty = useDeleteProperty()

  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [showLookupDialog, setShowLookupDialog] = useState(false)
  const [isLookingUp, setIsLookingUp] = useState(false)
  const [lookupResult, setLookupResult] = useState<PropertyLookupResponse | null>(null)
  const [name, setName] = useState('')
  const [addressData, setAddressData] = useState<AddressData | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})

  useEffect(() => {
    if (property) {
      setName(property.name)
      setAddressData({
        streetAddress: property.streetAddress,
        city: property.city,
        state: property.state,
        postalCode: property.postalCode,
        country: property.country,
        county: property.county,
        neighborhood: property.neighborhood,
        latitude: property.latitude,
        longitude: property.longitude,
        timezone: property.timezone,
        plusCode: property.plusCode,
        googlePlaceId: property.googlePlaceId,
        formattedAddress: property.formattedAddress,
        googlePlaceData: property.googlePlaceData as Record<string, unknown> | null,
      })
    }
  }, [property])

  const handleSave = async () => {
    setErrors({})

    const result = UpdatePropertySchema.safeParse({
      name,
      ...addressData,
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
      setAddressData({
        streetAddress: property.streetAddress,
        city: property.city,
        state: property.state,
        postalCode: property.postalCode,
        country: property.country,
        county: property.county,
        neighborhood: property.neighborhood,
        latitude: property.latitude,
        longitude: property.longitude,
        timezone: property.timezone,
        plusCode: property.plusCode,
        googlePlaceId: property.googlePlaceId,
        formattedAddress: property.formattedAddress,
        googlePlaceData: property.googlePlaceData as Record<string, unknown> | null,
      })
    }
    setErrors({})
    setIsEditing(false)
  }

  const handleLookup = async () => {
    if (!property?.formattedAddress) {
      toast.error('Please add an address first')
      return
    }

    setIsLookingUp(true)
    const toastId = toast.loading('Looking up property data...')
    try {
      const result = await lookupPropertyData({ data: { address: property.formattedAddress } })
      toast.dismiss(toastId)
      if (result.result.found) {
        setLookupResult(result)
        setShowLookupDialog(true)
      } else {
        toast.info("Couldn't find property data for this address")
      }
    } catch {
      toast.dismiss(toastId)
      toast.error('Failed to look up property data')
    } finally {
      setIsLookingUp(false)
    }
  }

  const handleApplyLookup = async () => {
    if (!lookupResult || !user) return

    const input = {
      yearBuilt: lookupResult.result.yearBuilt ?? undefined,
      squareFeet: lookupResult.result.squareFeet ?? undefined,
      lotSquareFeet: lookupResult.result.lotSquareFeet ?? undefined,
      bedrooms: lookupResult.result.bedrooms ?? undefined,
      bathrooms: lookupResult.result.bathrooms ?? undefined,
      stories: lookupResult.result.stories ?? undefined,
      propertyType: lookupResult.result.propertyType ?? undefined,
      purchaseDate: lookupResult.result.lastSaleDate
        ? new Date(lookupResult.result.lastSaleDate)
        : undefined,
      purchasePrice: lookupResult.result.lastSalePrice ?? undefined,
      estimatedValue: lookupResult.result.estimatedValue ?? undefined,
      lookupData: lookupResult.raw,
    }
    console.log('Applying lookup data:', input)

    try {
      const result = await updateProperty.mutateAsync({
        id: propertyId,
        userId: user.id,
        input,
      })
      console.log('Update result:', result)
      toast.success('Property details updated')
      setShowLookupDialog(false)
      setLookupResult(null)
    } catch (error) {
      console.error('Update failed:', error)
      toast.error('Failed to update property')
    }
  }

  if (isPending) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="h-5 w-24 bg-muted animate-pulse rounded mb-8" />
        <div className="rounded-xl border bg-card p-6 mb-8">
          <div className="h-8 w-48 bg-muted animate-pulse rounded mb-3" />
          <div className="h-4 w-64 bg-muted animate-pulse rounded" />
        </div>
      </div>
    )
  }

  if (error || !property) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="rounded-xl border border-destructive/50 bg-destructive/5 p-8 text-center">
          <p className="text-destructive font-medium mb-4">Property not found</p>
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
    <div className="mx-auto max-w-6xl px-6 py-10">
      <nav className="flex items-center gap-2 text-sm mb-8">
        <Link
          to="/properties"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          Properties
        </Link>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">{property.name}</span>
      </nav>

      <div className="rounded-xl border bg-card p-6 mb-8">
        {isEditing ? (
          <div className="space-y-6">
            <h2 className="text-lg font-semibold">Edit Property</h2>
            <div className="space-y-4">
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
                <AddressInput
                  value={addressData?.formattedAddress ?? ''}
                  onChange={setAddressData}
                  placeholder="Start typing an address..."
                />
                {errors.formattedAddress && (
                  <p className="text-sm text-destructive">{errors.formattedAddress}</p>
                )}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button variant="outline" onClick={handleCancel}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={updateProperty.isPending}>
                {updateProperty.isPending ? 'Saving...' : 'Save Changes'}
              </Button>
            </div>
          </div>
        ) : (
          <>
            <div className="flex items-start justify-between mb-6">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{property.name}</h1>
                {property.formattedAddress && (
                  <p className="text-muted-foreground mt-1 flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" />
                    {property.formattedAddress}
                  </p>
                )}
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
                  <DropdownMenuItem
                    onClick={handleLookup}
                    disabled={isLookingUp || !property.formattedAddress}
                    className="gap-2"
                  >
                    {isLookingUp ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    {isLookingUp ? 'Looking up...' : 'Lookup Property Info'}
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

            {/* Property Details Grid */}
            {(property.yearBuilt ||
              property.squareFeet ||
              property.bedrooms ||
              property.bathrooms ||
              property.lotSquareFeet ||
              property.stories ||
              property.propertyType ||
              property.purchaseDate ||
              property.purchasePrice ||
              property.estimatedValue) && (
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4 pt-4 border-t">
                {property.yearBuilt && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                      Year Built
                    </p>
                    <p className="font-medium">{property.yearBuilt}</p>
                  </div>
                )}
                {property.squareFeet && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Sq Ft</p>
                    <p className="font-medium">{property.squareFeet.toLocaleString()}</p>
                  </div>
                )}
                {property.lotSquareFeet && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                      Lot Size
                    </p>
                    <p className="font-medium">{property.lotSquareFeet.toLocaleString()} sq ft</p>
                  </div>
                )}
                {property.bedrooms && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                      Bedrooms
                    </p>
                    <p className="font-medium">{property.bedrooms}</p>
                  </div>
                )}
                {property.bathrooms && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                      Bathrooms
                    </p>
                    <p className="font-medium">{property.bathrooms}</p>
                  </div>
                )}
                {property.stories && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Stories</p>
                    <p className="font-medium">{property.stories}</p>
                  </div>
                )}
                {property.propertyType && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">Type</p>
                    <p className="font-medium capitalize">
                      {property.propertyType.replace('_', ' ')}
                    </p>
                  </div>
                )}
                {property.purchaseDate && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                      Acquired
                    </p>
                    <p className="font-medium">
                      {new Date(property.purchaseDate).toLocaleDateString()}
                    </p>
                  </div>
                )}
                {property.purchasePrice && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                      Purchase Price
                    </p>
                    <p className="font-medium">${property.purchasePrice.toLocaleString()}</p>
                  </div>
                )}
                {property.estimatedValue && (
                  <div>
                    <p className="text-xs text-muted-foreground uppercase tracking-wide">
                      Est. Value
                    </p>
                    <p className="font-medium">${property.estimatedValue.toLocaleString()}</p>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* Email Ingestion Section */}
      {property.ingestToken && (
        <div className="rounded-xl border bg-card p-6 mb-8">
          <div className="flex items-center gap-3 mb-4">
            <div className="rounded-lg bg-primary/10 p-2">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Email Ingestion</h2>
              <p className="text-sm text-muted-foreground">
                Forward receipts and documents to automatically add them
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded-lg bg-muted px-4 py-2.5 text-sm font-mono truncate">
              {property.ingestToken}@ingest.hausdog.app
            </code>
            <Button
              variant="outline"
              size="icon"
              onClick={() => {
                navigator.clipboard.writeText(`${property.ingestToken}@ingest.hausdog.app`)
                toast.success('Email address copied')
              }}
            >
              <Copy className="h-4 w-4" />
            </Button>
          </div>
        </div>
      )}

      {/* Spaces Section */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold">Spaces</h2>
            <p className="text-sm text-muted-foreground">Rooms and areas in your property</p>
          </div>
          <Link to="/properties/$propertyId/spaces" params={{ propertyId }}>
            <Button variant="outline" className="gap-2">
              <DoorOpen className="h-4 w-4" />
              Manage Spaces
            </Button>
          </Link>
        </div>

        {spacesPending ? (
          <div className="flex gap-3 overflow-x-auto pb-2">
            <div className="h-16 w-32 bg-muted animate-pulse rounded-xl shrink-0" />
            <div className="h-16 w-32 bg-muted animate-pulse rounded-xl shrink-0" />
          </div>
        ) : spaces && spaces.length > 0 ? (
          <div className="flex gap-3 overflow-x-auto pb-2">
            {spaces.map((space) => (
              <Link
                key={space.id}
                to="/properties/$propertyId/spaces/$spaceId"
                params={{ propertyId, spaceId: space.id }}
                className="shrink-0"
              >
                <div className="rounded-xl border bg-card px-4 py-3 hover:shadow-md hover:border-primary/30 transition-all">
                  <div className="flex items-center gap-2">
                    <DoorOpen className="h-4 w-4 text-muted-foreground" />
                    <span className="font-medium">{space.name}</span>
                  </div>
                </div>
              </Link>
            ))}
            <Link to="/properties/$propertyId/spaces" params={{ propertyId }} className="shrink-0">
              <div className="rounded-xl border-2 border-dashed px-4 py-3 hover:border-primary/50 transition-all flex items-center gap-2 text-muted-foreground hover:text-foreground">
                <Plus className="h-4 w-4" />
                <span>Add Space</span>
              </div>
            </Link>
          </div>
        ) : (
          <Link to="/properties/$propertyId/spaces" params={{ propertyId }}>
            <div className="rounded-xl border-2 border-dashed bg-muted/30 p-6 text-center hover:border-primary/50 transition-all cursor-pointer">
              <p className="text-muted-foreground">
                No spaces yet. <span className="text-primary hover:underline">Add spaces</span> to
                organize your items by room.
              </p>
            </div>
          </Link>
        )}
      </div>

      {/* Items Section */}
      <div>
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-lg font-semibold">Items</h2>
            <p className="text-sm text-muted-foreground">
              Track appliances, systems, and equipment
            </p>
          </div>
          <div className="flex gap-2">
            <Link to="/properties/$propertyId/items" params={{ propertyId }}>
              <Button variant="outline" className="gap-2">
                View All
              </Button>
            </Link>
            <Link to="/items/new" search={{ propertyId, parentId: undefined, spaceId: undefined }}>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Item
              </Button>
            </Link>
          </div>
        </div>

        {itemsPending ? (
          <div className="space-y-3">
            <div className="h-20 w-full bg-muted animate-pulse rounded-xl" />
            <div className="h-20 w-full bg-muted animate-pulse rounded-xl" />
          </div>
        ) : items && items.length > 0 ? (
          <div className="space-y-3">
            {items.map((item) => (
              <ItemCard key={item.id} item={item} />
            ))}
          </div>
        ) : (
          <div className="rounded-xl border-2 border-dashed bg-muted/30 p-12 text-center">
            <div className="mx-auto w-fit rounded-full bg-primary/10 p-4 mb-4">
              <Box className="h-8 w-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">No items yet</h3>
            <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
              Add items like appliances, HVAC systems, or furniture to track their details
            </p>
            <Link to="/items/new" search={{ propertyId, parentId: undefined, spaceId: undefined }}>
              <Button className="gap-2">
                <Plus className="h-4 w-4" />
                Add Your First Item
              </Button>
            </Link>
          </div>
        )}
      </div>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Property</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{property.name}"? This will also delete all
              associated items and documents. This action cannot be undone.
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

      <Dialog open={showLookupDialog} onOpenChange={setShowLookupDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Property Data Found</DialogTitle>
            <DialogDescription>
              We found the following information for this property. Apply to update your property
              details.
            </DialogDescription>
          </DialogHeader>
          {lookupResult && (
            <div className="space-y-3 py-4">
              {lookupResult.result.yearBuilt && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Year Built</span>
                  <span className="font-medium">{lookupResult.result.yearBuilt}</span>
                </div>
              )}
              {lookupResult.result.squareFeet && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Square Feet</span>
                  <span className="font-medium">
                    {lookupResult.result.squareFeet.toLocaleString()}
                  </span>
                </div>
              )}
              {lookupResult.result.bedrooms && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Bedrooms</span>
                  <span className="font-medium">{lookupResult.result.bedrooms}</span>
                </div>
              )}
              {lookupResult.result.bathrooms && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Bathrooms</span>
                  <span className="font-medium">{lookupResult.result.bathrooms}</span>
                </div>
              )}
              {lookupResult.result.propertyType && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Property Type</span>
                  <span className="font-medium capitalize">
                    {lookupResult.result.propertyType.replace('_', ' ')}
                  </span>
                </div>
              )}
              {lookupResult.result.lotSquareFeet && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Lot Size</span>
                  <span className="font-medium">
                    {lookupResult.result.lotSquareFeet.toLocaleString()} sq ft
                  </span>
                </div>
              )}
              {lookupResult.result.lastSaleDate && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Last Sale Date</span>
                  <span className="font-medium">{lookupResult.result.lastSaleDate}</span>
                </div>
              )}
              {lookupResult.result.lastSalePrice && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Last Sale Price</span>
                  <span className="font-medium">
                    ${lookupResult.result.lastSalePrice.toLocaleString()}
                  </span>
                </div>
              )}
              {lookupResult.result.estimatedValue && (
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Estimated Value</span>
                  <span className="font-medium">
                    ${lookupResult.result.estimatedValue.toLocaleString()}
                  </span>
                </div>
              )}
              {lookupResult.groundingSources.length > 0 && (
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">Data from Google Search</p>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowLookupDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleApplyLookup} disabled={updateProperty.isPending}>
              {updateProperty.isPending ? 'Applying...' : 'Apply'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function ItemCard({ item }: { item: ItemWithRelations }) {
  return (
    <Link to="/items/$itemId" params={{ itemId: item.id }} className="group block">
      <div className="rounded-xl border bg-card p-4 transition-all hover:shadow-md hover:border-primary/30">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-lg bg-secondary p-2.5">
              <Box className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h3 className="font-medium group-hover:text-primary transition-colors">
                {item.name}
              </h3>
              <p className="text-sm text-muted-foreground">
                {item.category}
                {item.manufacturer && ` · ${item.manufacturer}`}
                {item.model && ` ${item.model}`}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {item._count && (
              <span className="hidden sm:inline">
                {item._count.children > 0 && `${item._count.children} sub-items`}
              </span>
            )}
            <ChevronRight className="h-5 w-5" />
          </div>
        </div>
      </div>
    </Link>
  )
}
