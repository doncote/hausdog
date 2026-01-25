# Hausdog v2 Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a fresh Hausdog web app with LLM-powered document capture, item management, and chat assistant.

**Architecture:** TanStack Start app with Supabase (auth, storage, Postgres), Prisma ORM, Trigger.dev for background jobs. Features organized as API/queries/mutations, with centralized services in lib/services. LLM pipeline uses Gemini for vision extraction, Claude for resolution and chat.

**Tech Stack:** Bun, TanStack Start, React 19, Tailwind v4, shadcn/ui, Prisma 7, Supabase, Trigger.dev, Gemini Flash, Claude, TanStack AI

---

## Phase 1: Foundation

### Task 1: Initialize TanStack Start Project

**Files:**
- Create: `apps/web/package.json`
- Create: `apps/web/tsconfig.json`
- Create: `apps/web/vite.config.ts`
- Create: `apps/web/app.config.ts`

**Step 1: Create apps/web directory and initialize**

```bash
mkdir -p apps/web
cd apps/web
bun init -y
```

**Step 2: Install core dependencies**

```bash
cd /Users/don/code/hausdog/apps/web
bun add @tanstack/react-start @tanstack/react-router @tanstack/react-query @tanstack/router-plugin react react-dom
bun add -d typescript @types/react @types/react-dom @types/node vite @vitejs/plugin-react vite-tsconfig-paths
```

**Step 3: Create vite.config.ts**

```typescript
// apps/web/vite.config.ts
import { tanstackStart } from '@tanstack/react-start/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    tanstackStart(),
    react(),
  ],
})
```

**Step 4: Create app.config.ts**

```typescript
// apps/web/app.config.ts
import { defineConfig } from '@tanstack/react-start/config'

export default defineConfig({})
```

**Step 5: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["DOM", "DOM.Iterable", "ES2022"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "jsx": "react-jsx",
    "strict": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"],
      "@generated/*": ["./generated/*"]
    }
  },
  "include": ["src", "*.ts", "*.tsx"],
  "exclude": ["node_modules"]
}
```

**Step 6: Update package.json scripts**

```json
{
  "name": "hausdog-web",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite dev",
    "build": "vite build",
    "preview": "vite preview"
  }
}
```

**Step 7: Verify setup compiles**

Run: `cd /Users/don/code/hausdog/apps/web && bun run build`
Expected: Build completes (may have warnings about missing routes)

**Step 8: Commit**

```bash
git add apps/web
git commit -m "feat: initialize TanStack Start project structure"
```

---

### Task 2: Set Up Tailwind CSS v4 and shadcn/ui

**Files:**
- Create: `apps/web/src/styles/globals.css`
- Create: `apps/web/components.json`
- Create: `apps/web/src/lib/utils.ts`

**Step 1: Install Tailwind and UI dependencies**

```bash
cd /Users/don/code/hausdog/apps/web
bun add tailwindcss @tailwindcss/vite tailwind-merge clsx class-variance-authority lucide-react
bun add @radix-ui/react-slot @radix-ui/react-dialog @radix-ui/react-dropdown-menu @radix-ui/react-label @radix-ui/react-select
```

**Step 2: Update vite.config.ts for Tailwind**

```typescript
// apps/web/vite.config.ts
import tailwindcss from '@tailwindcss/vite'
import { tanstackStart } from '@tanstack/react-start/vite'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import tsconfigPaths from 'vite-tsconfig-paths'

export default defineConfig({
  plugins: [
    tsconfigPaths(),
    tailwindcss(),
    tanstackStart(),
    react(),
  ],
})
```

**Step 3: Create globals.css**

```css
/* apps/web/src/styles/globals.css */
@import 'tailwindcss';

@theme {
  --font-sans: ui-sans-serif, system-ui, sans-serif, "Apple Color Emoji", "Segoe UI Emoji", "Segoe UI Symbol", "Noto Color Emoji";

  --color-background: hsl(0 0% 100%);
  --color-foreground: hsl(222.2 84% 4.9%);
  --color-card: hsl(0 0% 100%);
  --color-card-foreground: hsl(222.2 84% 4.9%);
  --color-popover: hsl(0 0% 100%);
  --color-popover-foreground: hsl(222.2 84% 4.9%);
  --color-primary: hsl(222.2 47.4% 11.2%);
  --color-primary-foreground: hsl(210 40% 98%);
  --color-secondary: hsl(210 40% 96.1%);
  --color-secondary-foreground: hsl(222.2 47.4% 11.2%);
  --color-muted: hsl(210 40% 96.1%);
  --color-muted-foreground: hsl(215.4 16.3% 46.9%);
  --color-accent: hsl(210 40% 96.1%);
  --color-accent-foreground: hsl(222.2 47.4% 11.2%);
  --color-destructive: hsl(0 84.2% 60.2%);
  --color-destructive-foreground: hsl(210 40% 98%);
  --color-border: hsl(214.3 31.8% 91.4%);
  --color-input: hsl(214.3 31.8% 91.4%);
  --color-ring: hsl(222.2 84% 4.9%);
  --radius: 0.5rem;
}

@layer base {
  * {
    @apply border-border;
  }
  body {
    @apply bg-background text-foreground;
  }
}
```

**Step 4: Create utils.ts**

```typescript
// apps/web/src/lib/utils.ts
import { type ClassValue, clsx } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}
```

**Step 5: Create components.json for shadcn**

```json
{
  "$schema": "https://ui.shadcn.com/schema.json",
  "style": "new-york",
  "rsc": false,
  "tsx": true,
  "tailwind": {
    "config": "",
    "css": "src/styles/globals.css",
    "baseColor": "slate",
    "cssVariables": true
  },
  "aliases": {
    "components": "@/components",
    "utils": "@/lib/utils",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks"
  },
  "iconLibrary": "lucide"
}
```

**Step 6: Commit**

```bash
git add apps/web
git commit -m "feat: configure Tailwind CSS v4 and shadcn/ui"
```

---

### Task 3: Copy shadcn/ui Components from Existing App

**Files:**
- Copy: `hausdog-web/src/components/ui/*.tsx` → `apps/web/src/components/ui/`

**Step 1: Create components directory and copy UI components**

```bash
mkdir -p /Users/don/code/hausdog/apps/web/src/components/ui
cp /Users/don/code/hausdog/hausdog-web/src/components/ui/*.tsx /Users/don/code/hausdog/apps/web/src/components/ui/
```

**Step 2: Verify components copied**

Run: `ls /Users/don/code/hausdog/apps/web/src/components/ui/`
Expected: button.tsx, card.tsx, input.tsx, label.tsx, select.tsx, dialog.tsx, dropdown-menu.tsx, table.tsx, textarea.tsx, skeleton.tsx, alert.tsx, badge.tsx, sonner.tsx

**Step 3: Commit**

```bash
git add apps/web/src/components
git commit -m "feat: copy shadcn/ui components from existing app"
```

---

### Task 4: Set Up Environment Configuration

**Files:**
- Create: `apps/web/src/lib/env.ts`
- Create: `apps/web/src/lib/client-env.ts`

**Step 1: Install zod**

```bash
cd /Users/don/code/hausdog/apps/web
bun add zod
```

**Step 2: Create env.ts (server)**

```typescript
// apps/web/src/lib/env.ts
import { z } from 'zod'

const serverEnvSchema = z.object({
  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_KEY: z.string().min(1),
  SUPABASE_SERVICE_KEY: z.string().min(1).optional(),

  // Database
  DATABASE_URL: z.string().min(1),

  // AI
  GEMINI_API_KEY: z.string().min(1),
  ANTHROPIC_API_KEY: z.string().min(1),

  // Trigger.dev
  TRIGGER_API_KEY: z.string().min(1).optional(),

  // Server
  PORT: z.coerce.number().default(3333),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
})

export type ServerEnv = z.infer<typeof serverEnvSchema>

let _serverEnv: ServerEnv | null = null

export function getServerEnv(): ServerEnv {
  if (_serverEnv) return _serverEnv

  const parsed = serverEnvSchema.safeParse(process.env)

  if (!parsed.success) {
    console.error('Invalid server environment variables:')
    console.error(parsed.error.flatten().fieldErrors)
    throw new Error('Invalid server environment variables')
  }

  _serverEnv = parsed.data
  return _serverEnv
}
```

**Step 3: Create client-env.ts (browser)**

```typescript
// apps/web/src/lib/client-env.ts
import { z } from 'zod'

const clientEnvSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_KEY: z.string().min(1),
})

export type ClientEnv = z.infer<typeof clientEnvSchema>

let _clientEnv: ClientEnv | null = null

export function getClientEnv(): ClientEnv {
  if (_clientEnv) return _clientEnv

  _clientEnv = {
    SUPABASE_URL: import.meta.env.VITE_SUPABASE_URL,
    SUPABASE_KEY: import.meta.env.VITE_SUPABASE_KEY,
  }

  const parsed = clientEnvSchema.safeParse(_clientEnv)

  if (!parsed.success) {
    console.error('Invalid client environment variables:')
    console.error(parsed.error.flatten().fieldErrors)
    throw new Error('Invalid client environment variables')
  }

  return _clientEnv
}
```

**Step 4: Commit**

```bash
git add apps/web/src/lib
git commit -m "feat: add environment configuration with Zod validation"
```

---

### Task 5: Set Up Prisma with New Schema

**Files:**
- Create: `apps/web/prisma/schema.prisma`

**Step 1: Install Prisma dependencies**

```bash
cd /Users/don/code/hausdog/apps/web
bun add prisma @prisma/client @prisma/adapter-pg pg
bun add -d @types/pg
```

**Step 2: Create prisma/schema.prisma**

```prisma
// apps/web/prisma/schema.prisma
generator client {
  provider = "prisma-client"
  output   = "../generated/prisma"
}

datasource db {
  provider = "postgresql"
  schemas  = ["auth", "public"]
}

// Reference to Supabase auth.users - don't manage this table
model users {
  id                 String   @id @db.Uuid
  email              String?  @db.VarChar(255)
  raw_user_meta_data Json?

  // Relations to our tables
  ownedProperties     Property[]     @relation("PropertyOwner")
  createdProperties   Property[]     @relation("PropertyCreatedBy")
  updatedProperties   Property[]     @relation("PropertyUpdatedBy")
  createdSpaces       Space[]        @relation("SpaceCreatedBy")
  updatedSpaces       Space[]        @relation("SpaceUpdatedBy")
  createdItems        Item[]         @relation("ItemCreatedBy")
  updatedItems        Item[]         @relation("ItemUpdatedBy")
  createdEvents       Event[]        @relation("EventCreatedBy")
  updatedEvents       Event[]        @relation("EventUpdatedBy")
  createdDocuments    Document[]     @relation("DocumentCreatedBy")
  createdConversations Conversation[] @relation("ConversationCreatedBy")

  @@schema("auth")
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

  @@index([userId], map: "idx_properties_user_id")
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

  @@index([propertyId], map: "idx_spaces_property_id")
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

  @@index([propertyId], map: "idx_items_property_id")
  @@index([spaceId], map: "idx_items_space_id")
  @@index([parentId], map: "idx_items_parent_id")
  @@index([category], map: "idx_items_category")
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

  @@index([itemId], map: "idx_events_item_id")
  @@index([date], map: "idx_events_date")
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

  @@index([propertyId], map: "idx_documents_property_id")
  @@index([itemId], map: "idx_documents_item_id")
  @@index([status], map: "idx_documents_status")
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

  @@index([propertyId], map: "idx_conversations_property_id")
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

  @@index([conversationId], map: "idx_messages_conversation_id")
  @@map("messages")
  @@schema("public")
}
```

**Step 3: Generate Prisma client**

Run: `cd /Users/don/code/hausdog/apps/web && bunx prisma generate`
Expected: Prisma Client generated to ./generated/prisma

**Step 4: Commit**

```bash
git add apps/web/prisma apps/web/generated
git commit -m "feat: add Prisma schema for Hausdog v2 data model"
```

---

### Task 6: Set Up Database Client

**Files:**
- Create: `apps/web/src/lib/db/client.ts`
- Create: `apps/web/src/lib/db/index.ts`

**Step 1: Create db/client.ts**

```typescript
// apps/web/src/lib/db/client.ts
import { PrismaClient } from '@generated/prisma'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required')
  }

  const adapter = new PrismaPg({ connectionString })
  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```

**Step 2: Create db/index.ts**

```typescript
// apps/web/src/lib/db/index.ts
export { prisma } from './client'
```

**Step 3: Commit**

```bash
git add apps/web/src/lib/db
git commit -m "feat: add Prisma database client setup"
```

---

### Task 7: Set Up Supabase Client and Auth

**Files:**
- Create: `apps/web/src/lib/supabase.ts`
- Create: `apps/web/src/lib/auth.ts`

**Step 1: Install Supabase dependencies**

```bash
cd /Users/don/code/hausdog/apps/web
bun add @supabase/ssr @supabase/supabase-js
```

**Step 2: Create supabase.ts**

```typescript
// apps/web/src/lib/supabase.ts
import { createBrowserClient, createServerClient } from '@supabase/ssr'
import { getCookies, setCookie } from '@tanstack/react-start/server'
import { getServerEnv } from './env'
import { getClientEnv } from './client-env'

/**
 * Creates a Supabase server client for use in server functions and loaders.
 */
export function getSupabaseServerClient() {
  const env = getServerEnv()
  return createServerClient(env.SUPABASE_URL, env.SUPABASE_KEY, {
    cookies: {
      getAll() {
        const cookies = getCookies()
        return Object.entries(cookies).map(([name, value]) => ({
          name,
          value: value ?? '',
        }))
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          setCookie(name, value, options)
        })
      },
    },
  })
}

/**
 * Gets the current session and user from Supabase.
 */
export async function getSafeSession() {
  const supabase = getSupabaseServerClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return { session: null, user: null, error: 'No session found' }
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) {
    return { session, user: null, error: userError.message }
  }

  return { session, user, error: null }
}

/**
 * Creates a Supabase browser client for client-side usage.
 */
export function getSupabaseBrowserClient() {
  const env = getClientEnv()
  return createBrowserClient(env.SUPABASE_URL, env.SUPABASE_KEY)
}
```

**Step 3: Create auth.ts**

```typescript
// apps/web/src/lib/auth.ts
import type { User } from '@supabase/supabase-js'
import { redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getSafeSession } from './supabase'

export type AuthContext = {
  user: User | null
}

function safeSerialize<T>(obj: T): T | null {
  if (!obj) return null
  const seen = new WeakSet()
  return JSON.parse(
    JSON.stringify(obj, (_key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return undefined
        }
        seen.add(value)
      }
      return value
    }),
  )
}

/**
 * Server function to fetch the current session user.
 */
export const fetchSessionUser = createServerFn({ method: 'GET' }).handler(
  async (): Promise<{ user: User | null; error: string | null }> => {
    const sessionResponse = await getSafeSession()

    if (!sessionResponse || !sessionResponse.session) {
      return { user: null, error: 'No session found' }
    }

    return {
      user: safeSerialize(sessionResponse.user),
      error: null,
    }
  },
)

/**
 * Require authentication from route context.
 */
export function requireAuthFromContext(context: { user: User | null }): User {
  if (!context.user) {
    throw redirect({ to: '/login' })
  }
  return context.user
}

/**
 * Server function to sign out.
 */
export const signOut = createServerFn({ method: 'POST' }).handler(async () => {
  const { getSupabaseServerClient } = await import('./supabase')
  const supabase = getSupabaseServerClient()
  await supabase.auth.signOut()
  return { success: true }
})
```

**Step 4: Commit**

```bash
git add apps/web/src/lib
git commit -m "feat: add Supabase client and auth utilities"
```

---

### Task 8: Set Up Logger

**Files:**
- Create: `apps/web/src/lib/logger.ts`

**Step 1: Install winston**

```bash
cd /Users/don/code/hausdog/apps/web
bun add winston @epegzz/winston-dev-console
```

**Step 2: Create logger.ts**

```typescript
// apps/web/src/lib/logger.ts
import winston from 'winston'

const devConsole = process.env.NODE_ENV === 'development'
  ? require('@epegzz/winston-dev-console').default
  : null

export const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    devConsole
      ? new devConsole()
      : new winston.transports.Console({
          format: winston.format.simple(),
        }),
  ],
})
```

**Step 3: Commit**

```bash
git add apps/web/src/lib/logger.ts
git commit -m "feat: add Winston logger configuration"
```

---

### Task 9: Create Root Route and Layout

**Files:**
- Create: `apps/web/src/routes/__root.tsx`
- Create: `apps/web/src/router.tsx`
- Create: `apps/web/src/entry-client.tsx`
- Create: `apps/web/src/entry-server.tsx`

**Step 1: Create router.tsx**

```typescript
// apps/web/src/router.tsx
import { QueryClient } from '@tanstack/react-query'
import { createRouter as createTanStackRouter } from '@tanstack/react-router'
import { routerWithQueryClient } from '@tanstack/react-router-ssr-query'
import { routeTree } from './routeTree.gen'

export function createRouter() {
  const queryClient = new QueryClient()

  return routerWithQueryClient(
    createTanStackRouter({
      routeTree,
      context: { queryClient, user: null },
      defaultPreload: 'intent',
    }),
    queryClient,
  )
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createRouter>
  }
}
```

**Step 2: Create __root.tsx**

```typescript
// apps/web/src/routes/__root.tsx
import type { QueryClient } from '@tanstack/react-query'
import type { User } from '@supabase/supabase-js'
import {
  HeadContent,
  Outlet,
  Scripts,
  createRootRouteWithContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools'
import { fetchSessionUser } from '@/lib/auth'
import '@/styles/globals.css'

interface RouterContext {
  queryClient: QueryClient
  user: User | null
}

export const Route = createRootRouteWithContext<RouterContext>()({
  beforeLoad: async () => {
    const { user } = await fetchSessionUser()
    return { user }
  },
  component: RootComponent,
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { title: 'Hausdog' },
    ],
  }),
})

function RootComponent() {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <Outlet />
        <TanStackRouterDevtools />
        <Scripts />
      </body>
    </html>
  )
}
```

**Step 3: Create entry-client.tsx**

```typescript
// apps/web/src/entry-client.tsx
import { StartClient } from '@tanstack/react-start/client'
import { hydrateRoot } from 'react-dom/client'
import { createRouter } from './router'

const router = createRouter()

hydrateRoot(document, <StartClient router={router} />)
```

**Step 4: Create entry-server.tsx**

```typescript
// apps/web/src/entry-server.tsx
import { getRouterManifest } from '@tanstack/react-start/router-manifest'
import {
  createStartHandler,
  defaultStreamHandler,
} from '@tanstack/react-start/server'
import { createRouter } from './router'

export default createStartHandler({
  createRouter,
  getRouterManifest,
})(defaultStreamHandler)
```

**Step 5: Generate route tree**

Run: `cd /Users/don/code/hausdog/apps/web && bun run build`
Expected: Build generates routeTree.gen.ts

**Step 6: Commit**

```bash
git add apps/web/src
git commit -m "feat: add root route, router setup, and entry points"
```

---

### Task 10: Create Basic Routes (Landing, Login, Auth Callback)

**Files:**
- Create: `apps/web/src/routes/index.tsx`
- Create: `apps/web/src/routes/login.tsx`
- Create: `apps/web/src/routes/auth/callback.tsx`

**Step 1: Create landing page (index.tsx)**

```typescript
// apps/web/src/routes/index.tsx
import { createFileRoute, Link } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'

export const Route = createFileRoute('/')({
  component: LandingPage,
})

function LandingPage() {
  const { user } = Route.useRouteContext()

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-4">Hausdog</h1>
      <p className="text-muted-foreground mb-8 text-center max-w-md">
        The Carfax for your home. Catalog systems, track maintenance, and get AI-powered insights.
      </p>
      {user ? (
        <Button asChild>
          <Link to="/dashboard">Go to Dashboard</Link>
        </Button>
      ) : (
        <Button asChild>
          <Link to="/login">Get Started</Link>
        </Button>
      )}
    </div>
  )
}
```

**Step 2: Create login page**

```typescript
// apps/web/src/routes/login.tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { getSupabaseBrowserClient } from '@/lib/supabase'

export const Route = createFileRoute('/login')({
  component: LoginPage,
})

function LoginPage() {
  const navigate = useNavigate()

  const handleGoogleLogin = async () => {
    const supabase = getSupabaseBrowserClient()
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })
    if (error) {
      console.error('Login error:', error.message)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle className="text-center">Sign in to Hausdog</CardTitle>
        </CardHeader>
        <CardContent>
          <Button onClick={handleGoogleLogin} className="w-full">
            Continue with Google
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
```

**Step 3: Create auth callback**

```typescript
// apps/web/src/routes/auth/callback.tsx
import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { useEffect } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase'

export const Route = createFileRoute('/auth/callback')({
  component: AuthCallback,
})

function AuthCallback() {
  const navigate = useNavigate()

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()

    supabase.auth.onAuthStateChange((event) => {
      if (event === 'SIGNED_IN') {
        navigate({ to: '/dashboard' })
      }
    })
  }, [navigate])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p>Signing you in...</p>
    </div>
  )
}
```

**Step 4: Commit**

```bash
git add apps/web/src/routes
git commit -m "feat: add landing, login, and auth callback routes"
```

---

### Task 11: Create Authenticated Layout

**Files:**
- Create: `apps/web/src/routes/_authenticated.tsx`
- Create: `apps/web/src/routes/_authenticated/dashboard.tsx`
- Create: `apps/web/src/components/layout/header.tsx`

**Step 1: Create header component**

```typescript
// apps/web/src/components/layout/header.tsx
import { Link } from '@tanstack/react-router'
import type { User } from '@supabase/supabase-js'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { signOut } from '@/lib/auth'

interface HeaderProps {
  user: User
}

export function Header({ user }: HeaderProps) {
  const handleSignOut = async () => {
    await signOut()
    window.location.href = '/'
  }

  const displayName = user.user_metadata?.full_name || user.email || 'User'

  return (
    <header className="border-b">
      <div className="container mx-auto px-4 h-16 flex items-center justify-between">
        <Link to="/dashboard" className="text-xl font-bold">
          Hausdog
        </Link>

        <nav className="flex items-center gap-4">
          <Link to="/items" className="text-sm hover:underline">
            Items
          </Link>
          <Link to="/capture" className="text-sm hover:underline">
            Capture
          </Link>
          <Link to="/review" className="text-sm hover:underline">
            Review
          </Link>
          <Link to="/chat" className="text-sm hover:underline">
            Chat
          </Link>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm">
                {displayName}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem asChild>
                <Link to="/settings">Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleSignOut}>
                Sign out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </nav>
      </div>
    </header>
  )
}
```

**Step 2: Create authenticated layout**

```typescript
// apps/web/src/routes/_authenticated.tsx
import { createFileRoute, Outlet } from '@tanstack/react-router'
import { requireAuthFromContext } from '@/lib/auth'
import { Header } from '@/components/layout/header'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ context }) => {
    requireAuthFromContext(context)
  },
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext()

  return (
    <div className="min-h-screen flex flex-col">
      <Header user={user!} />
      <main className="flex-1 container mx-auto px-4 py-8">
        <Outlet />
      </main>
    </div>
  )
}
```

**Step 3: Create dashboard placeholder**

```typescript
// apps/web/src/routes/_authenticated/dashboard.tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: Dashboard,
})

function Dashboard() {
  return (
    <div>
      <h1 className="text-2xl font-bold mb-4">Dashboard</h1>
      <p className="text-muted-foreground">Welcome to Hausdog!</p>
    </div>
  )
}
```

**Step 4: Commit**

```bash
git add apps/web/src
git commit -m "feat: add authenticated layout with header and dashboard"
```

---

### Task 12: Update Makefile and Verify Dev Server

**Files:**
- Modify: `Makefile`

**Step 1: Add apps/web targets to Makefile**

```makefile
# Add to existing Makefile
.PHONY: dev-v2
dev-v2:
	cd apps/web && doppler run -- bun run dev

.PHONY: build-v2
build-v2:
	cd apps/web && bun run build
```

**Step 2: Verify dev server starts**

Run: `cd /Users/don/code/hausdog && make dev-v2`
Expected: Server starts on http://localhost:5173 (or configured port)

**Step 3: Verify in browser**
- Navigate to http://localhost:5173
- Should see landing page
- Click "Get Started" → should redirect to /login
- After login → should see dashboard

**Step 4: Commit**

```bash
git add Makefile
git commit -m "feat: add Makefile targets for v2 app"
```

---

## Phase 2: Core CRUD

### Task 13: Create Services Index and Base Types

**Files:**
- Create: `apps/web/src/lib/services/index.ts`
- Create: `apps/web/src/lib/types.ts`

**Step 1: Create types.ts with constants**

```typescript
// apps/web/src/lib/types.ts
export const ITEM_CATEGORIES = [
  'hvac',
  'plumbing',
  'electrical',
  'appliance',
  'structure',
  'tool',
  'fixture',
  'other',
] as const

export type ItemCategory = (typeof ITEM_CATEGORIES)[number]

export const EVENT_TYPES = [
  'installation',
  'maintenance',
  'repair',
  'inspection',
  'replacement',
  'observation',
] as const

export type EventType = (typeof EVENT_TYPES)[number]

export const DOCUMENT_TYPES = [
  'photo',
  'receipt',
  'manual',
  'warranty',
  'invoice',
] as const

export type DocumentType = (typeof DOCUMENT_TYPES)[number]

export const DOCUMENT_STATUSES = [
  'pending',
  'processing',
  'ready_for_review',
  'confirmed',
  'discarded',
] as const

export type DocumentStatus = (typeof DOCUMENT_STATUSES)[number]

export const PROPERTY_TYPES = [
  'single_family',
  'condo',
  'townhouse',
  'multi_family',
] as const

export type PropertyType = (typeof PROPERTY_TYPES)[number]
```

**Step 2: Create services/index.ts**

```typescript
// apps/web/src/lib/services/index.ts
export { PropertyService } from './properties'
export { SpaceService } from './spaces'
export { ItemService } from './items'
export { EventService } from './events'
export { DocumentService } from './documents'
export { ChatService } from './chat'
```

**Step 3: Commit**

```bash
git add apps/web/src/lib
git commit -m "feat: add shared types and services index"
```

---

### Task 14: Create Property Service

**Files:**
- Create: `apps/web/src/lib/services/properties.ts`

**Step 1: Create properties.ts**

```typescript
// apps/web/src/lib/services/properties.ts
import type { PrismaClient } from '@generated/prisma'
import type { Logger } from 'winston'

interface PropertyCreateInput {
  name: string
  address?: string
  yearBuilt?: number
  squareFeet?: number
  propertyType?: string
  purchaseDate?: Date
}

interface PropertyUpdateInput extends Partial<PropertyCreateInput> {}

export class PropertyService {
  constructor(private deps: { db: PrismaClient; logger: Logger }) {}

  async findByUserId(userId: string) {
    return this.deps.db.property.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findById(id: string, userId: string) {
    return this.deps.db.property.findFirst({
      where: { id, userId },
    })
  }

  async create(userId: string, input: PropertyCreateInput) {
    return this.deps.db.property.create({
      data: {
        ...input,
        userId,
        createdById: userId,
        updatedById: userId,
      },
    })
  }

  async update(id: string, userId: string, input: PropertyUpdateInput) {
    // Verify ownership first
    const existing = await this.findById(id, userId)
    if (!existing) {
      throw new Error('Property not found')
    }

    return this.deps.db.property.update({
      where: { id },
      data: {
        ...input,
        updatedById: userId,
      },
    })
  }

  async delete(id: string, userId: string) {
    const existing = await this.findById(id, userId)
    if (!existing) {
      throw new Error('Property not found')
    }

    return this.deps.db.property.delete({
      where: { id },
    })
  }
}
```

**Step 2: Commit**

```bash
git add apps/web/src/lib/services/properties.ts
git commit -m "feat: add PropertyService"
```

---

### Task 15: Create Property Feature (API, Queries, Mutations)

**Files:**
- Create: `apps/web/src/features/properties/api.ts`
- Create: `apps/web/src/features/properties/queries.ts`
- Create: `apps/web/src/features/properties/mutations.ts`
- Create: `apps/web/src/features/properties/index.ts`

**Step 1: Create api.ts**

```typescript
// apps/web/src/features/properties/api.ts
import { createServerFn } from '@tanstack/react-start'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { PropertyService } from '@/lib/services/properties'

const getService = () => new PropertyService({ db: prisma, logger })

export const fetchProperties = createServerFn({ method: 'GET' })
  .inputValidator((d: { userId: string }) => d)
  .handler(async ({ data }) => {
    return getService().findByUserId(data.userId)
  })

export const fetchProperty = createServerFn({ method: 'GET' })
  .inputValidator((d: { id: string; userId: string }) => d)
  .handler(async ({ data }) => {
    return getService().findById(data.id, data.userId)
  })

export const createProperty = createServerFn({ method: 'POST' })
  .inputValidator(
    (d: {
      userId: string
      name: string
      address?: string
      yearBuilt?: number
      squareFeet?: number
      propertyType?: string
    }) => d,
  )
  .handler(async ({ data }) => {
    const { userId, ...input } = data
    return getService().create(userId, input)
  })

export const updateProperty = createServerFn({ method: 'POST' })
  .inputValidator(
    (d: {
      id: string
      userId: string
      name?: string
      address?: string
      yearBuilt?: number
      squareFeet?: number
      propertyType?: string
    }) => d,
  )
  .handler(async ({ data }) => {
    const { id, userId, ...input } = data
    return getService().update(id, userId, input)
  })

export const deleteProperty = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string; userId: string }) => d)
  .handler(async ({ data }) => {
    return getService().delete(data.id, data.userId)
  })
```

**Step 2: Create queries.ts**

```typescript
// apps/web/src/features/properties/queries.ts
import { queryOptions } from '@tanstack/react-query'
import { fetchProperties, fetchProperty } from './api'

export const propertyKeys = {
  all: ['properties'] as const,
  lists: () => [...propertyKeys.all, 'list'] as const,
  list: (userId: string) => [...propertyKeys.lists(), userId] as const,
  details: () => [...propertyKeys.all, 'detail'] as const,
  detail: (id: string) => [...propertyKeys.details(), id] as const,
}

export const propertiesQuery = (userId: string) =>
  queryOptions({
    queryKey: propertyKeys.list(userId),
    queryFn: () => fetchProperties({ data: { userId } }),
  })

export const propertyQuery = (id: string, userId: string) =>
  queryOptions({
    queryKey: propertyKeys.detail(id),
    queryFn: () => fetchProperty({ data: { id, userId } }),
  })
```

**Step 3: Create mutations.ts**

```typescript
// apps/web/src/features/properties/mutations.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createProperty, updateProperty, deleteProperty } from './api'
import { propertyKeys } from './queries'

export function useCreateProperty() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createProperty,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: propertyKeys.list(variables.data.userId),
      })
    },
  })
}

export function useUpdateProperty() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateProperty,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: propertyKeys.list(variables.data.userId),
      })
      queryClient.invalidateQueries({
        queryKey: propertyKeys.detail(variables.data.id),
      })
    },
  })
}

export function useDeleteProperty() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteProperty,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: propertyKeys.list(variables.data.userId),
      })
    },
  })
}
```

**Step 4: Create index.ts**

```typescript
// apps/web/src/features/properties/index.ts
export * from './api'
export * from './queries'
export * from './mutations'
```

**Step 5: Commit**

```bash
git add apps/web/src/features/properties
git commit -m "feat: add Property feature with API, queries, mutations"
```

---

### Task 16: Create Space Service and Feature

**Files:**
- Create: `apps/web/src/lib/services/spaces.ts`
- Create: `apps/web/src/features/spaces/api.ts`
- Create: `apps/web/src/features/spaces/queries.ts`
- Create: `apps/web/src/features/spaces/mutations.ts`
- Create: `apps/web/src/features/spaces/index.ts`

**Step 1: Create spaces.ts service**

```typescript
// apps/web/src/lib/services/spaces.ts
import type { PrismaClient } from '@generated/prisma'
import type { Logger } from 'winston'

interface SpaceCreateInput {
  propertyId: string
  name: string
}

interface SpaceUpdateInput {
  name?: string
}

export class SpaceService {
  constructor(private deps: { db: PrismaClient; logger: Logger }) {}

  async findByPropertyId(propertyId: string, userId: string) {
    // Verify property ownership
    const property = await this.deps.db.property.findFirst({
      where: { id: propertyId, userId },
    })
    if (!property) {
      throw new Error('Property not found')
    }

    return this.deps.db.space.findMany({
      where: { propertyId },
      orderBy: { name: 'asc' },
    })
  }

  async findById(id: string, userId: string) {
    const space = await this.deps.db.space.findFirst({
      where: { id },
      include: { property: true },
    })
    if (!space || space.property.userId !== userId) {
      return null
    }
    return space
  }

  async create(userId: string, input: SpaceCreateInput) {
    // Verify property ownership
    const property = await this.deps.db.property.findFirst({
      where: { id: input.propertyId, userId },
    })
    if (!property) {
      throw new Error('Property not found')
    }

    return this.deps.db.space.create({
      data: {
        ...input,
        createdById: userId,
        updatedById: userId,
      },
    })
  }

  async update(id: string, userId: string, input: SpaceUpdateInput) {
    const existing = await this.findById(id, userId)
    if (!existing) {
      throw new Error('Space not found')
    }

    return this.deps.db.space.update({
      where: { id },
      data: {
        ...input,
        updatedById: userId,
      },
    })
  }

  async delete(id: string, userId: string) {
    const existing = await this.findById(id, userId)
    if (!existing) {
      throw new Error('Space not found')
    }

    return this.deps.db.space.delete({
      where: { id },
    })
  }
}
```

**Step 2: Create spaces feature files**

```typescript
// apps/web/src/features/spaces/api.ts
import { createServerFn } from '@tanstack/react-start'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { SpaceService } from '@/lib/services/spaces'

const getService = () => new SpaceService({ db: prisma, logger })

export const fetchSpaces = createServerFn({ method: 'GET' })
  .inputValidator((d: { propertyId: string; userId: string }) => d)
  .handler(async ({ data }) => {
    return getService().findByPropertyId(data.propertyId, data.userId)
  })

export const createSpace = createServerFn({ method: 'POST' })
  .inputValidator((d: { userId: string; propertyId: string; name: string }) => d)
  .handler(async ({ data }) => {
    const { userId, ...input } = data
    return getService().create(userId, input)
  })

export const updateSpace = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string; userId: string; name: string }) => d)
  .handler(async ({ data }) => {
    const { id, userId, ...input } = data
    return getService().update(id, userId, input)
  })

export const deleteSpace = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string; userId: string }) => d)
  .handler(async ({ data }) => {
    return getService().delete(data.id, data.userId)
  })
```

```typescript
// apps/web/src/features/spaces/queries.ts
import { queryOptions } from '@tanstack/react-query'
import { fetchSpaces } from './api'

export const spaceKeys = {
  all: ['spaces'] as const,
  lists: () => [...spaceKeys.all, 'list'] as const,
  list: (propertyId: string) => [...spaceKeys.lists(), propertyId] as const,
}

export const spacesQuery = (propertyId: string, userId: string) =>
  queryOptions({
    queryKey: spaceKeys.list(propertyId),
    queryFn: () => fetchSpaces({ data: { propertyId, userId } }),
  })
```

```typescript
// apps/web/src/features/spaces/mutations.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createSpace, updateSpace, deleteSpace } from './api'
import { spaceKeys } from './queries'

export function useCreateSpace() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createSpace,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: spaceKeys.list(variables.data.propertyId),
      })
    },
  })
}

export function useUpdateSpace() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateSpace,
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: spaceKeys.list(data.propertyId),
      })
    },
  })
}

export function useDeleteSpace() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteSpace,
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: spaceKeys.list(data.propertyId),
      })
    },
  })
}
```

```typescript
// apps/web/src/features/spaces/index.ts
export * from './api'
export * from './queries'
export * from './mutations'
```

**Step 3: Commit**

```bash
git add apps/web/src/lib/services/spaces.ts apps/web/src/features/spaces
git commit -m "feat: add Space service and feature"
```

---

### Task 17: Create Item Service and Feature

**Files:**
- Create: `apps/web/src/lib/services/items.ts`
- Create: `apps/web/src/features/items/api.ts`
- Create: `apps/web/src/features/items/queries.ts`
- Create: `apps/web/src/features/items/mutations.ts`
- Create: `apps/web/src/features/items/index.ts`

**Step 1: Create items.ts service**

```typescript
// apps/web/src/lib/services/items.ts
import type { PrismaClient, Prisma } from '@generated/prisma'
import type { Logger } from 'winston'

interface ItemCreateInput {
  propertyId: string
  spaceId?: string
  parentId?: string
  name: string
  category: string
  manufacturer?: string
  model?: string
  serialNumber?: string
  acquiredDate?: Date
  warrantyExpires?: Date
  purchasePrice?: number
  notes?: string
}

interface ItemUpdateInput extends Partial<Omit<ItemCreateInput, 'propertyId'>> {}

export class ItemService {
  constructor(private deps: { db: PrismaClient; logger: Logger }) {}

  private buildSearchText(item: ItemCreateInput | ItemUpdateInput & { name: string }): string {
    const parts = [
      item.name,
      item.manufacturer,
      item.model,
      item.serialNumber,
      item.notes,
    ].filter(Boolean)
    return parts.join(' ')
  }

  async findByPropertyId(propertyId: string, userId: string) {
    const property = await this.deps.db.property.findFirst({
      where: { id: propertyId, userId },
    })
    if (!property) {
      throw new Error('Property not found')
    }

    return this.deps.db.item.findMany({
      where: { propertyId },
      include: {
        space: true,
        parent: true,
        _count: { select: { children: true, events: true, documents: true } },
      },
      orderBy: { name: 'asc' },
    })
  }

  async findById(id: string, userId: string) {
    const item = await this.deps.db.item.findFirst({
      where: { id },
      include: {
        property: true,
        space: true,
        parent: true,
        children: true,
        events: { orderBy: { date: 'desc' }, take: 10 },
        documents: { orderBy: { createdAt: 'desc' } },
      },
    })
    if (!item || item.property.userId !== userId) {
      return null
    }
    return item
  }

  async create(userId: string, input: ItemCreateInput) {
    const property = await this.deps.db.property.findFirst({
      where: { id: input.propertyId, userId },
    })
    if (!property) {
      throw new Error('Property not found')
    }

    const searchText = this.buildSearchText(input)

    return this.deps.db.item.create({
      data: {
        ...input,
        purchasePrice: input.purchasePrice ? new Prisma.Decimal(input.purchasePrice) : null,
        searchText,
        createdById: userId,
        updatedById: userId,
      },
    })
  }

  async update(id: string, userId: string, input: ItemUpdateInput) {
    const existing = await this.findById(id, userId)
    if (!existing) {
      throw new Error('Item not found')
    }

    const updatedItem = { ...existing, ...input }
    const searchText = this.buildSearchText({ name: updatedItem.name, ...input })

    return this.deps.db.item.update({
      where: { id },
      data: {
        ...input,
        purchasePrice: input.purchasePrice !== undefined
          ? (input.purchasePrice ? new Prisma.Decimal(input.purchasePrice) : null)
          : undefined,
        searchText,
        updatedById: userId,
      },
    })
  }

  async delete(id: string, userId: string) {
    const existing = await this.findById(id, userId)
    if (!existing) {
      throw new Error('Item not found')
    }

    return this.deps.db.item.delete({
      where: { id },
    })
  }

  async search(propertyId: string, userId: string, query: string) {
    const property = await this.deps.db.property.findFirst({
      where: { id: propertyId, userId },
    })
    if (!property) {
      throw new Error('Property not found')
    }

    return this.deps.db.item.findMany({
      where: {
        propertyId,
        searchText: { contains: query, mode: 'insensitive' },
      },
      include: { space: true },
      orderBy: { name: 'asc' },
      take: 20,
    })
  }
}
```

**Step 2: Create items feature files**

```typescript
// apps/web/src/features/items/api.ts
import { createServerFn } from '@tanstack/react-start'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { ItemService } from '@/lib/services/items'

const getService = () => new ItemService({ db: prisma, logger })

export const fetchItems = createServerFn({ method: 'GET' })
  .inputValidator((d: { propertyId: string; userId: string }) => d)
  .handler(async ({ data }) => {
    return getService().findByPropertyId(data.propertyId, data.userId)
  })

export const fetchItem = createServerFn({ method: 'GET' })
  .inputValidator((d: { id: string; userId: string }) => d)
  .handler(async ({ data }) => {
    return getService().findById(data.id, data.userId)
  })

export const createItem = createServerFn({ method: 'POST' })
  .inputValidator(
    (d: {
      userId: string
      propertyId: string
      name: string
      category: string
      spaceId?: string
      parentId?: string
      manufacturer?: string
      model?: string
      serialNumber?: string
      acquiredDate?: string
      warrantyExpires?: string
      purchasePrice?: number
      notes?: string
    }) => d,
  )
  .handler(async ({ data }) => {
    const { userId, acquiredDate, warrantyExpires, ...input } = data
    return getService().create(userId, {
      ...input,
      acquiredDate: acquiredDate ? new Date(acquiredDate) : undefined,
      warrantyExpires: warrantyExpires ? new Date(warrantyExpires) : undefined,
    })
  })

export const updateItem = createServerFn({ method: 'POST' })
  .inputValidator(
    (d: {
      id: string
      userId: string
      name?: string
      category?: string
      spaceId?: string
      parentId?: string
      manufacturer?: string
      model?: string
      serialNumber?: string
      acquiredDate?: string
      warrantyExpires?: string
      purchasePrice?: number
      notes?: string
    }) => d,
  )
  .handler(async ({ data }) => {
    const { id, userId, acquiredDate, warrantyExpires, ...input } = data
    return getService().update(id, userId, {
      ...input,
      acquiredDate: acquiredDate ? new Date(acquiredDate) : undefined,
      warrantyExpires: warrantyExpires ? new Date(warrantyExpires) : undefined,
    })
  })

export const deleteItem = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string; userId: string }) => d)
  .handler(async ({ data }) => {
    return getService().delete(data.id, data.userId)
  })

export const searchItems = createServerFn({ method: 'GET' })
  .inputValidator((d: { propertyId: string; userId: string; query: string }) => d)
  .handler(async ({ data }) => {
    return getService().search(data.propertyId, data.userId, data.query)
  })
```

```typescript
// apps/web/src/features/items/queries.ts
import { queryOptions } from '@tanstack/react-query'
import { fetchItems, fetchItem, searchItems } from './api'

export const itemKeys = {
  all: ['items'] as const,
  lists: () => [...itemKeys.all, 'list'] as const,
  list: (propertyId: string) => [...itemKeys.lists(), propertyId] as const,
  details: () => [...itemKeys.all, 'detail'] as const,
  detail: (id: string) => [...itemKeys.details(), id] as const,
  search: (propertyId: string, query: string) =>
    [...itemKeys.all, 'search', propertyId, query] as const,
}

export const itemsQuery = (propertyId: string, userId: string) =>
  queryOptions({
    queryKey: itemKeys.list(propertyId),
    queryFn: () => fetchItems({ data: { propertyId, userId } }),
  })

export const itemQuery = (id: string, userId: string) =>
  queryOptions({
    queryKey: itemKeys.detail(id),
    queryFn: () => fetchItem({ data: { id, userId } }),
  })

export const itemSearchQuery = (propertyId: string, userId: string, query: string) =>
  queryOptions({
    queryKey: itemKeys.search(propertyId, query),
    queryFn: () => searchItems({ data: { propertyId, userId, query } }),
    enabled: query.length > 0,
  })
```

```typescript
// apps/web/src/features/items/mutations.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createItem, updateItem, deleteItem } from './api'
import { itemKeys } from './queries'

export function useCreateItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createItem,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: itemKeys.list(variables.data.propertyId),
      })
    },
  })
}

export function useUpdateItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateItem,
    onSuccess: (data, variables) => {
      queryClient.invalidateQueries({
        queryKey: itemKeys.list(data.propertyId),
      })
      queryClient.invalidateQueries({
        queryKey: itemKeys.detail(variables.data.id),
      })
    },
  })
}

export function useDeleteItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteItem,
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: itemKeys.list(data.propertyId),
      })
    },
  })
}
```

```typescript
// apps/web/src/features/items/index.ts
export * from './api'
export * from './queries'
export * from './mutations'
```

**Step 3: Commit**

```bash
git add apps/web/src/lib/services/items.ts apps/web/src/features/items
git commit -m "feat: add Item service and feature with search"
```

---

### Task 18: Create Event Service and Feature

**Files:**
- Create: `apps/web/src/lib/services/events.ts`
- Create: `apps/web/src/features/events/api.ts`
- Create: `apps/web/src/features/events/queries.ts`
- Create: `apps/web/src/features/events/mutations.ts`
- Create: `apps/web/src/features/events/index.ts`

**Step 1: Create events.ts service**

```typescript
// apps/web/src/lib/services/events.ts
import type { PrismaClient, Prisma } from '@generated/prisma'
import type { Logger } from 'winston'

interface EventCreateInput {
  itemId: string
  type: string
  date: Date
  description?: string
  cost?: number
  performedBy?: string
}

interface EventUpdateInput extends Partial<Omit<EventCreateInput, 'itemId'>> {}

export class EventService {
  constructor(private deps: { db: PrismaClient; logger: Logger }) {}

  private async verifyItemOwnership(itemId: string, userId: string) {
    const item = await this.deps.db.item.findFirst({
      where: { id: itemId },
      include: { property: true },
    })
    if (!item || item.property.userId !== userId) {
      throw new Error('Item not found')
    }
    return item
  }

  async findByItemId(itemId: string, userId: string) {
    await this.verifyItemOwnership(itemId, userId)

    return this.deps.db.event.findMany({
      where: { itemId },
      include: { documents: true },
      orderBy: { date: 'desc' },
    })
  }

  async findById(id: string, userId: string) {
    const event = await this.deps.db.event.findFirst({
      where: { id },
      include: {
        item: { include: { property: true } },
        documents: true,
      },
    })
    if (!event || event.item.property.userId !== userId) {
      return null
    }
    return event
  }

  async create(userId: string, input: EventCreateInput) {
    await this.verifyItemOwnership(input.itemId, userId)

    return this.deps.db.event.create({
      data: {
        ...input,
        cost: input.cost ? new Prisma.Decimal(input.cost) : null,
        createdById: userId,
        updatedById: userId,
      },
    })
  }

  async update(id: string, userId: string, input: EventUpdateInput) {
    const existing = await this.findById(id, userId)
    if (!existing) {
      throw new Error('Event not found')
    }

    return this.deps.db.event.update({
      where: { id },
      data: {
        ...input,
        cost: input.cost !== undefined
          ? (input.cost ? new Prisma.Decimal(input.cost) : null)
          : undefined,
        updatedById: userId,
      },
    })
  }

  async delete(id: string, userId: string) {
    const existing = await this.findById(id, userId)
    if (!existing) {
      throw new Error('Event not found')
    }

    return this.deps.db.event.delete({
      where: { id },
    })
  }
}
```

**Step 2: Create events feature files**

```typescript
// apps/web/src/features/events/api.ts
import { createServerFn } from '@tanstack/react-start'
import { prisma } from '@/lib/db'
import { logger } from '@/lib/logger'
import { EventService } from '@/lib/services/events'

const getService = () => new EventService({ db: prisma, logger })

export const fetchEvents = createServerFn({ method: 'GET' })
  .inputValidator((d: { itemId: string; userId: string }) => d)
  .handler(async ({ data }) => {
    return getService().findByItemId(data.itemId, data.userId)
  })

export const createEvent = createServerFn({ method: 'POST' })
  .inputValidator(
    (d: {
      userId: string
      itemId: string
      type: string
      date: string
      description?: string
      cost?: number
      performedBy?: string
    }) => d,
  )
  .handler(async ({ data }) => {
    const { userId, date, ...input } = data
    return getService().create(userId, {
      ...input,
      date: new Date(date),
    })
  })

export const updateEvent = createServerFn({ method: 'POST' })
  .inputValidator(
    (d: {
      id: string
      userId: string
      type?: string
      date?: string
      description?: string
      cost?: number
      performedBy?: string
    }) => d,
  )
  .handler(async ({ data }) => {
    const { id, userId, date, ...input } = data
    return getService().update(id, userId, {
      ...input,
      date: date ? new Date(date) : undefined,
    })
  })

export const deleteEvent = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string; userId: string }) => d)
  .handler(async ({ data }) => {
    return getService().delete(data.id, data.userId)
  })
```

```typescript
// apps/web/src/features/events/queries.ts
import { queryOptions } from '@tanstack/react-query'
import { fetchEvents } from './api'

export const eventKeys = {
  all: ['events'] as const,
  lists: () => [...eventKeys.all, 'list'] as const,
  list: (itemId: string) => [...eventKeys.lists(), itemId] as const,
}

export const eventsQuery = (itemId: string, userId: string) =>
  queryOptions({
    queryKey: eventKeys.list(itemId),
    queryFn: () => fetchEvents({ data: { itemId, userId } }),
  })
```

```typescript
// apps/web/src/features/events/mutations.ts
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createEvent, updateEvent, deleteEvent } from './api'
import { eventKeys } from './queries'
import { itemKeys } from '@/features/items/queries'

export function useCreateEvent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: createEvent,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: eventKeys.list(variables.data.itemId),
      })
      // Also invalidate item detail to update event count
      queryClient.invalidateQueries({
        queryKey: itemKeys.detail(variables.data.itemId),
      })
    },
  })
}

export function useUpdateEvent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: updateEvent,
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: eventKeys.list(data.itemId),
      })
    },
  })
}

export function useDeleteEvent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: deleteEvent,
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: eventKeys.list(data.itemId),
      })
      queryClient.invalidateQueries({
        queryKey: itemKeys.detail(data.itemId),
      })
    },
  })
}
```

```typescript
// apps/web/src/features/events/index.ts
export * from './api'
export * from './queries'
export * from './mutations'
```

**Step 3: Commit**

```bash
git add apps/web/src/lib/services/events.ts apps/web/src/features/events
git commit -m "feat: add Event service and feature"
```

---

## Remaining Tasks (Summary)

The plan continues with these phases:

### Phase 3: Document Pipeline (Tasks 19-26)
- Task 19: Create Document Service
- Task 20: Create Document Feature (API, Queries, Mutations)
- Task 21: Create Document Upload UI
- Task 22: Set Up Trigger.dev
- Task 23: Create Gemini Extraction Logic
- Task 24: Create Claude Resolution Logic
- Task 25: Create Trigger.dev Process Document Job
- Task 26: Create Review Queue UI

### Phase 4: UI Routes (Tasks 27-33)
- Task 27: Create Items List Page
- Task 28: Create Item Detail Page
- Task 29: Create Capture Page
- Task 30: Create Spaces Page
- Task 31: Create Settings Page
- Task 32: Update Dashboard with Stats
- Task 33: Create Full-Text Search Index Migration

### Phase 5: Chat (Tasks 34-38)
- Task 34: Create Chat Service
- Task 35: Create Chat Feature (API, Queries, Mutations)
- Task 36: Create Chat UI Components
- Task 37: Create Chat Routes
- Task 38: Final Integration Testing

---

## Execution Notes

**Reusable code from existing app:**
- `hausdog-web/src/lib/auth.ts` → adapted in Task 7
- `hausdog-web/src/lib/supabase.ts` → adapted in Task 7
- `hausdog-web/src/lib/db/client.ts` → adapted in Task 6
- `hausdog-web/src/lib/env.server.ts` → adapted in Task 4
- `hausdog-web/src/components/ui/*.tsx` → copied in Task 3
- `hausdog-web/src/features/documents/upload.ts` → adapt for Task 20
- `hausdog-web/src/features/documents/extract.ts` → adapt for Task 23

**Database migrations:**
After schema changes, run:
```bash
cd apps/web && doppler run -- bunx prisma db push
```

**Testing each phase:**
After completing each phase, verify with:
1. `bun run build` - compiles
2. `doppler run -- bun run dev` - runs
3. Manual testing in browser
