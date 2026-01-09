# Hausdog - AI Agent Guide

Home documentation management app for tracking property systems, appliances, and maintenance history.

## Architecture

```
cmd/server/main.go      Entry point, route setup
internal/
  auth/                 Supabase auth (OAuth, sessions, middleware)
  config/               Environment configuration
  database/             PostgreSQL via pgx (models, queries)
  extraction/           Claude AI document extraction
  handlers/             HTTP handlers (upload, review, home)
  storage/              Supabase Storage client
  templates/            HTML template rendering
web/
  static/css/           Tailwind/DaisyUI output
  templates/            HTML templates (layouts, pages, partials)
```

## Tech Stack

- **Backend**: Go 1.23, standard library HTTP server
- **Database**: PostgreSQL via Supabase (local dev uses `supabase start`)
- **Auth**: Supabase Auth with Google OAuth
- **Storage**: Supabase Storage for document files
- **AI**: Claude API for extracting info from uploaded documents
- **Frontend**: Server-rendered HTML with HTMX + Alpine.js, DaisyUI/Tailwind CSS

## Development

```bash
# Start local Supabase (runs PostgreSQL, Auth, Storage locally)
supabase start

# Run server with Doppler secrets
make dev

# Build CSS (after template changes)
make css
```

## Key Patterns

- **Templates**: `internal/templates/` renders pages with layouts. Use `RenderPage()` for full pages, `RenderPartial()` for HTMX fragments.
- **Auth**: `auth.GetUser(r.Context())` returns current user or nil. Use `authMiddleware.RequireAuth()` to protect routes.
- **Database**: All queries in `internal/database/`. Models use pgx with `pgtype` for nullable fields.
- **Storage**: Files stored in Supabase Storage "documents" bucket. Use signed URLs for access.

## Database Schema

Main tables: `properties`, `categories`, `systems`, `documents`, `document_extractions`

Documents flow: Upload -> Store in Supabase -> Claude extracts data -> User reviews -> Linked to system

## Environment Variables

Managed via Doppler (`make dev`) or `.env.local` (`make run`):
- `SUPABASE_URL`, `SUPABASE_KEY`, `SUPABASE_SERVICE_KEY`
- `DATABASE_URL`
- `CLAUDE_API_KEY`
- `SESSION_SECRET`
