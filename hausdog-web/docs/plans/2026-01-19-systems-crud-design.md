# Systems CRUD Design

## Overview

Add full CRUD functionality for systems within the hausdog property management app. Systems belong to properties and are categorized (HVAC, Plumbing, etc.).

## Routes

| Route | Purpose |
|-------|---------|
| `/properties/$propertyId` | Property detail with inline systems list |
| `/properties/$propertyId/systems/new` | Create new system |
| `/properties/$propertyId/systems/$systemId` | View/edit system detail |

## Feature Structure

```
features/systems/
├── service.ts      # SystemService class
├── api.ts          # createServerFn wrappers
├── queries.ts      # Query hooks
├── mutations.ts    # Mutation hooks
└── index.ts        # Re-exports

features/categories/
├── service.ts      # CategoryService (read-only)
├── api.ts          # fetchCategories
├── queries.ts      # useCategories
└── index.ts
```

## Data Model

From Prisma schema:

```
systems:
  - id (uuid)
  - property_id (uuid, FK)
  - category_id (uuid, FK)
  - name (string, required)
  - manufacturer (string, optional)
  - model (string, optional)
  - serial_number (string, optional)
  - install_date (date, optional)
  - warranty_expires (date, optional)
  - notes (text, optional)
  - created_at, updated_at

categories:
  - id (uuid)
  - name (string)
  - icon (string, optional)
  - sort_order (int)
```

Domain schemas already exist in `@hausdog/domain/systems` and `@hausdog/domain/categories`.

## Service Layer

### SystemService

```typescript
class SystemService {
  findAllForProperty(propertyId: string, userId: string): Promise<SystemWithCounts[]>
  findById(id: string, userId: string): Promise<SystemWithCategory | null>
  create(userId: string, input: CreateSystemInput): Promise<System>
  update(id: string, userId: string, input: UpdateSystemInput): Promise<System>
  delete(id: string, userId: string): Promise<void>
}
```

All methods validate property ownership via user_id join.

### CategoryService

```typescript
class CategoryService {
  findAll(): Promise<Category[]>  // Ordered by sort_order
}
```

## Query Layer

```typescript
// Query keys
systemKeys = {
  all: ['systems'],
  forProperty: (propertyId: string) => ['systems', 'property', propertyId],
  detail: (id: string) => ['systems', 'detail', id],
}

categoryKeys = {
  all: ['categories'],
}

// Hooks
useSystemsForProperty(propertyId: string, userId: string | undefined)
useSystem(id: string, userId: string | undefined)
useCategories()
```

## Mutations

```typescript
useCreateSystem()    // Invalidates forProperty list
useUpdateSystem()    // Invalidates forProperty list + detail
useDeleteSystem()    // Invalidates forProperty list, removes detail
```

## UI Changes

### Property Detail Page

Replace systems placeholder with:
- List of system cards showing: category icon, name, component count
- Each card links to system detail
- Empty state with "Add Your First System" button
- "Add System" button in header

### System Create Page (`/properties/$propertyId/systems/new`)

Form fields:
- Category (required, dropdown)
- Name (required)
- Manufacturer, Model, Serial Number (optional text)
- Install Date, Warranty Expires (optional date pickers)
- Notes (optional textarea)

Breadcrumb: Properties → [Property Name] → New System

### System Detail Page (`/properties/$propertyId/systems/$systemId`)

- View mode: display all fields, Edit/Delete buttons
- Edit mode: form with save/cancel
- Delete confirmation dialog
- Breadcrumb: Properties → [Property Name] → [System Name]
- Placeholder for Components section (future work)

## Security

- RLS on database tables
- Service layer validates property ownership via user_id
- All routes use `requireAuthFromContext(context)`

## Implementation Order

1. Categories feature (service, api, queries)
2. Systems feature (service, api, queries, mutations)
3. Update property detail page (systems list)
4. Create system page
5. System detail page
