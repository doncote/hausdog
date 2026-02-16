# Hausdog CLI Design

## Overview

A Go CLI for LLM agents (Claude Code, OpenClaw) to interact with Hausdog data. Designed for discoverability and structured output, not human TUI.

## Architecture

```
┌─────────────────┐     HTTP/JSON      ┌──────────────────────┐
│   Go CLI        │ ◄────────────────► │  TanStack Start App  │
│   (Cobra +      │                    │  ┌────────────────┐  │
│    oapi-codegen)│                    │  │ Hono API       │  │
│                 │                    │  │ /api/v1/*      │  │
└─────────────────┘                    │  └───────┬────────┘  │
                                       │          │           │
                                       │  ┌───────▼────────┐  │
                                       │  │ Existing       │  │
                                       │  │ Services       │  │
                                       │  └────────────────┘  │
                                       └──────────────────────┘
```

## Components

### 1. Web App: Hono API Layer

Location: `apps/web/src/api/`

- Hono app mounted at `/api/v1`
- Zod OpenAPI route definitions via `@hono/zod-openapi`
- Calls existing service classes
- API key auth middleware
- OpenAPI spec export at `/api/v1/openapi.json`

### 2. Go CLI

Location: `apps/cli/`

- Cobra command framework
- Generated HTTP client from OpenAPI spec (oapi-codegen)
- JSON output by default, `--format` flag for table/yaml
- Config via env vars (`HAUSDOG_API_URL`, `HAUSDOG_API_KEY`)

## Command Structure

```
hausdog
├── properties
│   ├── list                    # List all properties
│   ├── get <id>                # Get property details
│   ├── create                  # Create property (flags for fields)
│   ├── update <id>             # Update property
│   └── delete <id>             # Delete property
├── spaces
│   ├── list --property <id>    # List spaces for property
│   ├── get <id>
│   ├── create --property <id>
│   ├── update <id>
│   └── delete <id>
├── items
│   ├── list --property <id> [--space <id>] [--category <cat>]
│   ├── get <id>
│   ├── create --property <id> --name <n> --category <c> [...]
│   ├── update <id>
│   ├── delete <id>
│   └── children <id>           # List child items
├── events
│   ├── list --item <id>
│   ├── get <id>
│   ├── create --item <id> --type <t> --date <d>
│   ├── update <id>
│   └── delete <id>
├── documents
│   ├── list --property <id> [--item <id>] [--status <s>]
│   ├── get <id>
│   ├── upload --property <id> --file <path>   # Key workflow
│   │         [--item <id>] [--stdin] [--url <url>]
│   └── delete <id>
└── version                     # CLI version + API health check
```

### Global Flags

- `--api-url` / `HAUSDOG_API_URL`
- `--api-key` / `HAUSDOG_API_KEY`
- `--format json|table|yaml` (default: json)
- `--help`

## API Routes

### Properties

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/properties` | List user's properties |
| GET | `/properties/:id` | Get property |
| POST | `/properties` | Create property |
| PATCH | `/properties/:id` | Update property |
| DELETE | `/properties/:id` | Delete property |

### Spaces

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/properties/:propertyId/spaces` | List spaces |
| GET | `/spaces/:id` | Get space |
| POST | `/properties/:propertyId/spaces` | Create space |
| PATCH | `/spaces/:id` | Update space |
| DELETE | `/spaces/:id` | Delete space |

### Items

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/properties/:propertyId/items` | List items (query: spaceId, category) |
| GET | `/items/:id` | Get item with relations |
| GET | `/items/:id/children` | List child items |
| POST | `/properties/:propertyId/items` | Create item |
| PATCH | `/items/:id` | Update item |
| DELETE | `/items/:id` | Delete item |

### Events

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/items/:itemId/events` | List events for item |
| GET | `/events/:id` | Get event |
| POST | `/items/:itemId/events` | Create event |
| PATCH | `/events/:id` | Update event |
| DELETE | `/events/:id` | Delete event |

### Documents

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/properties/:propertyId/documents` | List documents (query: itemId, status) |
| GET | `/documents/:id` | Get document |
| POST | `/properties/:propertyId/documents/upload` | Upload document (multipart) |
| DELETE | `/documents/:id` | Delete document |

### Auth

| Method | Route | Description |
|--------|-------|-------------|
| GET | `/auth/me` | Verify API key, return user info |

## Document Upload Workflow

The key flow: Telegram photo → OpenClaw → CLI → API → OCR pipeline

### CLI Usage

```bash
# Primary: file path
hausdog documents upload --property <id> --file /tmp/photo.jpg

# Optional: associate with item
hausdog documents upload --property <id> --file /tmp/photo.jpg --item <itemId>

# Fallback: stdin (base64)
cat photo.jpg | base64 | hausdog documents upload --property <id> --stdin

# Fallback: URL
hausdog documents upload --property <id> --url https://example.com/photo.jpg
```

### API Flow

1. Accept multipart file upload (or base64 body, or URL)
2. Upload to Supabase Storage
3. Create Document record with `status: "pending"`
4. Trigger existing OCR/extraction workflow (Trigger.dev task)
5. Return document ID + status

### Response

```json
{
  "id": "doc-uuid",
  "status": "pending",
  "fileName": "photo.jpg",
  "message": "Document queued for processing"
}
```

Agent can poll `hausdog documents get <id>` to check extraction status/results.

## Authentication

### API Key Model

- Store API keys in a new `api_keys` table
- Keys are hashed (sha256), never stored plain
- Scoped to a user (inherits their permissions)

### Schema Addition

```prisma
model ApiKey {
  id          String    @id @default(uuid())
  userId      String    @map("user_id") @db.Uuid
  name        String                           // e.g., "openclaw-agent"
  keyHash     String    @unique @map("key_hash")
  lastUsedAt  DateTime? @map("last_used_at")
  createdAt   DateTime  @default(now()) @map("created_at")

  @@index([keyHash])
  @@map("api_keys")
}
```

### Auth Middleware

- Read `Authorization: Bearer <key>` header
- Hash key, lookup in `api_keys`
- Attach `userId` to request context
- Services use this userId (same as current auth)

### Key Format

- Prefix: `hd_`
- 32 random bytes (base62)
- Example: `hd_abc123...`

### Key Generation

Generate via web UI or one-off script for now.

## Project Structure

### Web App Additions (`apps/web/`)

```
src/
├── api/
│   ├── index.ts              # Hono app, mount at /api/v1
│   ├── middleware/
│   │   └── auth.ts           # API key auth middleware
│   ├── routes/
│   │   ├── properties.ts     # Property routes
│   │   ├── spaces.ts
│   │   ├── items.ts
│   │   ├── events.ts
│   │   ├── documents.ts
│   │   └── auth.ts
│   └── openapi.ts            # Spec export
prisma/
└── schema.prisma             # + ApiKey model
```

### New Go CLI (`apps/cli/`)

```
apps/cli/
├── cmd/
│   ├── root.go               # Root command, global flags
│   ├── properties.go
│   ├── spaces.go
│   ├── items.go
│   ├── events.go
│   ├── documents.go
│   └── version.go
├── internal/
│   └── client/               # Generated from OpenAPI
├── main.go
├── go.mod
├── go.sum
└── Makefile                  # generate client, build, etc.
```

## Tech Stack

| Component | Technology |
|-----------|------------|
| API Framework | Hono + @hono/zod-openapi |
| Auth | API key (hashed, per-user) |
| CLI Framework | Cobra |
| HTTP Client Gen | oapi-codegen |
| Key workflow | `documents upload --file` → OCR pipeline |
