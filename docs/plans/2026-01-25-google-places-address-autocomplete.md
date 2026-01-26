# Google Places Address Autocomplete Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add Google Places autocomplete to property forms, storing structured address data with coordinates.

**Architecture:** Reusable `AddressInput` component using `use-places-autocomplete` hook. Schema migration adds structured address fields to Property model. Forms pass address data through existing create/update mutations.

**Tech Stack:** Google Places API, use-places-autocomplete, @googlemaps/js-api-loader, Prisma, Zod

---

### Task 1: Install Dependencies

**Files:**
- Modify: `apps/web/package.json`

**Step 1: Install Google Places packages**

Run:
```bash
cd /Users/don/code/hausdog/apps/web && bun add use-places-autocomplete @googlemaps/js-api-loader
```

**Step 2: Verify installation**

Run: `cd /Users/don/code/hausdog/apps/web && bun pm ls | grep -E "(use-places|googlemaps)"`
Expected: Both packages listed

**Step 3: Commit**

```bash
git add apps/web/package.json apps/web/bun.lock
git commit -m "chore: add Google Places autocomplete dependencies"
```

---

### Task 2: Update Prisma Schema

**Files:**
- Modify: `apps/web/prisma/schema.prisma:13-42`

**Step 1: Add new address fields to Property model**

Replace the `address` field (line 17) and add new fields after `lookupData` (line 28):

```prisma
model Property {
  id              String    @id @default(uuid())
  userId          String    @map("user_id") @db.Uuid
  name            String
  // Structured address fields (replaces old `address` field)
  streetAddress     String?   @map("street_address")
  city              String?
  state             String?
  postalCode        String?   @map("postal_code")
  country           String?
  county            String?
  neighborhood      String?
  latitude          Float?
  longitude         Float?
  timezone          String?
  plusCode          String?   @map("plus_code")
  googlePlaceId     String?   @map("google_place_id")
  formattedAddress  String?   @map("formatted_address")
  googlePlaceData   Json?     @map("google_place_data")
  // Other property fields
  yearBuilt       Int?      @map("year_built")
  squareFeet      Int?      @map("square_feet")
  lotSquareFeet   Int?      @map("lot_square_feet")
  bedrooms        Int?
  bathrooms       Decimal?  @db.Decimal(3, 1)
  stories         Int?
  propertyType    String?   @map("property_type")
  purchaseDate    DateTime? @map("purchase_date")
  purchasePrice   Decimal?  @map("purchase_price") @db.Decimal(12, 2)
  estimatedValue  Decimal?  @map("estimated_value") @db.Decimal(12, 2)
  lookupData      Json?     @map("lookup_data")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")
  createdById     String    @map("created_by_id") @db.Uuid
  updatedById     String    @map("updated_by_id") @db.Uuid
  ingestToken     String?   @unique @map("ingest_token")

  spaces        Space[]
  items         Item[]
  documents     Document[]
  conversations Conversation[]

  @@index([userId], map: "idx_properties_user_id")
  @@map("properties")
}
```

**Step 2: Generate migration**

Run:
```bash
cd /Users/don/code/hausdog/apps/web && bunx prisma migrate dev --name add_structured_address_fields
```

Expected: Migration created successfully

**Step 3: Generate Prisma client**

Run: `cd /Users/don/code/hausdog/apps/web && bunx prisma generate`
Expected: Prisma client generated

**Step 4: Commit**

```bash
git add apps/web/prisma/
git commit -m "feat: add structured address fields to Property schema"
```

---

### Task 3: Create AddressData Type

**Files:**
- Create: `apps/web/src/lib/address.ts`

**Step 1: Create shared address types**

```typescript
import { z } from 'zod'

export const addressDataSchema = z.object({
  streetAddress: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  postalCode: z.string().nullable(),
  country: z.string().nullable(),
  county: z.string().nullable(),
  neighborhood: z.string().nullable(),
  latitude: z.number().nullable(),
  longitude: z.number().nullable(),
  timezone: z.string().nullable(),
  plusCode: z.string().nullable(),
  googlePlaceId: z.string().nullable(),
  formattedAddress: z.string().nullable(),
  googlePlaceData: z.record(z.unknown()).nullable(),
})

export type AddressData = z.infer<typeof addressDataSchema>

export const emptyAddressData: AddressData = {
  streetAddress: null,
  city: null,
  state: null,
  postalCode: null,
  country: null,
  county: null,
  neighborhood: null,
  latitude: null,
  longitude: null,
  timezone: null,
  plusCode: null,
  googlePlaceId: null,
  formattedAddress: null,
  googlePlaceData: null,
}
```

**Step 2: Commit**

```bash
git add apps/web/src/lib/address.ts
git commit -m "feat: add AddressData type and schema"
```

---

### Task 4: Create AddressInput Component

**Files:**
- Create: `apps/web/src/components/ui/address-input.tsx`

**Step 1: Create the autocomplete component**

```tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader } from '@googlemaps/js-api-loader'
import usePlacesAutocomplete, { getDetails } from 'use-places-autocomplete'
import { cn } from '@/lib/utils'
import type { AddressData } from '@/lib/address'
import { emptyAddressData } from '@/lib/address'

interface AddressInputProps {
  value?: string
  onChange?: (data: AddressData) => void
  placeholder?: string
  disabled?: boolean
  className?: string
}

const GOOGLE_PLACES_API_KEY = import.meta.env.VITE_GOOGLE_PLACES_API_KEY

function parseAddressComponents(
  components: google.maps.GeocoderAddressComponent[]
): Partial<AddressData> {
  const result: Partial<AddressData> = {}

  for (const component of components) {
    const types = component.types

    if (types.includes('street_number')) {
      result.streetAddress = component.long_name
    } else if (types.includes('route')) {
      result.streetAddress = result.streetAddress
        ? `${result.streetAddress} ${component.long_name}`
        : component.long_name
    } else if (types.includes('subpremise')) {
      result.streetAddress = result.streetAddress
        ? `${result.streetAddress}, ${component.long_name}`
        : component.long_name
    } else if (types.includes('locality')) {
      result.city = component.long_name
    } else if (types.includes('administrative_area_level_1')) {
      result.state = component.short_name
    } else if (types.includes('administrative_area_level_2')) {
      result.county = component.long_name
    } else if (types.includes('postal_code')) {
      result.postalCode = component.long_name
    } else if (types.includes('country')) {
      result.country = component.short_name
    } else if (types.includes('neighborhood') || types.includes('sublocality')) {
      result.neighborhood = component.long_name
    }
  }

  return result
}

export function AddressInput({
  value,
  onChange,
  placeholder = 'Start typing an address...',
  disabled = false,
  className,
}: AddressInputProps) {
  const [isLoaded, setIsLoaded] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Load Google Maps API
  useEffect(() => {
    if (!GOOGLE_PLACES_API_KEY) {
      console.error('VITE_GOOGLE_PLACES_API_KEY is not set')
      return
    }

    const loader = new Loader({
      apiKey: GOOGLE_PLACES_API_KEY,
      version: 'weekly',
      libraries: ['places'],
    })

    loader.load().then(() => {
      setIsLoaded(true)
    })
  }, [])

  const {
    ready,
    value: inputValue,
    suggestions: { status, data },
    setValue,
    clearSuggestions,
  } = usePlacesAutocomplete({
    requestOptions: {
      types: ['address'],
    },
    debounce: 300,
    initOnMount: isLoaded,
  })

  // Sync external value
  useEffect(() => {
    if (value !== undefined && value !== inputValue) {
      setValue(value, false)
    }
  }, [value, setValue, inputValue])

  // Close suggestions on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setShowSuggestions(false)
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const handleSelect = async (placeId: string, description: string) => {
    setValue(description, false)
    clearSuggestions()
    setShowSuggestions(false)

    if (!onChange) return

    try {
      const details = await getDetails({
        placeId,
        fields: [
          'address_components',
          'formatted_address',
          'geometry',
          'place_id',
          'plus_code',
          'utc_offset_minutes',
        ],
      })

      if (!details || typeof details === 'string') {
        onChange({ ...emptyAddressData, formattedAddress: description })
        return
      }

      const addressComponents = parseAddressComponents(
        details.address_components || []
      )

      // Calculate timezone from UTC offset
      let timezone: string | null = null
      if (details.utc_offset_minutes !== undefined) {
        const hours = Math.floor(Math.abs(details.utc_offset_minutes) / 60)
        const mins = Math.abs(details.utc_offset_minutes) % 60
        const sign = details.utc_offset_minutes >= 0 ? '+' : '-'
        timezone = `UTC${sign}${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}`
      }

      const addressData: AddressData = {
        streetAddress: addressComponents.streetAddress ?? null,
        city: addressComponents.city ?? null,
        state: addressComponents.state ?? null,
        postalCode: addressComponents.postalCode ?? null,
        country: addressComponents.country ?? null,
        county: addressComponents.county ?? null,
        neighborhood: addressComponents.neighborhood ?? null,
        latitude: details.geometry?.location?.lat() ?? null,
        longitude: details.geometry?.location?.lng() ?? null,
        timezone,
        plusCode: details.plus_code?.global_code ?? null,
        googlePlaceId: details.place_id ?? null,
        formattedAddress: details.formatted_address ?? description,
        googlePlaceData: details as unknown as Record<string, unknown>,
      }

      onChange(addressData)
    } catch (error) {
      console.error('Error fetching place details:', error)
      onChange({ ...emptyAddressData, formattedAddress: description })
    }
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value)
    setShowSuggestions(true)
  }

  return (
    <div ref={containerRef} className="relative">
      <input
        type="text"
        value={inputValue}
        onChange={handleInputChange}
        onFocus={() => setShowSuggestions(true)}
        disabled={disabled || !ready}
        placeholder={!isLoaded ? 'Loading...' : placeholder}
        className={cn(
          'file:text-foreground placeholder:text-muted-foreground selection:bg-primary selection:text-primary-foreground dark:bg-input/30 border-input h-9 w-full min-w-0 rounded-md border bg-transparent px-3 py-1 text-base shadow-xs transition-[color,box-shadow] outline-none file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
          'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]',
          'aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive',
          className
        )}
      />

      {showSuggestions && status === 'OK' && data.length > 0 && (
        <ul className="absolute z-50 mt-1 w-full rounded-md border bg-popover p-1 shadow-md">
          {data.map((suggestion) => (
            <li
              key={suggestion.place_id}
              onClick={() => handleSelect(suggestion.place_id, suggestion.description)}
              className="cursor-pointer rounded-sm px-2 py-1.5 text-sm hover:bg-accent hover:text-accent-foreground"
            >
              {suggestion.description}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
```

**Step 2: Commit**

```bash
git add apps/web/src/components/ui/address-input.tsx
git commit -m "feat: add AddressInput component with Google Places autocomplete"
```

---

### Task 5: Update Property Types

**Files:**
- Modify: `apps/web/src/features/properties/types.ts`

**Step 1: Add address fields to types**

```typescript
import type { Prisma } from '@generated/prisma/client'
import { z } from 'zod'

export const CreatePropertySchema = z.object({
  name: z.string().min(1, 'Name is required'),
  // Address fields
  streetAddress: z.string().nullish(),
  city: z.string().nullish(),
  state: z.string().nullish(),
  postalCode: z.string().nullish(),
  country: z.string().nullish(),
  county: z.string().nullish(),
  neighborhood: z.string().nullish(),
  latitude: z.number().nullish(),
  longitude: z.number().nullish(),
  timezone: z.string().nullish(),
  plusCode: z.string().nullish(),
  googlePlaceId: z.string().nullish(),
  formattedAddress: z.string().nullish(),
  googlePlaceData: z.record(z.unknown()).nullish(),
  // Other fields
  yearBuilt: z.number().int().min(1800).max(2100).optional(),
  squareFeet: z.number().int().positive().optional(),
  lotSquareFeet: z.number().int().positive().optional(),
  bedrooms: z.number().int().min(0).optional(),
  bathrooms: z.number().min(0).optional(),
  stories: z.number().int().min(1).optional(),
  propertyType: z.string().optional(),
  purchaseDate: z.date().optional(),
  purchasePrice: z.number().positive().optional(),
  estimatedValue: z.number().positive().optional(),
  lookupData: z.unknown().optional(),
})

export const UpdatePropertySchema = CreatePropertySchema.partial()

export type CreatePropertyInput = z.infer<typeof CreatePropertySchema>
export type UpdatePropertyInput = z.infer<typeof UpdatePropertySchema>

export interface Property {
  id: string
  userId: string
  name: string
  // Address fields
  streetAddress: string | null
  city: string | null
  state: string | null
  postalCode: string | null
  country: string | null
  county: string | null
  neighborhood: string | null
  latitude: number | null
  longitude: number | null
  timezone: string | null
  plusCode: string | null
  googlePlaceId: string | null
  formattedAddress: string | null
  googlePlaceData: Prisma.JsonValue | null
  // Other fields
  yearBuilt: number | null
  squareFeet: number | null
  lotSquareFeet: number | null
  bedrooms: number | null
  bathrooms: number | null
  stories: number | null
  propertyType: string | null
  purchaseDate: Date | null
  purchasePrice: number | null
  estimatedValue: number | null
  lookupData: Prisma.JsonValue | null
  ingestToken: string | null
  createdAt: Date
  updatedAt: Date
}

export interface PropertyWithCounts extends Property {
  _count: {
    items: number
    spaces: number
  }
}
```

**Step 2: Commit**

```bash
git add apps/web/src/features/properties/types.ts
git commit -m "feat: add address fields to Property types"
```

---

### Task 6: Update Property Service

**Files:**
- Modify: `apps/web/src/features/properties/service.ts`

**Step 1: Update create method to handle address fields**

Update the `create` method (around line 60-88) to include all address fields:

```typescript
async create(userId: string, input: CreatePropertyInput): Promise<Property> {
  this.logger.info('Creating property', { userId, name: input.name })

  // Generate ingest token from formatted address or name
  const ingestToken = generateIngestToken(input.formattedAddress ?? null, input.name)

  const record = await this.db.property.create({
    data: {
      userId,
      name: input.name,
      // Address fields
      streetAddress: input.streetAddress ?? null,
      city: input.city ?? null,
      state: input.state ?? null,
      postalCode: input.postalCode ?? null,
      country: input.country ?? null,
      county: input.county ?? null,
      neighborhood: input.neighborhood ?? null,
      latitude: input.latitude ?? null,
      longitude: input.longitude ?? null,
      timezone: input.timezone ?? null,
      plusCode: input.plusCode ?? null,
      googlePlaceId: input.googlePlaceId ?? null,
      formattedAddress: input.formattedAddress ?? null,
      googlePlaceData: (input.googlePlaceData as Prisma.InputJsonValue) ?? Prisma.DbNull,
      // Other fields
      yearBuilt: input.yearBuilt ?? null,
      squareFeet: input.squareFeet ?? null,
      lotSquareFeet: input.lotSquareFeet ?? null,
      bedrooms: input.bedrooms ?? null,
      bathrooms: input.bathrooms ?? null,
      stories: input.stories ?? null,
      propertyType: input.propertyType ?? null,
      purchaseDate: input.purchaseDate ?? null,
      purchasePrice: input.purchasePrice ?? null,
      estimatedValue: input.estimatedValue ?? null,
      lookupData: (input.lookupData as Prisma.InputJsonValue) ?? Prisma.DbNull,
      ingestToken,
      createdById: userId,
      updatedById: userId,
    },
  })
  return this.toDomain(record)
}
```

**Step 2: Update update method to handle address fields**

Update the `update` method (around line 90-114):

```typescript
async update(id: string, userId: string, input: UpdatePropertyInput): Promise<Property> {
  this.logger.info('Updating property', { id, userId })
  const record = await this.db.property.update({
    where: { id },
    data: {
      ...(input.name !== undefined && { name: input.name }),
      // Address fields
      ...(input.streetAddress !== undefined && { streetAddress: input.streetAddress ?? null }),
      ...(input.city !== undefined && { city: input.city ?? null }),
      ...(input.state !== undefined && { state: input.state ?? null }),
      ...(input.postalCode !== undefined && { postalCode: input.postalCode ?? null }),
      ...(input.country !== undefined && { country: input.country ?? null }),
      ...(input.county !== undefined && { county: input.county ?? null }),
      ...(input.neighborhood !== undefined && { neighborhood: input.neighborhood ?? null }),
      ...(input.latitude !== undefined && { latitude: input.latitude ?? null }),
      ...(input.longitude !== undefined && { longitude: input.longitude ?? null }),
      ...(input.timezone !== undefined && { timezone: input.timezone ?? null }),
      ...(input.plusCode !== undefined && { plusCode: input.plusCode ?? null }),
      ...(input.googlePlaceId !== undefined && { googlePlaceId: input.googlePlaceId ?? null }),
      ...(input.formattedAddress !== undefined && { formattedAddress: input.formattedAddress ?? null }),
      ...(input.googlePlaceData !== undefined && {
        googlePlaceData: (input.googlePlaceData as Prisma.InputJsonValue) ?? Prisma.DbNull,
      }),
      // Other fields
      ...(input.yearBuilt !== undefined && { yearBuilt: input.yearBuilt ?? null }),
      ...(input.squareFeet !== undefined && { squareFeet: input.squareFeet ?? null }),
      ...(input.lotSquareFeet !== undefined && { lotSquareFeet: input.lotSquareFeet ?? null }),
      ...(input.bedrooms !== undefined && { bedrooms: input.bedrooms ?? null }),
      ...(input.bathrooms !== undefined && { bathrooms: input.bathrooms ?? null }),
      ...(input.stories !== undefined && { stories: input.stories ?? null }),
      ...(input.propertyType !== undefined && { propertyType: input.propertyType ?? null }),
      ...(input.purchaseDate !== undefined && { purchaseDate: input.purchaseDate ?? null }),
      ...(input.purchasePrice !== undefined && { purchasePrice: input.purchasePrice ?? null }),
      ...(input.estimatedValue !== undefined && { estimatedValue: input.estimatedValue ?? null }),
      ...(input.lookupData !== undefined && {
        lookupData: (input.lookupData as Prisma.InputJsonValue) ?? Prisma.DbNull,
      }),
      updatedById: userId,
    },
  })
  return this.toDomain(record)
}
```

**Step 3: Update toDomain method**

Update the `toDomain` method (around line 131-152):

```typescript
private toDomain(record: PrismaProperty): Property {
  return {
    id: record.id,
    userId: record.userId,
    name: record.name,
    // Address fields
    streetAddress: record.streetAddress,
    city: record.city,
    state: record.state,
    postalCode: record.postalCode,
    country: record.country,
    county: record.county,
    neighborhood: record.neighborhood,
    latitude: record.latitude,
    longitude: record.longitude,
    timezone: record.timezone,
    plusCode: record.plusCode,
    googlePlaceId: record.googlePlaceId,
    formattedAddress: record.formattedAddress,
    googlePlaceData: record.googlePlaceData,
    // Other fields
    yearBuilt: record.yearBuilt,
    squareFeet: record.squareFeet,
    lotSquareFeet: record.lotSquareFeet,
    bedrooms: record.bedrooms,
    bathrooms: record.bathrooms ? Number(record.bathrooms) : null,
    stories: record.stories,
    propertyType: record.propertyType,
    purchaseDate: record.purchaseDate,
    purchasePrice: record.purchasePrice ? Number(record.purchasePrice) : null,
    estimatedValue: record.estimatedValue ? Number(record.estimatedValue) : null,
    lookupData: record.lookupData,
    ingestToken: record.ingestToken,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  }
}
```

**Step 4: Commit**

```bash
git add apps/web/src/features/properties/service.ts
git commit -m "feat: update PropertyService to handle address fields"
```

---

### Task 7: Update New Property Form

**Files:**
- Modify: `apps/web/src/routes/_authenticated/properties/new.tsx`

**Step 1: Replace Textarea with AddressInput**

Update imports and state:

```tsx
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
```

**Step 2: Commit**

```bash
git add apps/web/src/routes/_authenticated/properties/new.tsx
git commit -m "feat: use AddressInput in new property form"
```

---

### Task 8: Update Property Detail/Edit Page

**Files:**
- Modify: `apps/web/src/routes/_authenticated/properties/$propertyId/index.tsx`

**Step 1: Update imports and edit state**

Add AddressInput import and update state management for editing:

```tsx
// Add to imports at top
import { AddressInput } from '@/components/ui/address-input'
import type { AddressData } from '@/lib/address'

// In the component, update state declarations (around line 69-71):
const [name, setName] = useState('')
const [addressData, setAddressData] = useState<AddressData | null>(null)
const [errors, setErrors] = useState<Record<string, string>>({})

// Update useEffect (around line 73-78):
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
```

**Step 2: Update handleSave**

```tsx
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
```

**Step 3: Update handleCancel**

```tsx
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
```

**Step 4: Update handleLookup to use formattedAddress**

```tsx
const handleLookup = async () => {
  if (!property?.formattedAddress) {
    toast.error('Please add an address first')
    return
  }

  setIsLookingUp(true)
  const toastId = toast.loading('Looking up property data...')
  try {
    const result = await lookupPropertyData({ data: { address: property.formattedAddress } })
    // ... rest stays the same
  }
  // ...
}
```

**Step 5: Update edit form UI (around line 253-262)**

Replace the address Textarea with AddressInput:

```tsx
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
```

**Step 6: Update display to use formattedAddress (around line 279-284)**

```tsx
{property.formattedAddress && (
  <p className="text-muted-foreground mt-1 flex items-center gap-1.5">
    <MapPin className="h-4 w-4" />
    {property.formattedAddress}
  </p>
)}
```

**Step 7: Commit**

```bash
git add apps/web/src/routes/_authenticated/properties/\$propertyId/index.tsx
git commit -m "feat: use AddressInput in property edit form"
```

---

### Task 9: Expose API Key to Client

**Files:**
- Modify: `apps/web/vite.config.ts`

**Step 1: Update env prefix (already includes VITE_)**

The config already has `envPrefix: ['VITE_', 'SUPABASE_']`, so we just need to ensure Doppler passes it through.

**Step 2: Update Doppler to expose as VITE_ variable**

Run:
```bash
doppler secrets set VITE_GOOGLE_PLACES_API_KEY='$(doppler secrets get GOOGLE_PLACES_API_KEY --plain)' --project web --config dev
```

Or manually in Doppler, add `VITE_GOOGLE_PLACES_API_KEY` with the same value as `GOOGLE_PLACES_API_KEY`.

Actually, simpler - just rename the existing key:

```bash
doppler secrets set VITE_GOOGLE_PLACES_API_KEY=AIzaSyDnwQW0eIDurFNeGJS6m2vqf66DqPWaAPg --project web --config dev
doppler secrets set VITE_GOOGLE_PLACES_API_KEY=AIzaSyDnwQW0eIDurFNeGJS6m2vqf66DqPWaAPg --project web --config stg
doppler secrets set VITE_GOOGLE_PLACES_API_KEY=AIzaSyDnwQW0eIDurFNeGJS6m2vqf66DqPWaAPg --project web --config prd
```

**Step 3: Commit (no code changes needed)**

No commit needed - this is config only.

---

### Task 10: Test End-to-End

**Step 1: Start dev server**

Run:
```bash
cd /Users/don/code/hausdog && make dev
```

**Step 2: Manual testing checklist**

- [ ] Navigate to /properties/new
- [ ] Type an address in the AddressInput field
- [ ] Verify Google suggestions appear
- [ ] Select an address
- [ ] Submit the form
- [ ] Verify property is created with all address fields populated
- [ ] View the property detail page
- [ ] Verify address displays correctly
- [ ] Click Edit
- [ ] Verify AddressInput shows current address
- [ ] Change address
- [ ] Save and verify it updates

**Step 3: Final commit**

```bash
git add -A
git commit -m "feat: complete Google Places address autocomplete integration"
```

---

## Summary

This plan adds Google Places autocomplete to Hausdog property forms:

1. **Dependencies**: use-places-autocomplete, @googlemaps/js-api-loader
2. **Schema**: 14 new address fields on Property model
3. **Component**: Reusable AddressInput with dropdown suggestions
4. **Integration**: Updated new/edit property forms
5. **Config**: API key exposed via VITE_ env var

Total tasks: 10
