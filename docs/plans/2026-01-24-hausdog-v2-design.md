# Hausdog v2 Design

## Overview

Hausdog is a "Carfax for your home" - helps homeowners catalog systems, appliances, maintenance history, and documentation. Key differentiator: LLM-powered content entry via photo capture.

### Core Value Props
- Zero-friction capture (photo → structured data via LLM)
- Chat assistant that knows your specific home
- Complete home history for insurance/sales

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Bun |
| Framework | TanStack Start |
| UI | Tailwind CSS + shadcn/ui |
| Database | PostgreSQL via Supabase |
| ORM | Prisma 7 |
| Auth | Supabase Auth (SSR) |
| Storage | Supabase Storage |
| LLM - Vision | Gemini Flash |
| LLM - Reasoning/Chat | Claude (swappable via TanStack AI) |
| Background Jobs | Trigger.dev |
| Chat UI | TanStack AI |
| Secrets | Doppler |

---

## Data Model

### Design Decisions
- No separate User table - reference `auth.users` directly
- All entities have `createdById` and `updatedById` (defaults to createdById on create)
- Single `acquiredDate` instead of separate purchase/install dates
- Items use parent-child self-reference (replaces System/Component hierarchy)
- Spaces are simple names (no type field)
- Document status is an enum tracking full lifecycle
- Database columns use snake_case, Prisma fields use camelCase

### Prisma Schema

```prisma
generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}

datasource db {
  provider = "postgresql"
  schemas  = ["auth", "public"]
}

model Property {
  id           String    @id @default(uuid())
  userId       String    @map("user_id") @db.Uuid
  name         String
  address      String?
  yearBuilt    Int?      @map("year_built")
  squareFeet   Int?      @map("square_feet")
  propertyType String?   @map("property_type")
  purchaseDate DateTime? @map("purchase_date")
  createdAt    DateTime  @default(now()) @map("created_at")
  updatedAt    DateTime  @updatedAt @map("updated_at")
  createdById  String    @map("created_by_id") @db.Uuid
  updatedById  String    @map("updated_by_id") @db.Uuid

  user          users          @relation("PropertyOwner", fields: [userId], references: [id], onDelete: Cascade)
  createdBy     users          @relation("PropertyCreatedBy", fields: [createdById], references: [id])
  updatedBy     users          @relation("PropertyUpdatedBy", fields: [updatedById], references: [id])
  spaces        Space[]
  items         Item[]
  documents     Document[]
  conversations Conversation[]

  @@map("properties")
  @@schema("public")
}

model Space {
  id          String   @id @default(uuid())
  propertyId  String   @map("property_id")
  name        String
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  createdById String   @map("created_by_id") @db.Uuid
  updatedById String   @map("updated_by_id") @db.Uuid

  property  Property @relation(fields: [propertyId], references: [id], onDelete: Cascade)
  createdBy users    @relation("SpaceCreatedBy", fields: [createdById], references: [id])
  updatedBy users    @relation("SpaceUpdatedBy", fields: [updatedById], references: [id])
  items     Item[]

  @@map("spaces")
  @@schema("public")
}

model Item {
  id              String    @id @default(uuid())
  propertyId      String    @map("property_id")
  spaceId         String?   @map("space_id")
  parentId        String?   @map("parent_id")
  name            String
  category        String
  manufacturer    String?
  model           String?
  serialNumber    String?   @map("serial_number")
  acquiredDate    DateTime? @map("acquired_date")
  warrantyExpires DateTime? @map("warranty_expires")
  purchasePrice   Decimal?  @map("purchase_price")
  notes           String?
  searchText      String?   @map("search_text")
  createdAt       DateTime  @default(now()) @map("created_at")
  updatedAt       DateTime  @updatedAt @map("updated_at")
  createdById     String    @map("created_by_id") @db.Uuid
  updatedById     String    @map("updated_by_id") @db.Uuid

  property  Property   @relation(fields: [propertyId], references: [id], onDelete: Cascade)
  space     Space?     @relation(fields: [spaceId], references: [id])
  parent    Item?      @relation("ItemHierarchy", fields: [parentId], references: [id])
  children  Item[]     @relation("ItemHierarchy")
  createdBy users      @relation("ItemCreatedBy", fields: [createdById], references: [id])
  updatedBy users      @relation("ItemUpdatedBy", fields: [updatedById], references: [id])
  events    Event[]
  documents Document[]

  @@map("items")
  @@schema("public")
}

model Event {
  id          String    @id @default(uuid())
  itemId      String    @map("item_id")
  type        String
  date        DateTime
  description String?
  cost        Decimal?  @db.Decimal(10, 2)
  performedBy String?   @map("performed_by")
  createdAt   DateTime  @default(now()) @map("created_at")
  updatedAt   DateTime  @updatedAt @map("updated_at")
  createdById String    @map("created_by_id") @db.Uuid
  updatedById String    @map("updated_by_id") @db.Uuid

  item      Item       @relation(fields: [itemId], references: [id], onDelete: Cascade)
  createdBy users      @relation("EventCreatedBy", fields: [createdById], references: [id])
  updatedBy users      @relation("EventUpdatedBy", fields: [updatedById], references: [id])
  documents Document[]

  @@map("events")
  @@schema("public")
}

model Document {
  id            String    @id @default(uuid())
  propertyId    String    @map("property_id")
  itemId        String?   @map("item_id")
  eventId       String?   @map("event_id")
  type          String
  fileName      String    @map("file_name")
  storagePath   String    @map("storage_path")
  contentType   String    @map("content_type")
  sizeBytes     BigInt    @map("size_bytes")
  status        String    @default("pending")
  extractedText String?   @map("extracted_text")
  extractedData Json?     @map("extracted_data")
  resolveData   Json?     @map("resolve_data")
  documentDate  DateTime? @map("document_date")
  createdAt     DateTime  @default(now()) @map("created_at")
  createdById   String    @map("created_by_id") @db.Uuid

  property  Property @relation(fields: [propertyId], references: [id], onDelete: Cascade)
  item      Item?    @relation(fields: [itemId], references: [id])
  event     Event?   @relation(fields: [eventId], references: [id])
  createdBy users    @relation("DocumentCreatedBy", fields: [createdById], references: [id])

  @@map("documents")
  @@schema("public")
}

model Conversation {
  id          String   @id @default(uuid())
  propertyId  String   @map("property_id")
  title       String?
  createdAt   DateTime @default(now()) @map("created_at")
  updatedAt   DateTime @updatedAt @map("updated_at")
  createdById String   @map("created_by_id") @db.Uuid

  property  Property  @relation(fields: [propertyId], references: [id], onDelete: Cascade)
  createdBy users     @relation("ConversationCreatedBy", fields: [createdById], references: [id])
  messages  Message[]

  @@map("conversations")
  @@schema("public")
}

model Message {
  id             String   @id @default(uuid())
  conversationId String   @map("conversation_id")
  role           String
  content        String
  createdAt      DateTime @default(now()) @map("created_at")

  conversation Conversation @relation(fields: [conversationId], references: [id], onDelete: Cascade)

  @@map("messages")
  @@schema("public")
}
```

### Enums / Constants

```typescript
const ITEM_CATEGORIES = [
  'hvac', 'plumbing', 'electrical', 'appliance',
  'structure', 'tool', 'fixture', 'other'
] as const

const EVENT_TYPES = [
  'installation', 'maintenance', 'repair',
  'inspection', 'replacement', 'observation'
] as const

const DOCUMENT_TYPES = [
  'photo', 'receipt', 'manual', 'warranty', 'invoice'
] as const

const DOCUMENT_STATUSES = [
  'pending', 'processing', 'ready_for_review', 'confirmed', 'discarded'
] as const

const PROPERTY_TYPES = [
  'single_family', 'condo', 'townhouse', 'multi_family'
] as const
```

### Full-Text Search

```sql
CREATE INDEX items_search_idx ON items USING GIN (to_tsvector('english', search_text));
```

Populate `searchText` on insert/update by concatenating: name, manufacturer, model, serialNumber, notes.

---

## LLM Pipeline

### Document Processing Flow

```
Upload → Document (status: pending)
       → Trigger.dev job fires
       → EXTRACT (Gemini Flash) → extractedText + extractedData
       → RESOLVE (Claude) → resolveData
       → Document (status: ready_for_review)
       → User reviews in queue
       → Confirm: Create Item/Event, link Document, status: confirmed
       → Discard: status: discarded
```

### Gemini Extraction Prompt

```
Analyze this image of home-related documentation.

Identify document type: equipment_plate, receipt, manual, product_photo, invoice, warranty, other

Extract all visible information:
- Manufacturer, model, serial number
- Purchase/service date, price, vendor
- Warranty details
- Any specifications or capacity info

Return JSON:
{
  "documentType": "...",
  "confidence": 0.0-1.0,
  "rawText": "all visible text",
  "extracted": {
    "manufacturer": null,
    "model": null,
    "serialNumber": null,
    "productName": null,
    "date": null,
    "price": null,
    "vendor": null,
    "warrantyExpires": null,
    "specs": {}
  },
  "suggestedItemName": "...",
  "suggestedCategory": "hvac|plumbing|electrical|appliance|structure|tool|fixture|other"
}
```

### Claude Resolution Prompt

```
Given extracted document data and user's inventory, determine:
1. NEW_ITEM - Create new item
2. ATTACH_TO_ITEM - Document for existing item (receipt, manual, photo)
3. CHILD_OF_ITEM - Component of existing item (filter for furnace)

INVENTORY: {items as JSON}
EXTRACTED: {extractedData}

Return JSON:
{
  "action": "NEW_ITEM|ATTACH_TO_ITEM|CHILD_OF_ITEM",
  "matchedItemId": null or "uuid",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation",
  "suggestedEventType": null or "installation|maintenance|..."
}
```

### Review Queue UX

For each document in ready_for_review:
- Show thumbnail (tap to expand)
- Display extracted fields
- Show resolution suggestion ("Create new item" or "Add to: [item name]")
- User can:
  - **Confirm** - accept as suggested
  - **Edit** - modify fields, pick different existing item, or switch to new
  - **Discard** - bad photo, not useful

---

## Chat Architecture

### MVP Scope
Basic Q&A only - Claude answers questions based on inventory, no actions or tool use.

### Context Assembly

When user sends a message:
1. Search items using full-text on `searchText` to find relevant items
2. Fetch recent events for matched items
3. Build system prompt with property info + relevant equipment
4. Call Claude via TanStack AI

### System Prompt Template

```
You are a helpful home maintenance assistant. You have access to this homeowner's property information and equipment history.

Property: {name}
Year Built: {yearBuilt}
Address: {address}

Relevant Equipment:
{formatted items with recent events}

Be practical and helpful. Suggest DIY solutions when appropriate, recommend professionals when safety or complexity warrants it. Reference specific equipment details when relevant.
```

---

## Project Structure

```
hausdog/
├── apps/
│   └── web/
│       ├── src/
│       │   ├── routes/
│       │   │   ├── __root.tsx
│       │   │   ├── index.tsx
│       │   │   ├── login.tsx
│       │   │   ├── auth/
│       │   │   │   └── callback.tsx
│       │   │   └── _authenticated/
│       │   │       ├── dashboard.tsx
│       │   │       ├── items/
│       │   │       │   ├── index.tsx
│       │   │       │   └── $itemId.tsx
│       │   │       ├── capture.tsx
│       │   │       ├── review.tsx
│       │   │       ├── chat/
│       │   │       │   ├── index.tsx
│       │   │       │   └── $conversationId.tsx
│       │   │       ├── spaces.tsx
│       │   │       └── settings.tsx
│       │   ├── features/
│       │   │   ├── properties/
│       │   │   │   ├── api.ts
│       │   │   │   ├── queries.ts
│       │   │   │   └── mutations.ts
│       │   │   ├── items/
│       │   │   ├── spaces/
│       │   │   ├── events/
│       │   │   ├── documents/
│       │   │   └── chat/
│       │   ├── components/
│       │   │   ├── ui/
│       │   │   ├── shared/
│       │   │   │   ├── page-header.tsx
│       │   │   │   ├── empty-state.tsx
│       │   │   │   ├── confirm-dialog.tsx
│       │   │   │   ├── loading-spinner.tsx
│       │   │   │   └── category-icon.tsx
│       │   │   ├── layout/
│       │   │   │   ├── header.tsx
│       │   │   │   ├── sidebar.tsx
│       │   │   │   └── auth-layout.tsx
│       │   │   ├── items/
│       │   │   │   ├── item-card.tsx
│       │   │   │   ├── item-form.tsx
│       │   │   │   └── item-timeline.tsx
│       │   │   ├── documents/
│       │   │   │   ├── capture-button.tsx
│       │   │   │   ├── document-grid.tsx
│       │   │   │   └── review-card.tsx
│       │   │   └── chat/
│       │   │       ├── chat-window.tsx
│       │   │       └── conversation-list.tsx
│       │   └── lib/
│       │       ├── db/
│       │       ├── services/
│       │       │   ├── properties.ts
│       │       │   ├── items.ts
│       │       │   ├── spaces.ts
│       │       │   ├── events.ts
│       │       │   ├── documents.ts
│       │       │   ├── chat.ts
│       │       │   └── index.ts
│       │       ├── llm/
│       │       │   ├── gemini.ts
│       │       │   └── claude.ts
│       │       ├── supabase.ts
│       │       ├── auth.ts
│       │       ├── logger.ts
│       │       ├── env.ts
│       │       └── client-env.ts
│       ├── prisma/
│       │   └── schema.prisma
│       └── package.json
├── packages/
│   └── domain/
├── trigger/
│   └── process-document.ts
├── supabase/
│   └── migrations/
└── Makefile
```

---

## Environment Variables

**env.ts** (server - via Doppler):
```typescript
export const env = {
  DATABASE_URL: process.env.DATABASE_URL!,
  SUPABASE_URL: process.env.SUPABASE_URL!,
  SUPABASE_KEY: process.env.SUPABASE_KEY!,
  SUPABASE_SERVICE_KEY: process.env.SUPABASE_SERVICE_KEY!,
  GEMINI_API_KEY: process.env.GEMINI_API_KEY!,
  ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY!,
  TRIGGER_API_KEY: process.env.TRIGGER_API_KEY!,
} as const
```

**client-env.ts** (browser - via Vite):
```typescript
export const clientEnv = {
  SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL!,
  SUPABASE_KEY: import.meta.env.VITE_SUPABASE_KEY!,
} as const
```

---

## MVP Screens

| Screen | Route | Purpose |
|--------|-------|---------|
| Landing | `/` | Marketing, login CTA |
| Login | `/login` | Supabase auth |
| Dashboard | `/dashboard` | Property summary, recent activity, review queue badge, capture button |
| Items List | `/items` | Filter by space/category, search, grid/list view |
| Item Detail | `/items/$itemId` | Info, children, events timeline, documents |
| Capture | `/capture` | Camera/upload, multi-file |
| Review Queue | `/review` | Pending documents, confirm/edit/discard |
| Chat | `/chat` | Conversation list + active chat |
| Spaces | `/spaces` | Simple CRUD |
| Settings | `/settings` | Property details, profile |

---

## Implementation Order

### Phase 1: Foundation
1. Project setup (TanStack Start, Tailwind, shadcn/ui)
2. Prisma schema + migrations
3. Supabase auth (port from existing)
4. Basic layout (header, auth protection)

### Phase 2: Core CRUD
5. Property management
6. Space CRUD
7. Item CRUD with parent-child
8. Event CRUD

### Phase 3: Document Pipeline
9. Document upload to Supabase Storage
10. Trigger.dev setup + job skeleton
11. Gemini extraction
12. Claude resolution
13. Review queue UI

### Phase 4: Polish & Chat
14. Dashboard with stats + activity
15. Items list with filtering/search
16. Full-text search
17. Chat with TanStack AI + Claude

### Reusable from Existing App
- Auth utilities (`lib/auth.ts`, `lib/supabase.ts`)
- Prisma client setup (`lib/db/`)
- Document upload logic (adapt)
- Gemini extraction (adapt prompt)
- shadcn/ui components
- Query/mutation patterns

---

## Deferred (Post-MVP)

- Maintenance reminders with category defaults
- Better onboarding flow
- Multi-property UI
- Warranty expiration alerts
- Spending tracking/analytics
- Seasonal maintenance suggestions
- Reports for home sale
- LLM enrichment via search (specs lookup)
