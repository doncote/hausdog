# Hausdog CLI Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build a Go CLI and REST API that enables LLM agents to interact with Hausdog data.

**Architecture:** Hono API layer in the web app exposes existing services via REST endpoints with OpenAPI spec. Go CLI uses generated HTTP client from the spec. API key auth for stateless agent access.

**Tech Stack:** Hono + @hono/zod-openapi, Cobra, oapi-codegen, Prisma, Zod

---

## Phase 1: API Foundation

### Task 1: Add Hono and OpenAPI Dependencies

**Files:**
- Modify: `apps/web/package.json`

**Step 1: Install dependencies**

Run:
```bash
cd apps/web && bun add hono @hono/zod-openapi
```

**Step 2: Verify installation**

Run:
```bash
cd apps/web && bun pm ls | grep hono
```

Expected: Shows `hono` and `@hono/zod-openapi` in output

**Step 3: Commit**

```bash
git add apps/web/package.json apps/web/bun.lock
git commit -m "chore: add hono and zod-openapi dependencies"
```

---

### Task 2: Add ApiKey Model to Prisma Schema

**Files:**
- Modify: `apps/web/prisma/schema.prisma`

**Step 1: Add ApiKey model**

Add at the end of `apps/web/prisma/schema.prisma`:

```prisma
model ApiKey {
  id         String    @id @default(uuid())
  userId     String    @map("user_id") @db.Uuid
  name       String
  keyHash    String    @unique @map("key_hash")
  lastUsedAt DateTime? @map("last_used_at")
  createdAt  DateTime  @default(now()) @map("created_at")

  @@index([keyHash])
  @@map("api_keys")
}
```

**Step 2: Generate Prisma client**

Run:
```bash
cd apps/web && bunx prisma generate
```

Expected: "Generated Prisma Client"

**Step 3: Create migration**

Run:
```bash
cd apps/web && bunx prisma migrate dev --name add_api_keys
```

Expected: Migration created and applied

**Step 4: Commit**

```bash
git add apps/web/prisma/
git commit -m "feat: add ApiKey model for CLI authentication"
```

---

### Task 3: Create API Key Service

**Files:**
- Create: `apps/web/src/features/api-keys/types.ts`
- Create: `apps/web/src/features/api-keys/service.ts`

**Step 1: Create types file**

Create `apps/web/src/features/api-keys/types.ts`:

```typescript
import { z } from 'zod'

export const CreateApiKeySchema = z.object({
  name: z.string().min(1, 'Name is required'),
})

export type CreateApiKeyInput = z.infer<typeof CreateApiKeySchema>

export interface ApiKey {
  id: string
  userId: string
  name: string
  lastUsedAt: Date | null
  createdAt: Date
}

export interface ApiKeyWithPlainKey extends ApiKey {
  plainKey: string
}
```

**Step 2: Create service file**

Create `apps/web/src/features/api-keys/service.ts`:

```typescript
import type { PrismaClient, ApiKey as PrismaApiKey } from '@generated/prisma/client'
import type { Logger } from '@/lib/logger'
import crypto from 'node:crypto'
import type { ApiKey, ApiKeyWithPlainKey, CreateApiKeyInput } from './types'

export interface ApiKeyServiceDeps {
  db: PrismaClient
  logger: Logger
}

export class ApiKeyService {
  private db: PrismaClient
  private logger: Logger

  constructor(deps: ApiKeyServiceDeps) {
    this.db = deps.db
    this.logger = deps.logger
  }

  async create(userId: string, input: CreateApiKeyInput): Promise<ApiKeyWithPlainKey> {
    this.logger.info('Creating API key', { userId, name: input.name })

    const plainKey = this.generateKey()
    const keyHash = this.hashKey(plainKey)

    const record = await this.db.apiKey.create({
      data: {
        userId,
        name: input.name,
        keyHash,
      },
    })

    return {
      ...this.toDomain(record),
      plainKey,
    }
  }

  async findByKey(plainKey: string): Promise<ApiKey | null> {
    const keyHash = this.hashKey(plainKey)
    const record = await this.db.apiKey.findUnique({
      where: { keyHash },
    })
    return record ? this.toDomain(record) : null
  }

  async validateAndGetUserId(plainKey: string): Promise<string | null> {
    const keyHash = this.hashKey(plainKey)
    const record = await this.db.apiKey.findUnique({
      where: { keyHash },
    })

    if (!record) {
      return null
    }

    // Update last used timestamp
    await this.db.apiKey.update({
      where: { id: record.id },
      data: { lastUsedAt: new Date() },
    })

    return record.userId
  }

  async findAllForUser(userId: string): Promise<ApiKey[]> {
    const records = await this.db.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })
    return records.map((r) => this.toDomain(r))
  }

  async delete(id: string, userId: string): Promise<void> {
    this.logger.info('Deleting API key', { id, userId })
    await this.db.apiKey.delete({
      where: { id },
    })
  }

  private generateKey(): string {
    const bytes = crypto.randomBytes(32)
    const base62 = bytes.toString('base64url').replace(/[_-]/g, '')
    return `hd_${base62.slice(0, 32)}`
  }

  private hashKey(key: string): string {
    return crypto.createHash('sha256').update(key).digest('hex')
  }

  private toDomain(record: PrismaApiKey): ApiKey {
    return {
      id: record.id,
      userId: record.userId,
      name: record.name,
      lastUsedAt: record.lastUsedAt,
      createdAt: record.createdAt,
    }
  }
}
```

**Step 3: Commit**

```bash
git add apps/web/src/features/api-keys/
git commit -m "feat: add ApiKeyService for CLI authentication"
```

---

### Task 4: Create Hono API App with Auth Middleware

**Files:**
- Create: `apps/web/src/api/middleware/auth.ts`
- Create: `apps/web/src/api/index.ts`

**Step 1: Create auth middleware**

Create `apps/web/src/api/middleware/auth.ts`:

```typescript
import type { Context, Next } from 'hono'
import type { PrismaClient } from '@generated/prisma/client'
import type { Logger } from '@/lib/logger'
import { ApiKeyService } from '@/features/api-keys/service'

export interface AuthContext {
  userId: string
}

export function createAuthMiddleware(db: PrismaClient, logger: Logger) {
  const apiKeyService = new ApiKeyService({ db, logger })

  return async (c: Context, next: Next) => {
    const authHeader = c.req.header('Authorization')

    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Missing or invalid Authorization header' }, 401)
    }

    const apiKey = authHeader.slice(7)

    if (!apiKey.startsWith('hd_')) {
      return c.json({ error: 'Invalid API key format' }, 401)
    }

    const userId = await apiKeyService.validateAndGetUserId(apiKey)

    if (!userId) {
      return c.json({ error: 'Invalid API key' }, 401)
    }

    c.set('userId', userId)
    await next()
  }
}
```

**Step 2: Create main API app**

Create `apps/web/src/api/index.ts`:

```typescript
import { OpenAPIHono } from '@hono/zod-openapi'
import type { PrismaClient } from '@generated/prisma/client'
import type { Logger } from '@/lib/logger'
import { createAuthMiddleware } from './middleware/auth'

export type ApiEnv = {
  Variables: {
    userId: string
  }
}

export function createApiApp(db: PrismaClient, logger: Logger) {
  const app = new OpenAPIHono<ApiEnv>()

  // Apply auth middleware to all routes
  app.use('/*', createAuthMiddleware(db, logger))

  // Health check (no auth required, so add before middleware)
  app.get('/health', (c) => c.json({ status: 'ok' }))

  // OpenAPI spec endpoint
  app.doc('/openapi.json', {
    openapi: '3.1.0',
    info: {
      title: 'Hausdog API',
      version: '1.0.0',
      description: 'API for Hausdog home documentation management',
    },
  })

  return app
}
```

**Step 3: Commit**

```bash
git add apps/web/src/api/
git commit -m "feat: add Hono API app with auth middleware"
```

---

### Task 5: Mount Hono API in TanStack Start

**Files:**
- Create: `apps/web/src/routes/api/v1/$.tsx`

**Step 1: Create catch-all route**

Create `apps/web/src/routes/api/v1/$.tsx`:

```typescript
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/v1/$')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { prisma } = await import('@/lib/db/client')
        const { logger } = await import('@/lib/logger')
        const { createApiApp } = await import('@/api/index')

        const app = createApiApp(prisma, logger)
        return app.fetch(request)
      },
      POST: async ({ request }) => {
        const { prisma } = await import('@/lib/db/client')
        const { logger } = await import('@/lib/logger')
        const { createApiApp } = await import('@/api/index')

        const app = createApiApp(prisma, logger)
        return app.fetch(request)
      },
      PATCH: async ({ request }) => {
        const { prisma } = await import('@/lib/db/client')
        const { logger } = await import('@/lib/logger')
        const { createApiApp } = await import('@/api/index')

        const app = createApiApp(prisma, logger)
        return app.fetch(request)
      },
      DELETE: async ({ request }) => {
        const { prisma } = await import('@/lib/db/client')
        const { logger } = await import('@/lib/logger')
        const { createApiApp } = await import('@/api/index')

        const app = createApiApp(prisma, logger)
        return app.fetch(request)
      },
    },
  },
})
```

**Step 2: Test the mount**

Run dev server and test health endpoint:
```bash
cd apps/web && doppler run -- bun run dev &
sleep 5
curl http://localhost:3333/api/v1/health
```

Expected: `{"status":"ok"}`

**Step 3: Commit**

```bash
git add apps/web/src/routes/api/v1/
git commit -m "feat: mount Hono API at /api/v1"
```

---

## Phase 2: API Routes

### Task 6: Create Properties API Routes

**Files:**
- Create: `apps/web/src/api/routes/properties.ts`
- Modify: `apps/web/src/api/index.ts`

**Step 1: Create properties routes**

Create `apps/web/src/api/routes/properties.ts`:

```typescript
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { PrismaClient } from '@generated/prisma/client'
import type { Logger } from '@/lib/logger'
import { PropertyService } from '@/features/properties/service'
import type { ApiEnv } from '../index'

const PropertySchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string(),
  streetAddress: z.string().nullable(),
  city: z.string().nullable(),
  state: z.string().nullable(),
  postalCode: z.string().nullable(),
  country: z.string().nullable(),
  formattedAddress: z.string().nullable(),
  yearBuilt: z.number().nullable(),
  squareFeet: z.number().nullable(),
  bedrooms: z.number().nullable(),
  bathrooms: z.number().nullable(),
  propertyType: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const CreatePropertySchema = z.object({
  name: z.string().min(1),
  streetAddress: z.string().optional(),
  city: z.string().optional(),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().optional(),
  formattedAddress: z.string().optional(),
  yearBuilt: z.number().int().optional(),
  squareFeet: z.number().int().optional(),
  bedrooms: z.number().int().optional(),
  bathrooms: z.number().optional(),
  propertyType: z.string().optional(),
})

const UpdatePropertySchema = CreatePropertySchema.partial()

const ErrorSchema = z.object({
  error: z.string(),
})

export function createPropertiesRoutes(db: PrismaClient, logger: Logger) {
  const app = new OpenAPIHono<ApiEnv>()
  const service = new PropertyService({ db, logger })

  // List properties
  const listRoute = createRoute({
    method: 'get',
    path: '/',
    responses: {
      200: {
        description: 'List of properties',
        content: { 'application/json': { schema: z.array(PropertySchema) } },
      },
    },
  })

  app.openapi(listRoute, async (c) => {
    const userId = c.get('userId')
    const properties = await service.findAllForUser(userId)
    return c.json(properties.map((p) => ({
      ...p,
      createdAt: p.createdAt.toISOString(),
      updatedAt: p.updatedAt.toISOString(),
    })))
  })

  // Get property
  const getRoute = createRoute({
    method: 'get',
    path: '/{id}',
    request: {
      params: z.object({ id: z.string().uuid() }),
    },
    responses: {
      200: {
        description: 'Property details',
        content: { 'application/json': { schema: PropertySchema } },
      },
      404: {
        description: 'Property not found',
        content: { 'application/json': { schema: ErrorSchema } },
      },
    },
  })

  app.openapi(getRoute, async (c) => {
    const userId = c.get('userId')
    const { id } = c.req.valid('param')
    const property = await service.findById(id, userId)
    if (!property) {
      return c.json({ error: 'Property not found' }, 404)
    }
    return c.json({
      ...property,
      createdAt: property.createdAt.toISOString(),
      updatedAt: property.updatedAt.toISOString(),
    })
  })

  // Create property
  const createRoute = createRoute({
    method: 'post',
    path: '/',
    request: {
      body: { content: { 'application/json': { schema: CreatePropertySchema } } },
    },
    responses: {
      201: {
        description: 'Property created',
        content: { 'application/json': { schema: PropertySchema } },
      },
    },
  })

  app.openapi(createRoute, async (c) => {
    const userId = c.get('userId')
    const input = c.req.valid('json')
    const property = await service.create(userId, input)
    return c.json({
      ...property,
      createdAt: property.createdAt.toISOString(),
      updatedAt: property.updatedAt.toISOString(),
    }, 201)
  })

  // Update property
  const updateRoute = createRoute({
    method: 'patch',
    path: '/{id}',
    request: {
      params: z.object({ id: z.string().uuid() }),
      body: { content: { 'application/json': { schema: UpdatePropertySchema } } },
    },
    responses: {
      200: {
        description: 'Property updated',
        content: { 'application/json': { schema: PropertySchema } },
      },
      404: {
        description: 'Property not found',
        content: { 'application/json': { schema: ErrorSchema } },
      },
    },
  })

  app.openapi(updateRoute, async (c) => {
    const userId = c.get('userId')
    const { id } = c.req.valid('param')
    const input = c.req.valid('json')

    const existing = await service.findById(id, userId)
    if (!existing) {
      return c.json({ error: 'Property not found' }, 404)
    }

    const property = await service.update(id, userId, input)
    return c.json({
      ...property,
      createdAt: property.createdAt.toISOString(),
      updatedAt: property.updatedAt.toISOString(),
    })
  })

  // Delete property
  const deleteRoute = createRoute({
    method: 'delete',
    path: '/{id}',
    request: {
      params: z.object({ id: z.string().uuid() }),
    },
    responses: {
      204: { description: 'Property deleted' },
      404: {
        description: 'Property not found',
        content: { 'application/json': { schema: ErrorSchema } },
      },
    },
  })

  app.openapi(deleteRoute, async (c) => {
    const userId = c.get('userId')
    const { id } = c.req.valid('param')

    const existing = await service.findById(id, userId)
    if (!existing) {
      return c.json({ error: 'Property not found' }, 404)
    }

    await service.delete(id, userId)
    return c.body(null, 204)
  })

  return app
}
```

**Step 2: Mount properties routes in main app**

Update `apps/web/src/api/index.ts`:

```typescript
import { OpenAPIHono } from '@hono/zod-openapi'
import type { PrismaClient } from '@generated/prisma/client'
import type { Logger } from '@/lib/logger'
import { createAuthMiddleware } from './middleware/auth'
import { createPropertiesRoutes } from './routes/properties'

export type ApiEnv = {
  Variables: {
    userId: string
  }
}

export function createApiApp(db: PrismaClient, logger: Logger) {
  const app = new OpenAPIHono<ApiEnv>()

  // Health check (before auth middleware)
  app.get('/health', (c) => c.json({ status: 'ok' }))

  // Apply auth middleware to all other routes
  app.use('/*', createAuthMiddleware(db, logger))

  // Mount routes
  app.route('/properties', createPropertiesRoutes(db, logger))

  // OpenAPI spec endpoint
  app.doc('/openapi.json', {
    openapi: '3.1.0',
    info: {
      title: 'Hausdog API',
      version: '1.0.0',
      description: 'API for Hausdog home documentation management',
    },
  })

  return app
}
```

**Step 3: Commit**

```bash
git add apps/web/src/api/
git commit -m "feat: add properties API routes"
```

---

### Task 7: Create Spaces API Routes

**Files:**
- Create: `apps/web/src/api/routes/spaces.ts`
- Modify: `apps/web/src/api/index.ts`

**Step 1: Create spaces routes**

Create `apps/web/src/api/routes/spaces.ts`:

```typescript
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { PrismaClient } from '@generated/prisma/client'
import type { Logger } from '@/lib/logger'
import { SpaceService } from '@/features/spaces/service'
import { PropertyService } from '@/features/properties/service'
import type { ApiEnv } from '../index'

const SpaceSchema = z.object({
  id: z.string().uuid(),
  propertyId: z.string().uuid(),
  name: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
  _count: z.object({ items: z.number() }).optional(),
})

const CreateSpaceSchema = z.object({
  name: z.string().min(1),
})

const UpdateSpaceSchema = CreateSpaceSchema.partial()

const ErrorSchema = z.object({
  error: z.string(),
})

export function createSpacesRoutes(db: PrismaClient, logger: Logger) {
  const app = new OpenAPIHono<ApiEnv>()
  const service = new SpaceService({ db, logger })
  const propertyService = new PropertyService({ db, logger })

  // List spaces for property
  const listRoute = createRoute({
    method: 'get',
    path: '/properties/{propertyId}/spaces',
    request: {
      params: z.object({ propertyId: z.string().uuid() }),
    },
    responses: {
      200: {
        description: 'List of spaces',
        content: { 'application/json': { schema: z.array(SpaceSchema) } },
      },
      404: {
        description: 'Property not found',
        content: { 'application/json': { schema: ErrorSchema } },
      },
    },
  })

  app.openapi(listRoute, async (c) => {
    const userId = c.get('userId')
    const { propertyId } = c.req.valid('param')

    const property = await propertyService.findById(propertyId, userId)
    if (!property) {
      return c.json({ error: 'Property not found' }, 404)
    }

    const spaces = await service.findAllForProperty(propertyId)
    return c.json(spaces.map((s) => ({
      ...s,
      createdAt: s.createdAt.toISOString(),
      updatedAt: s.updatedAt.toISOString(),
    })))
  })

  // Get space
  const getRoute = createRoute({
    method: 'get',
    path: '/spaces/{id}',
    request: {
      params: z.object({ id: z.string().uuid() }),
    },
    responses: {
      200: {
        description: 'Space details',
        content: { 'application/json': { schema: SpaceSchema } },
      },
      404: {
        description: 'Space not found',
        content: { 'application/json': { schema: ErrorSchema } },
      },
    },
  })

  app.openapi(getRoute, async (c) => {
    const { id } = c.req.valid('param')
    const space = await service.findById(id)
    if (!space) {
      return c.json({ error: 'Space not found' }, 404)
    }
    return c.json({
      ...space,
      createdAt: space.createdAt.toISOString(),
      updatedAt: space.updatedAt.toISOString(),
    })
  })

  // Create space
  const createRoute = createRoute({
    method: 'post',
    path: '/properties/{propertyId}/spaces',
    request: {
      params: z.object({ propertyId: z.string().uuid() }),
      body: { content: { 'application/json': { schema: CreateSpaceSchema } } },
    },
    responses: {
      201: {
        description: 'Space created',
        content: { 'application/json': { schema: SpaceSchema } },
      },
      404: {
        description: 'Property not found',
        content: { 'application/json': { schema: ErrorSchema } },
      },
    },
  })

  app.openapi(createRoute, async (c) => {
    const userId = c.get('userId')
    const { propertyId } = c.req.valid('param')
    const input = c.req.valid('json')

    const property = await propertyService.findById(propertyId, userId)
    if (!property) {
      return c.json({ error: 'Property not found' }, 404)
    }

    const space = await service.create(userId, { ...input, propertyId })
    return c.json({
      ...space,
      createdAt: space.createdAt.toISOString(),
      updatedAt: space.updatedAt.toISOString(),
    }, 201)
  })

  // Update space
  const updateRoute = createRoute({
    method: 'patch',
    path: '/spaces/{id}',
    request: {
      params: z.object({ id: z.string().uuid() }),
      body: { content: { 'application/json': { schema: UpdateSpaceSchema } } },
    },
    responses: {
      200: {
        description: 'Space updated',
        content: { 'application/json': { schema: SpaceSchema } },
      },
      404: {
        description: 'Space not found',
        content: { 'application/json': { schema: ErrorSchema } },
      },
    },
  })

  app.openapi(updateRoute, async (c) => {
    const userId = c.get('userId')
    const { id } = c.req.valid('param')
    const input = c.req.valid('json')

    const existing = await service.findById(id)
    if (!existing) {
      return c.json({ error: 'Space not found' }, 404)
    }

    const space = await service.update(id, userId, input)
    return c.json({
      ...space,
      createdAt: space.createdAt.toISOString(),
      updatedAt: space.updatedAt.toISOString(),
    })
  })

  // Delete space
  const deleteRoute = createRoute({
    method: 'delete',
    path: '/spaces/{id}',
    request: {
      params: z.object({ id: z.string().uuid() }),
    },
    responses: {
      204: { description: 'Space deleted' },
      404: {
        description: 'Space not found',
        content: { 'application/json': { schema: ErrorSchema } },
      },
    },
  })

  app.openapi(deleteRoute, async (c) => {
    const { id } = c.req.valid('param')

    const existing = await service.findById(id)
    if (!existing) {
      return c.json({ error: 'Space not found' }, 404)
    }

    await service.delete(id)
    return c.body(null, 204)
  })

  return app
}
```

**Step 2: Mount in main app**

Add to `apps/web/src/api/index.ts` imports and routes:

```typescript
import { createSpacesRoutes } from './routes/spaces'

// In createApiApp function, add:
const spacesApp = createSpacesRoutes(db, logger)
app.route('/', spacesApp)  // Mounts at / for nested property routes
```

**Step 3: Commit**

```bash
git add apps/web/src/api/
git commit -m "feat: add spaces API routes"
```

---

### Task 8: Create Items API Routes

**Files:**
- Create: `apps/web/src/api/routes/items.ts`
- Modify: `apps/web/src/api/index.ts`

**Step 1: Create items routes**

Create `apps/web/src/api/routes/items.ts`:

```typescript
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { PrismaClient } from '@generated/prisma/client'
import type { Logger } from '@/lib/logger'
import { ItemService } from '@/features/items/service'
import { PropertyService } from '@/features/properties/service'
import type { ApiEnv } from '../index'

const ItemSchema = z.object({
  id: z.string().uuid(),
  propertyId: z.string().uuid(),
  spaceId: z.string().uuid().nullable(),
  parentId: z.string().uuid().nullable(),
  name: z.string(),
  category: z.string(),
  manufacturer: z.string().nullable(),
  model: z.string().nullable(),
  serialNumber: z.string().nullable(),
  acquiredDate: z.string().nullable(),
  warrantyExpires: z.string().nullable(),
  purchasePrice: z.number().nullable(),
  notes: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  space: z.object({ id: z.string(), name: z.string() }).nullable().optional(),
  parent: z.object({ id: z.string(), name: z.string() }).nullable().optional(),
  _count: z.object({
    events: z.number(),
    documents: z.number(),
    children: z.number(),
  }).optional(),
})

const CreateItemSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  spaceId: z.string().uuid().optional(),
  parentId: z.string().uuid().optional(),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  acquiredDate: z.string().optional(),
  warrantyExpires: z.string().optional(),
  purchasePrice: z.number().optional(),
  notes: z.string().optional(),
})

const UpdateItemSchema = CreateItemSchema.partial()

const ErrorSchema = z.object({ error: z.string() })

function serializeItem(item: any) {
  return {
    ...item,
    acquiredDate: item.acquiredDate?.toISOString() ?? null,
    warrantyExpires: item.warrantyExpires?.toISOString() ?? null,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  }
}

export function createItemsRoutes(db: PrismaClient, logger: Logger) {
  const app = new OpenAPIHono<ApiEnv>()
  const service = new ItemService({ db, logger })
  const propertyService = new PropertyService({ db, logger })

  // List items for property
  const listRoute = createRoute({
    method: 'get',
    path: '/properties/{propertyId}/items',
    request: {
      params: z.object({ propertyId: z.string().uuid() }),
      query: z.object({
        spaceId: z.string().uuid().optional(),
        category: z.string().optional(),
      }),
    },
    responses: {
      200: {
        description: 'List of items',
        content: { 'application/json': { schema: z.array(ItemSchema) } },
      },
      404: {
        description: 'Property not found',
        content: { 'application/json': { schema: ErrorSchema } },
      },
    },
  })

  app.openapi(listRoute, async (c) => {
    const userId = c.get('userId')
    const { propertyId } = c.req.valid('param')
    const { spaceId } = c.req.valid('query')

    const property = await propertyService.findById(propertyId, userId)
    if (!property) {
      return c.json({ error: 'Property not found' }, 404)
    }

    let items
    if (spaceId) {
      items = await service.findAllForSpace(spaceId)
    } else {
      items = await service.findAllForProperty(propertyId)
    }

    return c.json(items.map(serializeItem))
  })

  // Get item
  const getRoute = createRoute({
    method: 'get',
    path: '/items/{id}',
    request: {
      params: z.object({ id: z.string().uuid() }),
    },
    responses: {
      200: {
        description: 'Item details',
        content: { 'application/json': { schema: ItemSchema } },
      },
      404: {
        description: 'Item not found',
        content: { 'application/json': { schema: ErrorSchema } },
      },
    },
  })

  app.openapi(getRoute, async (c) => {
    const { id } = c.req.valid('param')
    const item = await service.findById(id)
    if (!item) {
      return c.json({ error: 'Item not found' }, 404)
    }
    return c.json(serializeItem(item))
  })

  // Get item children
  const childrenRoute = createRoute({
    method: 'get',
    path: '/items/{id}/children',
    request: {
      params: z.object({ id: z.string().uuid() }),
    },
    responses: {
      200: {
        description: 'List of child items',
        content: { 'application/json': { schema: z.array(ItemSchema) } },
      },
      404: {
        description: 'Item not found',
        content: { 'application/json': { schema: ErrorSchema } },
      },
    },
  })

  app.openapi(childrenRoute, async (c) => {
    const { id } = c.req.valid('param')
    const item = await service.findById(id)
    if (!item) {
      return c.json({ error: 'Item not found' }, 404)
    }
    const children = await service.findChildrenForItem(id)
    return c.json(children.map(serializeItem))
  })

  // Create item
  const createRoute = createRoute({
    method: 'post',
    path: '/properties/{propertyId}/items',
    request: {
      params: z.object({ propertyId: z.string().uuid() }),
      body: { content: { 'application/json': { schema: CreateItemSchema } } },
    },
    responses: {
      201: {
        description: 'Item created',
        content: { 'application/json': { schema: ItemSchema } },
      },
      404: {
        description: 'Property not found',
        content: { 'application/json': { schema: ErrorSchema } },
      },
    },
  })

  app.openapi(createRoute, async (c) => {
    const userId = c.get('userId')
    const { propertyId } = c.req.valid('param')
    const input = c.req.valid('json')

    const property = await propertyService.findById(propertyId, userId)
    if (!property) {
      return c.json({ error: 'Property not found' }, 404)
    }

    const itemInput = {
      ...input,
      propertyId,
      acquiredDate: input.acquiredDate ? new Date(input.acquiredDate) : undefined,
      warrantyExpires: input.warrantyExpires ? new Date(input.warrantyExpires) : undefined,
    }

    const item = await service.create(userId, itemInput)
    return c.json(serializeItem(item), 201)
  })

  // Update item
  const updateRoute = createRoute({
    method: 'patch',
    path: '/items/{id}',
    request: {
      params: z.object({ id: z.string().uuid() }),
      body: { content: { 'application/json': { schema: UpdateItemSchema } } },
    },
    responses: {
      200: {
        description: 'Item updated',
        content: { 'application/json': { schema: ItemSchema } },
      },
      404: {
        description: 'Item not found',
        content: { 'application/json': { schema: ErrorSchema } },
      },
    },
  })

  app.openapi(updateRoute, async (c) => {
    const userId = c.get('userId')
    const { id } = c.req.valid('param')
    const input = c.req.valid('json')

    const existing = await service.findById(id)
    if (!existing) {
      return c.json({ error: 'Item not found' }, 404)
    }

    const updateInput = {
      ...input,
      acquiredDate: input.acquiredDate ? new Date(input.acquiredDate) : undefined,
      warrantyExpires: input.warrantyExpires ? new Date(input.warrantyExpires) : undefined,
    }

    const item = await service.update(id, userId, updateInput)
    return c.json(serializeItem(item))
  })

  // Delete item
  const deleteRoute = createRoute({
    method: 'delete',
    path: '/items/{id}',
    request: {
      params: z.object({ id: z.string().uuid() }),
    },
    responses: {
      204: { description: 'Item deleted' },
      404: {
        description: 'Item not found',
        content: { 'application/json': { schema: ErrorSchema } },
      },
    },
  })

  app.openapi(deleteRoute, async (c) => {
    const { id } = c.req.valid('param')

    const existing = await service.findById(id)
    if (!existing) {
      return c.json({ error: 'Item not found' }, 404)
    }

    await service.delete(id)
    return c.body(null, 204)
  })

  return app
}
```

**Step 2: Mount in main app**

Add to `apps/web/src/api/index.ts`:

```typescript
import { createItemsRoutes } from './routes/items'

// In createApiApp, add:
const itemsApp = createItemsRoutes(db, logger)
app.route('/', itemsApp)
```

**Step 3: Commit**

```bash
git add apps/web/src/api/
git commit -m "feat: add items API routes"
```

---

### Task 9: Create Events API Routes

**Files:**
- Create: `apps/web/src/api/routes/events.ts`
- Modify: `apps/web/src/api/index.ts`

**Step 1: Create events routes**

Create `apps/web/src/api/routes/events.ts`:

```typescript
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { PrismaClient } from '@generated/prisma/client'
import type { Logger } from '@/lib/logger'
import { EventService } from '@/features/events/service'
import { ItemService } from '@/features/items/service'
import type { ApiEnv } from '../index'

const EventSchema = z.object({
  id: z.string().uuid(),
  itemId: z.string().uuid(),
  type: z.string(),
  date: z.string(),
  description: z.string().nullable(),
  cost: z.number().nullable(),
  performedBy: z.string().nullable(),
  createdAt: z.string(),
  updatedAt: z.string(),
  item: z.object({ id: z.string(), name: z.string() }).optional(),
  _count: z.object({ documents: z.number() }).optional(),
})

const CreateEventSchema = z.object({
  type: z.string().min(1),
  date: z.string(),
  description: z.string().optional(),
  cost: z.number().optional(),
  performedBy: z.string().optional(),
})

const UpdateEventSchema = CreateEventSchema.partial()

const ErrorSchema = z.object({ error: z.string() })

function serializeEvent(event: any) {
  return {
    ...event,
    date: event.date.toISOString(),
    createdAt: event.createdAt.toISOString(),
    updatedAt: event.updatedAt.toISOString(),
  }
}

export function createEventsRoutes(db: PrismaClient, logger: Logger) {
  const app = new OpenAPIHono<ApiEnv>()
  const service = new EventService({ db, logger })
  const itemService = new ItemService({ db, logger })

  // List events for item
  const listRoute = createRoute({
    method: 'get',
    path: '/items/{itemId}/events',
    request: {
      params: z.object({ itemId: z.string().uuid() }),
    },
    responses: {
      200: {
        description: 'List of events',
        content: { 'application/json': { schema: z.array(EventSchema) } },
      },
      404: {
        description: 'Item not found',
        content: { 'application/json': { schema: ErrorSchema } },
      },
    },
  })

  app.openapi(listRoute, async (c) => {
    const { itemId } = c.req.valid('param')

    const item = await itemService.findById(itemId)
    if (!item) {
      return c.json({ error: 'Item not found' }, 404)
    }

    const events = await service.findAllForItem(itemId)
    return c.json(events.map(serializeEvent))
  })

  // Get event
  const getRoute = createRoute({
    method: 'get',
    path: '/events/{id}',
    request: {
      params: z.object({ id: z.string().uuid() }),
    },
    responses: {
      200: {
        description: 'Event details',
        content: { 'application/json': { schema: EventSchema } },
      },
      404: {
        description: 'Event not found',
        content: { 'application/json': { schema: ErrorSchema } },
      },
    },
  })

  app.openapi(getRoute, async (c) => {
    const { id } = c.req.valid('param')
    const event = await service.findById(id)
    if (!event) {
      return c.json({ error: 'Event not found' }, 404)
    }
    return c.json(serializeEvent(event))
  })

  // Create event
  const createRoute = createRoute({
    method: 'post',
    path: '/items/{itemId}/events',
    request: {
      params: z.object({ itemId: z.string().uuid() }),
      body: { content: { 'application/json': { schema: CreateEventSchema } } },
    },
    responses: {
      201: {
        description: 'Event created',
        content: { 'application/json': { schema: EventSchema } },
      },
      404: {
        description: 'Item not found',
        content: { 'application/json': { schema: ErrorSchema } },
      },
    },
  })

  app.openapi(createRoute, async (c) => {
    const userId = c.get('userId')
    const { itemId } = c.req.valid('param')
    const input = c.req.valid('json')

    const item = await itemService.findById(itemId)
    if (!item) {
      return c.json({ error: 'Item not found' }, 404)
    }

    const event = await service.create(userId, {
      itemId,
      type: input.type,
      date: new Date(input.date),
      description: input.description,
      cost: input.cost,
      performedBy: input.performedBy,
    })
    return c.json(serializeEvent(event), 201)
  })

  // Update event
  const updateRoute = createRoute({
    method: 'patch',
    path: '/events/{id}',
    request: {
      params: z.object({ id: z.string().uuid() }),
      body: { content: { 'application/json': { schema: UpdateEventSchema } } },
    },
    responses: {
      200: {
        description: 'Event updated',
        content: { 'application/json': { schema: EventSchema } },
      },
      404: {
        description: 'Event not found',
        content: { 'application/json': { schema: ErrorSchema } },
      },
    },
  })

  app.openapi(updateRoute, async (c) => {
    const userId = c.get('userId')
    const { id } = c.req.valid('param')
    const input = c.req.valid('json')

    const existing = await service.findById(id)
    if (!existing) {
      return c.json({ error: 'Event not found' }, 404)
    }

    const event = await service.update(id, userId, {
      type: input.type,
      date: input.date ? new Date(input.date) : undefined,
      description: input.description,
      cost: input.cost,
      performedBy: input.performedBy,
    })
    return c.json(serializeEvent(event))
  })

  // Delete event
  const deleteRoute = createRoute({
    method: 'delete',
    path: '/events/{id}',
    request: {
      params: z.object({ id: z.string().uuid() }),
    },
    responses: {
      204: { description: 'Event deleted' },
      404: {
        description: 'Event not found',
        content: { 'application/json': { schema: ErrorSchema } },
      },
    },
  })

  app.openapi(deleteRoute, async (c) => {
    const { id } = c.req.valid('param')

    const existing = await service.findById(id)
    if (!existing) {
      return c.json({ error: 'Event not found' }, 404)
    }

    await service.delete(id)
    return c.body(null, 204)
  })

  return app
}
```

**Step 2: Mount in main app**

Add to `apps/web/src/api/index.ts`:

```typescript
import { createEventsRoutes } from './routes/events'

// In createApiApp, add:
const eventsApp = createEventsRoutes(db, logger)
app.route('/', eventsApp)
```

**Step 3: Commit**

```bash
git add apps/web/src/api/
git commit -m "feat: add events API routes"
```

---

### Task 10: Create Documents API Routes with Upload

**Files:**
- Create: `apps/web/src/api/routes/documents.ts`
- Modify: `apps/web/src/api/index.ts`

**Step 1: Create documents routes**

Create `apps/web/src/api/routes/documents.ts`:

```typescript
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { PrismaClient } from '@generated/prisma/client'
import type { Logger } from '@/lib/logger'
import { DocumentService } from '@/features/documents/service'
import { PropertyService } from '@/features/properties/service'
import { createClient } from '@supabase/supabase-js'
import { v4 as uuidv4 } from 'uuid'
import { tasks, configure } from '@trigger.dev/sdk/v3'
import type { ApiEnv } from '../index'

const DocumentSchema = z.object({
  id: z.string().uuid(),
  propertyId: z.string().uuid(),
  itemId: z.string().uuid().nullable(),
  eventId: z.string().uuid().nullable(),
  type: z.string(),
  fileName: z.string(),
  storagePath: z.string(),
  contentType: z.string(),
  sizeBytes: z.number(),
  status: z.string(),
  extractedText: z.string().nullable(),
  extractedData: z.any().nullable(),
  resolveData: z.any().nullable(),
  documentDate: z.string().nullable(),
  source: z.string(),
  sourceEmail: z.string().nullable(),
  createdAt: z.string(),
})

const UploadResponseSchema = z.object({
  id: z.string().uuid(),
  status: z.string(),
  fileName: z.string(),
  message: z.string(),
})

const ErrorSchema = z.object({ error: z.string() })

function serializeDocument(doc: any) {
  return {
    ...doc,
    documentDate: doc.documentDate?.toISOString() ?? null,
    createdAt: doc.createdAt.toISOString(),
  }
}

export function createDocumentsRoutes(db: PrismaClient, logger: Logger, env: {
  SUPABASE_URL: string
  SUPABASE_KEY: string
  SUPABASE_SERVICE_KEY?: string
}) {
  const app = new OpenAPIHono<ApiEnv>()
  const service = new DocumentService({ db, logger })
  const propertyService = new PropertyService({ db, logger })

  // Configure Trigger.dev
  const triggerKey = process.env.TRIGGER_SECRET_KEY || process.env.TRIGGER_API_KEY
  if (triggerKey) {
    configure({ secretKey: triggerKey })
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_KEY || env.SUPABASE_KEY)

  // List documents for property
  const listRoute = createRoute({
    method: 'get',
    path: '/properties/{propertyId}/documents',
    request: {
      params: z.object({ propertyId: z.string().uuid() }),
      query: z.object({
        itemId: z.string().uuid().optional(),
        status: z.string().optional(),
      }),
    },
    responses: {
      200: {
        description: 'List of documents',
        content: { 'application/json': { schema: z.array(DocumentSchema) } },
      },
      404: {
        description: 'Property not found',
        content: { 'application/json': { schema: ErrorSchema } },
      },
    },
  })

  app.openapi(listRoute, async (c) => {
    const userId = c.get('userId')
    const { propertyId } = c.req.valid('param')
    const { status } = c.req.valid('query')

    const property = await propertyService.findById(propertyId, userId)
    if (!property) {
      return c.json({ error: 'Property not found' }, 404)
    }

    let documents
    if (status) {
      documents = await service.findByStatus(propertyId, status)
    } else {
      documents = await service.findAllForProperty(propertyId)
    }

    return c.json(documents.map(serializeDocument))
  })

  // Get document
  const getRoute = createRoute({
    method: 'get',
    path: '/documents/{id}',
    request: {
      params: z.object({ id: z.string().uuid() }),
    },
    responses: {
      200: {
        description: 'Document details',
        content: { 'application/json': { schema: DocumentSchema } },
      },
      404: {
        description: 'Document not found',
        content: { 'application/json': { schema: ErrorSchema } },
      },
    },
  })

  app.openapi(getRoute, async (c) => {
    const { id } = c.req.valid('param')
    const document = await service.findById(id)
    if (!document) {
      return c.json({ error: 'Document not found' }, 404)
    }
    return c.json(serializeDocument(document))
  })

  // Upload document
  const uploadRoute = createRoute({
    method: 'post',
    path: '/properties/{propertyId}/documents/upload',
    request: {
      params: z.object({ propertyId: z.string().uuid() }),
    },
    responses: {
      201: {
        description: 'Document uploaded',
        content: { 'application/json': { schema: UploadResponseSchema } },
      },
      400: {
        description: 'Bad request',
        content: { 'application/json': { schema: ErrorSchema } },
      },
      404: {
        description: 'Property not found',
        content: { 'application/json': { schema: ErrorSchema } },
      },
    },
  })

  app.openapi(uploadRoute, async (c) => {
    const userId = c.get('userId')
    const { propertyId } = c.req.valid('param')

    const property = await propertyService.findById(propertyId, userId)
    if (!property) {
      return c.json({ error: 'Property not found' }, 404)
    }

    const contentType = c.req.header('content-type') || ''

    let fileBuffer: Buffer
    let fileName: string
    let mimeType: string
    let itemId: string | undefined

    if (contentType.includes('multipart/form-data')) {
      const formData = await c.req.formData()
      const file = formData.get('file') as File | null
      itemId = formData.get('itemId')?.toString()

      if (!file) {
        return c.json({ error: 'No file provided' }, 400)
      }

      fileBuffer = Buffer.from(await file.arrayBuffer())
      fileName = file.name
      mimeType = file.type
    } else if (contentType.includes('application/json')) {
      const body = await c.req.json()

      if (body.base64) {
        fileBuffer = Buffer.from(body.base64, 'base64')
        fileName = body.fileName || 'upload'
        mimeType = body.contentType || 'application/octet-stream'
        itemId = body.itemId
      } else if (body.url) {
        const response = await fetch(body.url)
        if (!response.ok) {
          return c.json({ error: 'Failed to fetch URL' }, 400)
        }
        fileBuffer = Buffer.from(await response.arrayBuffer())
        fileName = body.fileName || body.url.split('/').pop() || 'download'
        mimeType = body.contentType || response.headers.get('content-type') || 'application/octet-stream'
        itemId = body.itemId
      } else {
        return c.json({ error: 'Must provide file, base64, or url' }, 400)
      }
    } else {
      return c.json({ error: 'Unsupported content type' }, 400)
    }

    // Upload to Supabase Storage
    const fileId = uuidv4()
    const storagePath = `${propertyId}/${userId}/${fileId}/${fileName}`

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, fileBuffer, {
        contentType: mimeType,
        upsert: false,
      })

    if (uploadError) {
      logger.error('Failed to upload file', { error: uploadError.message })
      return c.json({ error: 'Failed to upload file' }, 400)
    }

    // Create document record
    const document = await service.create(userId, {
      propertyId,
      itemId,
      type: inferDocumentType(mimeType, fileName),
      fileName,
      storagePath,
      contentType: mimeType,
      sizeBytes: fileBuffer.length,
      source: 'upload',
    })

    // Trigger processing
    try {
      await tasks.trigger('process-document', {
        documentId: document.id,
        userId,
        propertyId,
      })
    } catch (triggerError) {
      logger.error('Failed to trigger document processing', {
        documentId: document.id,
        error: triggerError instanceof Error ? triggerError.message : 'Unknown',
      })
    }

    return c.json({
      id: document.id,
      status: document.status,
      fileName: document.fileName,
      message: 'Document queued for processing',
    }, 201)
  })

  // Delete document
  const deleteRoute = createRoute({
    method: 'delete',
    path: '/documents/{id}',
    request: {
      params: z.object({ id: z.string().uuid() }),
    },
    responses: {
      204: { description: 'Document deleted' },
      404: {
        description: 'Document not found',
        content: { 'application/json': { schema: ErrorSchema } },
      },
    },
  })

  app.openapi(deleteRoute, async (c) => {
    const { id } = c.req.valid('param')

    const existing = await service.findById(id)
    if (!existing) {
      return c.json({ error: 'Document not found' }, 404)
    }

    // Delete from storage
    if (existing.storagePath) {
      await supabase.storage.from('documents').remove([existing.storagePath])
    }

    await service.delete(id)
    return c.body(null, 204)
  })

  return app
}

function inferDocumentType(contentType: string, fileName: string): string {
  const lowerFileName = fileName.toLowerCase()

  if (contentType === 'application/pdf') {
    if (lowerFileName.includes('manual')) return 'manual'
    if (lowerFileName.includes('warranty')) return 'warranty'
    if (lowerFileName.includes('receipt')) return 'receipt'
    if (lowerFileName.includes('invoice')) return 'invoice'
    return 'other'
  }

  if (contentType.startsWith('image/')) {
    if (lowerFileName.includes('receipt')) return 'receipt'
    return 'photo'
  }

  return 'other'
}
```

**Step 2: Mount in main app**

Update `apps/web/src/api/index.ts` to pass env to documents routes:

```typescript
import { createDocumentsRoutes } from './routes/documents'

// In createApiApp function signature, add env parameter:
export function createApiApp(db: PrismaClient, logger: Logger, env: {
  SUPABASE_URL: string
  SUPABASE_KEY: string
  SUPABASE_SERVICE_KEY?: string
}) {
  // ... existing code ...

  const documentsApp = createDocumentsRoutes(db, logger, env)
  app.route('/', documentsApp)

  // ... rest of code ...
}
```

Update `apps/web/src/routes/api/v1/$.tsx` to pass env:

```typescript
const { getServerEnv } = await import('@/lib/env')
const env = getServerEnv()
const app = createApiApp(prisma, logger, {
  SUPABASE_URL: env.SUPABASE_URL,
  SUPABASE_KEY: env.SUPABASE_KEY,
  SUPABASE_SERVICE_KEY: env.SUPABASE_SERVICE_KEY,
})
```

**Step 3: Commit**

```bash
git add apps/web/src/api/ apps/web/src/routes/api/v1/
git commit -m "feat: add documents API routes with upload"
```

---

### Task 11: Create Auth API Route

**Files:**
- Create: `apps/web/src/api/routes/auth.ts`
- Modify: `apps/web/src/api/index.ts`

**Step 1: Create auth routes**

Create `apps/web/src/api/routes/auth.ts`:

```typescript
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi'
import type { ApiEnv } from '../index'

const MeResponseSchema = z.object({
  userId: z.string().uuid(),
})

export function createAuthRoutes() {
  const app = new OpenAPIHono<ApiEnv>()

  const meRoute = createRoute({
    method: 'get',
    path: '/me',
    responses: {
      200: {
        description: 'Current user info',
        content: { 'application/json': { schema: MeResponseSchema } },
      },
    },
  })

  app.openapi(meRoute, async (c) => {
    const userId = c.get('userId')
    return c.json({ userId })
  })

  return app
}
```

**Step 2: Mount in main app**

Add to `apps/web/src/api/index.ts`:

```typescript
import { createAuthRoutes } from './routes/auth'

// In createApiApp, add:
app.route('/auth', createAuthRoutes())
```

**Step 3: Commit**

```bash
git add apps/web/src/api/
git commit -m "feat: add auth API route"
```

---

## Phase 3: Go CLI

### Task 12: Initialize Go CLI Project

**Files:**
- Create: `apps/cli/go.mod`
- Create: `apps/cli/main.go`
- Create: `apps/cli/Makefile`

**Step 1: Create go.mod**

Create `apps/cli/go.mod`:

```go
module github.com/hausdog/cli

go 1.22

require (
	github.com/spf13/cobra v1.8.0
)
```

**Step 2: Create main.go**

Create `apps/cli/main.go`:

```go
package main

import (
	"os"

	"github.com/hausdog/cli/cmd"
)

func main() {
	if err := cmd.Execute(); err != nil {
		os.Exit(1)
	}
}
```

**Step 3: Create cmd/root.go**

Create `apps/cli/cmd/root.go`:

```go
package cmd

import (
	"fmt"
	"os"

	"github.com/spf13/cobra"
)

var (
	apiURL string
	apiKey string
	format string
)

var rootCmd = &cobra.Command{
	Use:   "hausdog",
	Short: "Hausdog CLI - Home documentation management",
	Long:  `A CLI for interacting with Hausdog, your home documentation management system.`,
}

func Execute() error {
	return rootCmd.Execute()
}

func init() {
	rootCmd.PersistentFlags().StringVar(&apiURL, "api-url", "", "API URL (or HAUSDOG_API_URL env)")
	rootCmd.PersistentFlags().StringVar(&apiKey, "api-key", "", "API key (or HAUSDOG_API_KEY env)")
	rootCmd.PersistentFlags().StringVar(&format, "format", "json", "Output format: json, table, yaml")
}

func getAPIURL() string {
	if apiURL != "" {
		return apiURL
	}
	if env := os.Getenv("HAUSDOG_API_URL"); env != "" {
		return env
	}
	return "http://localhost:3333/api/v1"
}

func getAPIKey() string {
	if apiKey != "" {
		return apiKey
	}
	return os.Getenv("HAUSDOG_API_KEY")
}

func checkAPIKey() error {
	if getAPIKey() == "" {
		return fmt.Errorf("API key required: set HAUSDOG_API_KEY or use --api-key")
	}
	return nil
}
```

**Step 4: Create Makefile**

Create `apps/cli/Makefile`:

```makefile
.PHONY: build install generate clean

BINARY_NAME=hausdog
BUILD_DIR=./build

build:
	go build -o $(BUILD_DIR)/$(BINARY_NAME) .

install: build
	cp $(BUILD_DIR)/$(BINARY_NAME) ~/go/bin/

generate:
	@echo "Generating client from OpenAPI spec..."
	oapi-codegen -generate types,client -package client \
		-o internal/client/client.gen.go \
		http://localhost:3333/api/v1/openapi.json

clean:
	rm -rf $(BUILD_DIR)

deps:
	go mod tidy
	go install github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@latest
```

**Step 5: Initialize and tidy**

Run:
```bash
cd apps/cli && go mod tidy
```

**Step 6: Commit**

```bash
git add apps/cli/
git commit -m "feat: initialize Go CLI project structure"
```

---

### Task 13: Create CLI Version Command

**Files:**
- Create: `apps/cli/cmd/version.go`

**Step 1: Create version command**

Create `apps/cli/cmd/version.go`:

```go
package cmd

import (
	"encoding/json"
	"fmt"
	"net/http"

	"github.com/spf13/cobra"
)

var Version = "0.1.0"

var versionCmd = &cobra.Command{
	Use:   "version",
	Short: "Print version and check API health",
	RunE: func(cmd *cobra.Command, args []string) error {
		fmt.Printf("hausdog CLI v%s\n", Version)

		// Check API health
		resp, err := http.Get(getAPIURL() + "/health")
		if err != nil {
			fmt.Printf("API status: unreachable (%v)\n", err)
			return nil
		}
		defer resp.Body.Close()

		if resp.StatusCode == 200 {
			fmt.Printf("API status: healthy (%s)\n", getAPIURL())
		} else {
			fmt.Printf("API status: unhealthy (status %d)\n", resp.StatusCode)
		}

		return nil
	},
}

func init() {
	rootCmd.AddCommand(versionCmd)
}

func outputJSON(data interface{}) error {
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	return enc.Encode(data)
}
```

**Step 2: Test**

Run:
```bash
cd apps/cli && go build -o build/hausdog . && ./build/hausdog version
```

Expected: Shows version and API status

**Step 3: Commit**

```bash
git add apps/cli/
git commit -m "feat: add CLI version command"
```

---

### Task 14: Generate Go Client from OpenAPI

**Files:**
- Create: `apps/cli/internal/client/client.gen.go` (generated)

**Step 1: Install oapi-codegen**

Run:
```bash
go install github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@latest
```

**Step 2: Start dev server and generate**

Run:
```bash
cd apps/web && doppler run -- bun run dev &
sleep 10
cd apps/cli && mkdir -p internal/client
oapi-codegen -generate types,client -package client \
  -o internal/client/client.gen.go \
  http://localhost:3333/api/v1/openapi.json
```

**Step 3: Commit**

```bash
git add apps/cli/internal/
git commit -m "feat: generate Go client from OpenAPI spec"
```

---

### Task 15: Create Properties CLI Commands

**Files:**
- Create: `apps/cli/cmd/properties.go`

**Step 1: Create properties command**

Create `apps/cli/cmd/properties.go`:

```go
package cmd

import (
	"context"
	"encoding/json"
	"fmt"
	"os"

	"github.com/hausdog/cli/internal/client"
	"github.com/spf13/cobra"
)

var propertiesCmd = &cobra.Command{
	Use:   "properties",
	Short: "Manage properties",
}

var propertiesListCmd = &cobra.Command{
	Use:   "list",
	Short: "List all properties",
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := checkAPIKey(); err != nil {
			return err
		}

		c, err := client.NewClientWithResponses(getAPIURL(), client.WithRequestEditorFn(addAuthHeader))
		if err != nil {
			return err
		}

		resp, err := c.GetPropertiesWithResponse(context.Background())
		if err != nil {
			return err
		}

		if resp.StatusCode() != 200 {
			return fmt.Errorf("API error: %s", resp.Status())
		}

		return outputJSON(resp.JSON200)
	},
}

var propertiesGetCmd = &cobra.Command{
	Use:   "get <id>",
	Short: "Get property details",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := checkAPIKey(); err != nil {
			return err
		}

		c, err := client.NewClientWithResponses(getAPIURL(), client.WithRequestEditorFn(addAuthHeader))
		if err != nil {
			return err
		}

		resp, err := c.GetPropertiesIdWithResponse(context.Background(), args[0])
		if err != nil {
			return err
		}

		if resp.StatusCode() == 404 {
			return fmt.Errorf("property not found")
		}
		if resp.StatusCode() != 200 {
			return fmt.Errorf("API error: %s", resp.Status())
		}

		return outputJSON(resp.JSON200)
	},
}

var (
	propName    string
	propCity    string
	propState   string
	propAddress string
)

var propertiesCreateCmd = &cobra.Command{
	Use:   "create",
	Short: "Create a new property",
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := checkAPIKey(); err != nil {
			return err
		}

		c, err := client.NewClientWithResponses(getAPIURL(), client.WithRequestEditorFn(addAuthHeader))
		if err != nil {
			return err
		}

		body := client.PostPropertiesJSONRequestBody{
			Name: propName,
		}
		if propCity != "" {
			body.City = &propCity
		}
		if propState != "" {
			body.State = &propState
		}
		if propAddress != "" {
			body.FormattedAddress = &propAddress
		}

		resp, err := c.PostPropertiesWithResponse(context.Background(), body)
		if err != nil {
			return err
		}

		if resp.StatusCode() != 201 {
			return fmt.Errorf("API error: %s", resp.Status())
		}

		return outputJSON(resp.JSON201)
	},
}

var propertiesDeleteCmd = &cobra.Command{
	Use:   "delete <id>",
	Short: "Delete a property",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := checkAPIKey(); err != nil {
			return err
		}

		c, err := client.NewClientWithResponses(getAPIURL(), client.WithRequestEditorFn(addAuthHeader))
		if err != nil {
			return err
		}

		resp, err := c.DeletePropertiesIdWithResponse(context.Background(), args[0])
		if err != nil {
			return err
		}

		if resp.StatusCode() == 404 {
			return fmt.Errorf("property not found")
		}
		if resp.StatusCode() != 204 {
			return fmt.Errorf("API error: %s", resp.Status())
		}

		fmt.Println(`{"status": "deleted"}`)
		return nil
	},
}

func init() {
	rootCmd.AddCommand(propertiesCmd)
	propertiesCmd.AddCommand(propertiesListCmd)
	propertiesCmd.AddCommand(propertiesGetCmd)
	propertiesCmd.AddCommand(propertiesCreateCmd)
	propertiesCmd.AddCommand(propertiesDeleteCmd)

	propertiesCreateCmd.Flags().StringVar(&propName, "name", "", "Property name (required)")
	propertiesCreateCmd.Flags().StringVar(&propCity, "city", "", "City")
	propertiesCreateCmd.Flags().StringVar(&propState, "state", "", "State")
	propertiesCreateCmd.Flags().StringVar(&propAddress, "address", "", "Formatted address")
	propertiesCreateCmd.MarkFlagRequired("name")
}

func addAuthHeader(ctx context.Context, req *http.Request) error {
	req.Header.Set("Authorization", "Bearer "+getAPIKey())
	return nil
}

func outputJSON(data interface{}) error {
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	return enc.Encode(data)
}
```

**Step 2: Build and test**

Run:
```bash
cd apps/cli && go build -o build/hausdog .
./build/hausdog properties --help
```

Expected: Shows properties subcommands

**Step 3: Commit**

```bash
git add apps/cli/
git commit -m "feat: add properties CLI commands"
```

---

### Task 16: Create Documents CLI Commands with Upload

**Files:**
- Create: `apps/cli/cmd/documents.go`

**Step 1: Create documents command**

Create `apps/cli/cmd/documents.go`:

```go
package cmd

import (
	"bytes"
	"context"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"

	"github.com/spf13/cobra"
)

var documentsCmd = &cobra.Command{
	Use:   "documents",
	Short: "Manage documents",
}

var (
	docPropertyID string
	docItemID     string
	docStatus     string
	docFile       string
	docStdin      bool
	docURL        string
)

var documentsListCmd = &cobra.Command{
	Use:   "list",
	Short: "List documents for a property",
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := checkAPIKey(); err != nil {
			return err
		}

		url := fmt.Sprintf("%s/properties/%s/documents", getAPIURL(), docPropertyID)
		if docStatus != "" {
			url += "?status=" + docStatus
		}

		req, err := http.NewRequest("GET", url, nil)
		if err != nil {
			return err
		}
		req.Header.Set("Authorization", "Bearer "+getAPIKey())

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			return err
		}
		defer resp.Body.Close()

		if resp.StatusCode != 200 {
			return fmt.Errorf("API error: %s", resp.Status)
		}

		var result interface{}
		if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
			return err
		}

		return outputJSON(result)
	},
}

var documentsGetCmd = &cobra.Command{
	Use:   "get <id>",
	Short: "Get document details",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := checkAPIKey(); err != nil {
			return err
		}

		url := fmt.Sprintf("%s/documents/%s", getAPIURL(), args[0])

		req, err := http.NewRequest("GET", url, nil)
		if err != nil {
			return err
		}
		req.Header.Set("Authorization", "Bearer "+getAPIKey())

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			return err
		}
		defer resp.Body.Close()

		if resp.StatusCode == 404 {
			return fmt.Errorf("document not found")
		}
		if resp.StatusCode != 200 {
			return fmt.Errorf("API error: %s", resp.Status)
		}

		var result interface{}
		if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
			return err
		}

		return outputJSON(result)
	},
}

var documentsUploadCmd = &cobra.Command{
	Use:   "upload",
	Short: "Upload a document",
	Long: `Upload a document to a property.

Examples:
  hausdog documents upload --property <id> --file /path/to/photo.jpg
  cat photo.jpg | base64 | hausdog documents upload --property <id> --stdin
  hausdog documents upload --property <id> --url https://example.com/photo.jpg`,
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := checkAPIKey(); err != nil {
			return err
		}

		url := fmt.Sprintf("%s/properties/%s/documents/upload", getAPIURL(), docPropertyID)

		var req *http.Request
		var err error

		if docFile != "" {
			// File upload via multipart
			req, err = createFileUploadRequest(url, docFile, docItemID)
		} else if docStdin {
			// Base64 from stdin
			req, err = createBase64UploadRequest(url, docItemID)
		} else if docURL != "" {
			// URL passthrough
			req, err = createURLUploadRequest(url, docURL, docItemID)
		} else {
			return fmt.Errorf("must specify --file, --stdin, or --url")
		}

		if err != nil {
			return err
		}

		req.Header.Set("Authorization", "Bearer "+getAPIKey())

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			return err
		}
		defer resp.Body.Close()

		if resp.StatusCode != 201 {
			body, _ := io.ReadAll(resp.Body)
			return fmt.Errorf("API error: %s - %s", resp.Status, string(body))
		}

		var result interface{}
		if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
			return err
		}

		return outputJSON(result)
	},
}

var documentsDeleteCmd = &cobra.Command{
	Use:   "delete <id>",
	Short: "Delete a document",
	Args:  cobra.ExactArgs(1),
	RunE: func(cmd *cobra.Command, args []string) error {
		if err := checkAPIKey(); err != nil {
			return err
		}

		url := fmt.Sprintf("%s/documents/%s", getAPIURL(), args[0])

		req, err := http.NewRequest("DELETE", url, nil)
		if err != nil {
			return err
		}
		req.Header.Set("Authorization", "Bearer "+getAPIKey())

		resp, err := http.DefaultClient.Do(req)
		if err != nil {
			return err
		}
		defer resp.Body.Close()

		if resp.StatusCode == 404 {
			return fmt.Errorf("document not found")
		}
		if resp.StatusCode != 204 {
			return fmt.Errorf("API error: %s", resp.Status)
		}

		fmt.Println(`{"status": "deleted"}`)
		return nil
	},
}

func init() {
	rootCmd.AddCommand(documentsCmd)
	documentsCmd.AddCommand(documentsListCmd)
	documentsCmd.AddCommand(documentsGetCmd)
	documentsCmd.AddCommand(documentsUploadCmd)
	documentsCmd.AddCommand(documentsDeleteCmd)

	documentsListCmd.Flags().StringVar(&docPropertyID, "property", "", "Property ID (required)")
	documentsListCmd.Flags().StringVar(&docStatus, "status", "", "Filter by status")
	documentsListCmd.MarkFlagRequired("property")

	documentsUploadCmd.Flags().StringVar(&docPropertyID, "property", "", "Property ID (required)")
	documentsUploadCmd.Flags().StringVar(&docItemID, "item", "", "Associate with item ID")
	documentsUploadCmd.Flags().StringVar(&docFile, "file", "", "File path to upload")
	documentsUploadCmd.Flags().BoolVar(&docStdin, "stdin", false, "Read base64 content from stdin")
	documentsUploadCmd.Flags().StringVar(&docURL, "url", "", "URL to fetch and upload")
	documentsUploadCmd.MarkFlagRequired("property")
}

func createFileUploadRequest(url, filePath, itemID string) (*http.Request, error) {
	file, err := os.Open(filePath)
	if err != nil {
		return nil, fmt.Errorf("failed to open file: %w", err)
	}
	defer file.Close()

	body := &bytes.Buffer{}
	writer := multipart.NewWriter(body)

	part, err := writer.CreateFormFile("file", filepath.Base(filePath))
	if err != nil {
		return nil, err
	}

	if _, err := io.Copy(part, file); err != nil {
		return nil, err
	}

	if itemID != "" {
		writer.WriteField("itemId", itemID)
	}

	writer.Close()

	req, err := http.NewRequest("POST", url, body)
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", writer.FormDataContentType())

	return req, nil
}

func createBase64UploadRequest(url, itemID string) (*http.Request, error) {
	b64Data, err := io.ReadAll(os.Stdin)
	if err != nil {
		return nil, fmt.Errorf("failed to read stdin: %w", err)
	}

	payload := map[string]interface{}{
		"base64":      string(bytes.TrimSpace(b64Data)),
		"fileName":    "upload",
		"contentType": "application/octet-stream",
	}
	if itemID != "" {
		payload["itemId"] = itemID
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest("POST", url, bytes.NewReader(jsonData))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	return req, nil
}

func createURLUploadRequest(apiURL, fileURL, itemID string) (*http.Request, error) {
	payload := map[string]interface{}{
		"url": fileURL,
	}
	if itemID != "" {
		payload["itemId"] = itemID
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		return nil, err
	}

	req, err := http.NewRequest("POST", apiURL, bytes.NewReader(jsonData))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/json")

	return req, nil
}
```

**Step 2: Build and test**

Run:
```bash
cd apps/cli && go build -o build/hausdog .
./build/hausdog documents --help
./build/hausdog documents upload --help
```

Expected: Shows documents subcommands with upload options

**Step 3: Commit**

```bash
git add apps/cli/
git commit -m "feat: add documents CLI commands with upload"
```

---

### Task 17: Create Remaining CLI Commands (Spaces, Items, Events)

**Files:**
- Create: `apps/cli/cmd/spaces.go`
- Create: `apps/cli/cmd/items.go`
- Create: `apps/cli/cmd/events.go`

Follow the same pattern as properties and documents for each resource. Each file should include:
- list command with appropriate filters
- get command
- create command with required flags
- update command
- delete command

**Step 1: Create spaces.go, items.go, events.go**

(Implement following the same patterns as properties.go)

**Step 2: Build and verify help**

Run:
```bash
cd apps/cli && go build -o build/hausdog .
./build/hausdog --help
```

Expected: Shows all resource commands

**Step 3: Commit**

```bash
git add apps/cli/
git commit -m "feat: add spaces, items, events CLI commands"
```

---

## Phase 4: Integration Testing

### Task 18: Create API Key and Test End-to-End

**Step 1: Create a test API key**

Create a one-off script or use the web UI to generate an API key for testing.

**Step 2: Test full flow**

```bash
export HAUSDOG_API_KEY=hd_<your_key>
export HAUSDOG_API_URL=http://localhost:3333/api/v1

# Test version
./build/hausdog version

# Test properties
./build/hausdog properties list
./build/hausdog properties create --name "Test Home"

# Test document upload
./build/hausdog documents upload --property <id> --file /path/to/test.jpg
```

**Step 3: Verify in web app**

Check that the uploaded document appears in the web app and triggers processing.

---

## Summary

| Phase | Tasks | Description |
|-------|-------|-------------|
| 1 | 1-5 | API foundation (Hono, auth, mounting) |
| 2 | 6-11 | API routes for all resources |
| 3 | 12-17 | Go CLI implementation |
| 4 | 18 | Integration testing |

Total tasks: 18
