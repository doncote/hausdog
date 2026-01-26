import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import { ArrowLeft, Building2, Loader2 } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { AddressInput } from '@/components/ui/address-input'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import type { AddressData } from '@/lib/address'
import { CreatePropertySchema, lookupPropertyData, useCreateProperty } from '@/features/properties'

export const Route = createFileRoute('/_authenticated/properties/new')({
  component: NewPropertyPage,
})

function NewPropertyPage() {
  const { user } = Route.useRouteContext()
  const navigate = useNavigate()
  const createProperty = useCreateProperty()

  const [name, setName] = useState('')
  const [addressData, setAddressData] = useState<AddressData | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isLookingUp, setIsLookingUp] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setErrors({})

    const result = CreatePropertySchema.safeParse({
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
      let inputData = result.data

      // Look up property data if address provided
      if (addressData?.formattedAddress?.trim()) {
        setIsLookingUp(true)
        const toastId = toast.loading('Looking up property data...')
        try {
          const lookupResult = await lookupPropertyData({
            data: { address: addressData.formattedAddress.trim() },
          })
          toast.dismiss(toastId)
          if (lookupResult.result.found) {
            inputData = {
              ...inputData,
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
            toast.success('Property details found and applied')
          } else {
            toast.info("Couldn't find property data for this address")
          }
        } catch {
          toast.dismiss(toastId)
          toast.info("Couldn't look up property data")
        } finally {
          setIsLookingUp(false)
        }
      }

      const property = await createProperty.mutateAsync({
        userId: user.id,
        input: inputData,
      })
      toast.success('Property created')
      navigate({ to: '/properties/$propertyId', params: { propertyId: property.id } })
    } catch {
      toast.error('Failed to create property')
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Link
        to="/properties"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Properties
      </Link>

      <div className="rounded-xl border bg-card p-8">
        <div className="flex items-center gap-4 mb-8">
          <div className="rounded-lg bg-primary/10 p-3">
            <Building2 className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">New Property</h1>
            <p className="text-muted-foreground">
              Add a home or property to track its items and documentation
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="space-y-2">
            <Label htmlFor="name">Name *</Label>
            <Input
              id="name"
              placeholder="e.g., Main House, Beach Cottage"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={!!errors.name}
              className="h-11"
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

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="outline" onClick={() => navigate({ to: '/properties' })}>
              Cancel
            </Button>
            <Button type="submit" disabled={createProperty.isPending || isLookingUp}>
              {isLookingUp ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Looking up property...
                </>
              ) : createProperty.isPending ? (
                'Creating...'
              ) : (
                'Create Property'
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
