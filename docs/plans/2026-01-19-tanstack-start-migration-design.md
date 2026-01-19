# Hausdog: TanStack Start Migration Design

## Overview

Convert hausdog from Go/HTMX to TanStack Start (React/TypeScript) for better React ecosystem access, end-to-end type safety, improved developer experience, and team familiarity with React patterns.

## Decisions

- **Framework**: TanStack Start (full-stack, no separate backend)
- **Database Access**: Prisma ORM (not Supabase client directly)
- **AI Extraction**: Supabase Edge Functions (async processing)
- **UI Components**: shadcn/ui + Tailwind CSS v4 with semantic tokens
- **Authentication**: Supabase Auth with `@supabase/ssr`
- **Type System**: Zod 4 schemas with derived TypeScript types
- **Architecture**: Service layer pattern with clean domain types

## Tech Stack

| Layer | Technology |
|-------|------------|
| Framework | TanStack Start (React 19, Vite) |
| Language | TypeScript |
| Database | PostgreSQL via Supabase |
| ORM | Prisma |
| Auth | Supabase Auth + `@supabase/ssr` |
| Storage | Supabase Storage |
| AI Processing | Supabase Edge Functions (Deno) |
| UI | shadcn/ui + Tailwind CSS v4 |
| Server State | TanStack Query |

## Styling: Tailwind v4 with Semantic Tokens

Use Tailwind v4's CSS-first configuration with semantic color tokens. No hex codes or named colors scattered throughout components.

### CSS Variables

```css
/* app/styles/globals.css */
@import "tailwindcss";

@theme {
  /* Semantic color tokens */
  --color-background: oklch(98% 0.01 240);
  --color-foreground: oklch(20% 0.02 240);

  --color-surface: oklch(100% 0 0);
  --color-surface-elevated: oklch(99% 0.005 240);

  --color-border: oklch(90% 0.01 240);
  --color-border-muted: oklch(94% 0.005 240);

  --color-primary: oklch(55% 0.2 250);
  --color-primary-foreground: oklch(100% 0 0);

  --color-secondary: oklch(95% 0.01 240);
  --color-secondary-foreground: oklch(30% 0.02 240);

  --color-muted: oklch(96% 0.005 240);
  --color-muted-foreground: oklch(50% 0.02 240);

  --color-accent: oklch(92% 0.03 240);
  --color-accent-foreground: oklch(25% 0.02 240);

  --color-destructive: oklch(55% 0.22 25);
  --color-destructive-foreground: oklch(100% 0 0);

  --color-success: oklch(55% 0.18 145);
  --color-warning: oklch(70% 0.15 70);
}

/* Dark mode overrides */
@media (prefers-color-scheme: dark) {
  @theme {
    --color-background: oklch(15% 0.02 240);
    --color-foreground: oklch(95% 0.01 240);
    --color-surface: oklch(18% 0.02 240);
    --color-surface-elevated: oklch(22% 0.02 240);
    --color-border: oklch(30% 0.02 240);
    --color-border-muted: oklch(25% 0.015 240);
    /* ... etc */
  }
}
```

### Usage in Components

```tsx
// Use semantic tokens, never raw colors
<div className="bg-background text-foreground">
  <Card className="bg-surface border-border">
    <Button className="bg-primary text-primary-foreground">
      Save
    </Button>
    <Button variant="secondary" className="bg-secondary text-secondary-foreground">
      Cancel
    </Button>
  </Card>
</div>

// Status indicators
<Badge className="bg-success text-white">Complete</Badge>
<Badge className="bg-warning text-foreground">Pending</Badge>
<Badge className="bg-destructive text-destructive-foreground">Failed</Badge>
```

### Token Categories

| Token | Purpose |
|-------|---------|
| `background` / `foreground` | Page-level defaults |
| `surface` / `surface-elevated` | Cards, modals, popovers |
| `border` / `border-muted` | Borders and dividers |
| `primary` | Primary actions, links |
| `secondary` | Secondary actions |
| `muted` | Disabled, placeholder states |
| `accent` | Highlights, hover states |
| `destructive` | Delete, error states |
| `success` / `warning` | Status indicators |

## Project Structure

```
hausdog-web/
├── app/
│   ├── routes/
│   │   ├── __root.tsx              # Root layout, auth provider
│   │   ├── index.tsx               # Dashboard / landing
│   │   ├── login.tsx               # Login page
│   │   ├── auth.callback.tsx       # OAuth callback
│   │   ├── upload.tsx              # Document upload
│   │   ├── documents/
│   │   │   ├── index.tsx           # Document list
│   │   │   └── $id.tsx             # Document detail
│   │   └── properties/
│   │       ├── index.tsx           # Properties list
│   │       ├── new.tsx             # New property form
│   │       └── $id.tsx             # Property detail + systems
│   ├── components/
│   │   ├── ui/                     # shadcn/ui primitives
│   │   ├── layout/                 # Header, sidebar, containers
│   │   ├── properties/             # Property-specific components
│   │   ├── systems/                # System-specific components
│   │   ├── documents/              # Document/upload components
│   │   └── shared/                 # Reusable components
│   ├── lib/
│   │   ├── db/
│   │   │   └── client.ts           # Prisma client
│   │   ├── domain/
│   │   │   ├── property.ts         # Zod schemas + types
│   │   │   ├── system.ts
│   │   │   ├── component.ts
│   │   │   └── document.ts
│   │   ├── services/
│   │   │   ├── property.service.ts
│   │   │   ├── system.service.ts
│   │   │   ├── component.service.ts
│   │   │   └── document.service.ts
│   │   ├── api/                    # Server functions
│   │   ├── supabase.ts             # Supabase client setup
│   │   └── auth.ts                 # Auth helpers
│   └── styles/
├── supabase/
│   ├── functions/
│   │   └── extract-document/       # AI extraction Edge Function
│   └── migrations/                 # Keep existing migrations
├── prisma/
│   └── schema.prisma               # Generated from existing DB
└── components.json                 # shadcn/ui config
```

## Data Layer Architecture

### Three-Layer Design

```
Routes/Components → Services → Prisma
        ↓               ↓
    Zod Schemas    Domain Types
```

### Domain Types with Zod 4

```typescript
// app/lib/domain/property.ts
import { z } from 'zod'

// Base schema - shared fields
const propertyBase = z.object({
  name: z.string().min(1).max(255),
  address: z.string().max(500).optional(),
})

// Input schemas
export const createPropertySchema = propertyBase
export const updatePropertySchema = propertyBase.partial()

// Full domain type (what services return)
export const propertySchema = propertyBase.extend({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  createdAt: z.date(),
  updatedAt: z.date(),
})

// Derived types
export type Property = z.infer<typeof propertySchema>
export type CreatePropertyInput = z.infer<typeof createPropertySchema>
export type UpdatePropertyInput = z.infer<typeof updatePropertySchema>
```

### Service Layer

```typescript
// app/lib/services/property.service.ts
import { prisma } from '../db/client'
import type { Property, CreatePropertyInput, UpdatePropertyInput } from '../domain/property'

export class PropertyService {
  async findAllForUser(userId: string): Promise<Property[]> {
    const records = await prisma.property.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })
    return records.map(this.toDomain)
  }

  async findById(id: string, userId: string): Promise<Property | null> {
    const record = await prisma.property.findFirst({
      where: { id, userId },
    })
    return record ? this.toDomain(record) : null
  }

  async create(userId: string, input: CreatePropertyInput): Promise<Property> {
    const record = await prisma.property.create({
      data: { ...input, userId },
    })
    return this.toDomain(record)
  }

  async update(id: string, userId: string, input: UpdatePropertyInput): Promise<Property> {
    const record = await prisma.property.update({
      where: { id, userId },
      data: input,
    })
    return this.toDomain(record)
  }

  async delete(id: string, userId: string): Promise<void> {
    await prisma.property.delete({
      where: { id, userId },
    })
  }

  // Maps Prisma model → Domain type
  private toDomain(record: PrismaProperty): Property {
    return {
      id: record.id,
      userId: record.user_id,
      name: record.name,
      address: record.address ?? undefined,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    }
  }
}

export const propertyService = new PropertyService()
```

### Server Functions

```typescript
// app/lib/api/properties.ts
import { createServerFn } from '@tanstack/start'
import { propertyService } from '../services/property.service'
import { createPropertySchema } from '../domain/property'

export const getProperties = createServerFn('GET', async (_, ctx) => {
  const user = await requireAuth(ctx.request)
  return propertyService.findAllForUser(user.id)
})

export const createProperty = createServerFn('POST', async (input: unknown, ctx) => {
  const user = await requireAuth(ctx.request)
  const validated = createPropertySchema.parse(input)
  return propertyService.create(user.id, validated)
})
```

## Authentication

### Server-Side Auth with `@supabase/ssr`

```typescript
// app/lib/supabase.ts
import { createServerClient } from '@supabase/ssr'

export function createSupabaseServer(request: Request) {
  const cookies = parseCookies(request.headers.get('cookie'))

  return createServerClient(
    process.env.SUPABASE_URL!,
    process.env.SUPABASE_ANON_KEY!,
    {
      cookies: {
        get: (name) => cookies[name],
        set: (name, value, options) => { /* set cookie */ },
        remove: (name, options) => { /* remove cookie */ },
      },
    }
  )
}
```

### Protected Routes

```typescript
// app/routes/properties/index.tsx
export const Route = createFileRoute('/properties/')({
  beforeLoad: async ({ context }) => {
    const { user } = context.auth
    if (!user) throw redirect({ to: '/login' })
  },
  loader: async ({ context }) => {
    return getProperties()
  },
})
```

### OAuth Flow

1. `/login` - Button triggers `supabase.auth.signInWithOAuth({ provider: 'google' })`
2. `/auth/callback` - Exchanges code for session, sets cookies, redirects to dashboard
3. Session refreshed automatically via `@supabase/ssr`

## Document Upload & AI Extraction

### Upload Flow

1. Client uploads file via server function
2. Server function stores in Supabase Storage, creates `document` record with `status: 'pending'`
3. Database trigger invokes Supabase Edge Function for extraction
4. Edge Function processes document, emits realtime events, updates record

### Server Function

```typescript
// app/lib/api/documents.ts
export const uploadDocument = createServerFn('POST', async (formData: FormData, ctx) => {
  const user = await requireAuth(ctx.request)
  const file = formData.get('file') as File
  const propertyId = formData.get('propertyId') as string | null

  // Upload to Supabase Storage
  const path = `${user.id}/${crypto.randomUUID()}/${file.name}`
  await supabaseAdmin.storage.from('documents').upload(path, file)

  // Create document record (triggers Edge Function)
  return documentService.create(user.id, {
    filename: file.name,
    storagePath: path,
    contentType: file.type,
    sizeBytes: file.size,
    propertyId,
  })
})
```

### Supabase Edge Function

```typescript
// supabase/functions/extract-document/index.ts
import Anthropic from '@anthropic-ai/sdk'

Deno.serve(async (req) => {
  const { documentId } = await req.json()

  // Fetch document record
  const { data: doc } = await supabase
    .from('documents')
    .select('*')
    .eq('id', documentId)
    .single()

  // Download file from storage
  const file = await supabase.storage.from('documents').download(doc.storage_path)

  // Call Claude for extraction
  const anthropic = new Anthropic()
  const result = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: [{ role: 'user', content: [
      { type: 'image', source: { type: 'base64', data: await toBase64(file) } },
      { type: 'text', text: EXTRACTION_PROMPT }
    ]}]
  })

  // Update document with extracted data
  await supabase
    .from('documents')
    .update({
      extractedData: parseExtraction(result),
      processingStatus: 'complete',
      processedAt: new Date().toISOString()
    })
    .eq('id', documentId)
})
```

### Database Trigger

```sql
create or replace function invoke_extraction()
returns trigger as $$
begin
  perform net.http_post(
    url := 'https://<project>.supabase.co/functions/v1/extract-document',
    body := jsonb_build_object('documentId', NEW.id)
  );
  return NEW;
end;
$$ language plpgsql;

create trigger on_document_created
  after insert on documents
  for each row execute function invoke_extraction();
```

### Realtime Status Updates

```typescript
// In upload component
supabase
  .channel('document-status')
  .on('postgres_changes',
    { event: 'UPDATE', schema: 'public', table: 'documents', filter: `id=eq.${docId}` },
    (payload) => setStatus(payload.new.processing_status)
  )
  .subscribe()
```

## UI Components

### shadcn/ui Components Needed

- `button`, `input`, `label`, `textarea` - Forms
- `card`, `table`, `badge` - Display
- `dialog`, `dropdown-menu`, `select` - Interactions
- `toast`, `alert` - Feedback
- `skeleton` - Loading states

### Component Organization

```
app/components/
├── ui/                        # shadcn/ui primitives
├── layout/
│   ├── header.tsx
│   ├── sidebar.tsx
│   └── page-container.tsx
├── properties/
│   ├── property-card.tsx
│   └── property-form.tsx
├── systems/
│   ├── system-list.tsx
│   ├── system-card.tsx
│   └── add-system-dialog.tsx
├── documents/
│   ├── upload-zone.tsx
│   ├── document-card.tsx
│   └── extraction-preview.tsx
└── shared/
    ├── confirm-dialog.tsx
    └── empty-state.tsx
```

## Migration Plan

### Phase 1: Project Setup
- Initialize TanStack Start project with TypeScript
- Configure Tailwind CSS + shadcn/ui
- Set up Prisma with existing Supabase database
- Configure Supabase Auth with `@supabase/ssr`
- Set up environment variables

### Phase 2: Foundation
- Define Zod schemas for all domain types
- Create service classes for each entity
- Build auth helpers and middleware
- Create root layout with auth context

### Phase 3: Core Pages
- Landing / Dashboard
- Login + OAuth callback
- Properties CRUD
- Systems CRUD
- Components CRUD

### Phase 4: Document Features
- Document list and detail pages
- Upload zone component with drag-and-drop
- Supabase Edge Function for extraction
- Realtime status subscriptions

### Phase 5: Polish
- Error boundaries and loading states
- Toast notifications
- Mobile responsive tweaks
- Testing

## What Stays the Same

- Database schema (Prisma introspects existing tables)
- RLS policies (still enforced at database level)
- Supabase Storage bucket structure
- Extraction prompt logic (ported to Edge Function)

## What Gets Removed

- All Go code (`cmd/`, `internal/`)
- HTMX/Alpine.js templates (`web/templates/`)
- Go module files (`go.mod`, `go.sum`)
