# App Architecture & Conventions

This document defines the architecture, patterns, and conventions for this application. Follow these guidelines when developing features or generating code.

## Tech Stack

- **Framework**: TanStack Start (file-based routing)
- **Data Fetching**: TanStack React Query
- **UI Components**: shadcn/ui + Radix primitives
- **Styling**: Tailwind CSS
- **Database**: Prisma + PostgreSQL (via Supabase)
- **Auth**: Supabase Auth

---

## File Structure

```
src/
├── routes/                     # File-based routing (TanStack Start)
│   ├── __root.tsx
│   ├── index.tsx
│   ├── properties/
│   │   ├── index.tsx
│   │   ├── new.tsx
│   │   └── $propertyId.tsx
│   └── systems/
│       └── ...
│
├── features/                   # Feature modules
│   ├── properties/
│   │   ├── api.ts              # Server functions
│   │   ├── queries.ts          # queryOptions factories
│   │   ├── mutations.ts        # useMutation hooks
│   │   ├── schema.ts           # Zod schemas + types
│   │   ├── service.ts          # Business logic
│   │   ├── components/
│   │   │   ├── PropertyList.tsx
│   │   │   ├── PropertyCard.tsx
│   │   │   └── PropertyForm.tsx
│   │   └── index.ts            # Public exports
│   │
│   └── systems/
│       ├── api.ts
│       ├── queries.ts
│       ├── mutations.ts
│       ├── schema.ts
│       ├── service.ts
│       ├── components/
│       └── index.ts
│
├── components/
│   ├── ui/                     # shadcn primitives
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   └── ...
│   │
│   └── composed/               # Reusable composed components
│       ├── Header.tsx
│       └── ...
│
├── lib/                        # Shared utilities
│   ├── db/
│   │   └── client.ts           # Prisma client
│   ├── supabase.ts
│   ├── auth.ts
│   ├── logger.ts
│   └── utils.ts
│
└── router.tsx
```

---

## Routing & Data Loading

### Route Files Should Be Thin

Routes are entry points that orchestrate—keep business logic in feature modules.

```typescript
// routes/properties/$propertyId.tsx
import { createFileRoute } from '@tanstack/react-router'
import { propertyQueryOptions } from '~/features/properties'
import { PropertyDetail } from '~/features/properties'

export const Route = createFileRoute('/properties/$propertyId')({
  loader: async ({ context, params }) => {
    await context.queryClient.ensureQueryData(propertyQueryOptions(params.propertyId))
  },
  component: PropertyPage,
})

function PropertyPage() {
  const { propertyId } = Route.useParams()
  return <PropertyDetail propertyId={propertyId} />
}
```

### Loader Execution Context

| Scenario | Loader Runs | Query Runs |
|----------|-------------|------------|
| Initial page load (SSR) | Server | Server |
| Client-side navigation | Client | Client |
| Revalidation/refetch | Client | Client |

---

## Data Fetching with React Query

### The queryOptions Pattern

Use `queryOptions` factories as the shared contract between loaders and components.

```typescript
// features/properties/queries.ts
import { queryOptions } from '@tanstack/react-query'
import { fetchProperties, fetchProperty } from './api'

export const propertiesQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: ['properties', userId],
    queryFn: () => fetchProperties({ data: userId }),
  })

export const propertyQueryOptions = (propertyId: string) =>
  queryOptions({
    queryKey: ['properties', propertyId],
    queryFn: () => fetchProperty({ data: propertyId }),
  })
```

### Server Functions

Use server functions to keep data fetching server-side (DB access, secrets, etc.).

```typescript
// features/properties/api.ts
import { createServerFn } from '@tanstack/start'
import { prisma } from '~/lib/db/client'

export const fetchProperties = createServerFn({ method: 'GET' })
  .inputValidator((userId: string) => userId)
  .handler(async ({ data: userId }) => {
    return prisma.properties.findMany({ where: { user_id: userId } })
  })

export const fetchProperty = createServerFn({ method: 'GET' })
  .inputValidator((propertyId: string) => propertyId)
  .handler(async ({ data: propertyId }) => {
    return prisma.properties.findUnique({ where: { id: propertyId } })
  })

export const createProperty = createServerFn({ method: 'POST' })
  .inputValidator((data: CreatePropertyInput) => data)
  .handler(async ({ data }) => {
    return prisma.properties.create({ data })
  })
```

### Components Use useSuspenseQuery

```typescript
// features/properties/components/PropertyDetail.tsx
import { useSuspenseQuery } from '@tanstack/react-query'
import { propertyQueryOptions } from '../queries'

export function PropertyDetail({ propertyId }: { propertyId: string }) {
  const { data: property } = useSuspenseQuery(propertyQueryOptions(propertyId))

  return <article>{/* render property */}</article>
}
```

### Mutations with Invalidation

```typescript
// features/properties/mutations.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createProperty, updateProperty, deleteProperty } from './api'

export function useCreateProperty() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: CreatePropertyInput) => createProperty({ data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['properties'] })
    },
  })
}

export function useUpdateProperty() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (data: UpdatePropertyInput) => updateProperty({ data }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['properties', variables.id] })
      queryClient.invalidateQueries({ queryKey: ['properties'] })
    },
  })
}
```

### Query Keys

Query keys support arrays, objects, and any serializable data with deep equality comparison.

```typescript
// Valid query keys
queryKey: ['properties']
queryKey: ['properties', propertyId]
queryKey: ['properties', { userId, status: 'active' }]
queryKey: ['systems', propertyId, 'list']

// Invalidation with partial matching
queryClient.invalidateQueries({ queryKey: ['properties', propertyId] }) // All for this property
queryClient.invalidateQueries({ queryKey: ['properties'] }) // All properties
```

Structure keys hierarchically—broad to specific, left to right—for intuitive partial invalidation.

### Error Handling in Server Functions

> **CRITICAL**: Never `throw new Response(...)` in server functions used by route loaders. This causes SSR crashes.

#### The Solution for 404/403 Cases

For server functions called in route loaders (via `ensureQueryData`), return `null` for not-found or no-access cases. Let the component handle the 404:

```typescript
// Server function returns null
export const fetchProperty = createServerFn({ method: 'GET' })
  .inputValidator((propertyId: string) => propertyId)
  .handler(async ({ data: propertyId }): Promise<Property | null> => {
    const property = await prisma.properties.findUnique({
      where: { id: propertyId },
    })
    return property // null if not found
  })
```

```typescript
// Component throws notFound()
function PropertyPage() {
  const { propertyId } = Route.useParams()
  const { data: property } = useSuspenseQuery(propertyQueryOptions(propertyId))

  if (!property) {
    throw notFound()
  }

  return <PropertyDetail property={property} />
}
```

#### Summary

| Server Function Type | Error Handling |
|---------------------|----------------|
| Used in loader (`ensureQueryData`) | Return `null`, component throws `notFound()` |
| Mutation / Action | Throw regular `Error` |
| Never | `throw new Response(...)` |

---

## Feature Module Conventions

### Public API via index.ts

Each feature exports a clean public API.

```typescript
// features/properties/index.ts
export * from './queries'
export * from './mutations'
export * from './components/PropertyList'
export * from './components/PropertyDetail'
export * from './components/PropertyForm'
export type * from './schema'
```

### Import from Feature Root

```typescript
// Good
import { propertyQueryOptions, PropertyDetail, useCreateProperty } from '~/features/properties'

// Avoid
import { propertyQueryOptions } from '~/features/properties/queries'
import { PropertyDetail } from '~/features/properties/components/PropertyDetail'
```

---

## Quick Reference

### Creating a New Feature

1. Create `features/{name}/` directory
2. Add `schema.ts` with Zod schemas and types
3. Add `service.ts` with business logic (if complex)
4. Add `api.ts` with server functions
5. Add `queries.ts` with queryOptions factories
6. Add `mutations.ts` with mutation hooks
7. Add `components/` with UI components
8. Add `index.ts` with public exports

### Adding a New Route

1. Create route file in `routes/`
2. Import queryOptions from feature
3. Add loader with `ensureQueryData`
4. Import and compose feature components
5. Keep route file thin—delegate to features
