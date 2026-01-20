# Hausdog - AI Agent Guide

Home documentation management app for tracking property systems, appliances, and maintenance history.

## Tech Stack

| Layer | Technology |
|-------|------------|
| Runtime | Bun |
| Framework | TanStack Start (React 19, Vite 7) |
| Language | TypeScript |
| Database | PostgreSQL via Supabase |
| ORM | Prisma 7 with `@prisma/adapter-pg` |
| Auth | Supabase Auth with `@supabase/ssr` |
| Storage | Supabase Storage |
| UI | shadcn/ui + Tailwind CSS v4 |
| Server State | TanStack Query |
| Validation | Zod 4 |

## Project Structure

```
hausdog-web/
├── src/
│   ├── routes/           # TanStack Start file-based routes
│   ├── features/         # Feature modules
│   │   ├── properties/   # service, api, queries, mutations
│   │   ├── systems/
│   │   ├── components/
│   │   ├── documents/
│   │   └── categories/
│   ├── components/
│   │   └── ui/           # shadcn/ui primitives
│   └── lib/
│       ├── db/           # Prisma client
│       ├── supabase.ts   # Supabase client setup
│       └── auth.ts       # Auth helpers
├── prisma/
│   └── schema.prisma     # Database schema
packages/
└── domain/               # Shared Zod schemas + types
supabase/
└── migrations/           # Database migrations
```

## Key Patterns

### Server Functions
Use `createServerFn` for server-side operations called from client components:
```typescript
export const fetchData = createServerFn({ method: 'GET' }).handler(async (params) => {
  // Server-side code here
})
```

### Server Route Handlers
For pure API routes (no client component), use `server.handlers`:
```typescript
export const Route = createFileRoute('/api/endpoint')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Dynamic import server modules to avoid client bundle pollution
        const { serverModule } = await import('@/lib/server-module')
        return new Response(...)
      },
    },
  },
})
```

### Auth
- Use `getSupabaseServerClient()` for server-side auth operations
- Use `getSafeSession()` to get current user in server context
- Protected routes use `requireAuthFromContext(context)` in `beforeLoad`

### Database
- Prisma 7 requires adapter: `PrismaPg` with connection string
- Domain types defined with Zod schemas in `lib/domain/`
- Service layer in `lib/services/` handles business logic

## Development

```bash
# Start local Supabase
supabase start

# Run dev server (uses Doppler for secrets)
make dev

# Or directly
cd hausdog-web && doppler run -- bun run dev
```

## Environment Variables

Managed via Doppler:
- `SUPABASE_URL`, `SUPABASE_KEY`
- `DATABASE_URL`
- `GEMINI_API_KEY` (for document extraction)

## Database Schema

Main tables: `properties`, `categories`, `systems`, `components`, `documents`

## Important Notes

- TanStack Start: server functions cannot import server modules at top level in route files with client components - use dynamic imports
- Prisma 7: uses `prisma-client` generator which requires driver adapter
- Supabase Auth: objects contain non-serializable data - only return needed fields from server functions
