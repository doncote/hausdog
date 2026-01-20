# Hausdog

Home documentation management app that helps you track your property's systems, appliances, and maintenance history. Upload receipts and documents, and AI automatically extracts and organizes the information.

## Features

- **Document Upload**: Drag & drop multiple files to capture receipts, manuals, and warranty documents
- **AI Extraction**: Gemini AI automatically extracts equipment info, costs, and warranty details
- **Property Management**: Organize systems by property and category (HVAC, Plumbing, Electrical, etc.)
- **Components**: Track individual parts and replaceable items within systems
- **Service History**: Track maintenance and service records

## Tech Stack

- **Framework**: TanStack Start (React 19, Vite 7)
- **Language**: TypeScript
- **Database**: PostgreSQL via Supabase
- **ORM**: Prisma 7
- **Auth**: Supabase Auth with Google OAuth
- **Storage**: Supabase Storage
- **AI**: Gemini 2.0 Flash for document extraction
- **UI**: shadcn/ui + Tailwind CSS v4
- **State**: TanStack Query

## Prerequisites

- Bun 1.0+
- Supabase project (local or cloud)
- Gemini API key
- Doppler account (for secrets management)

## Local Development

### 1. Clone and Install

```bash
git clone https://github.com/don/hausdog
cd hausdog
bun install
```

### 2. Set Up Supabase

```bash
# Start local Supabase
supabase start

# Apply migrations
cd hausdog-web
bunx prisma db push
```

### 3. Configure Secrets

This project uses [Doppler](https://doppler.com) for secrets management.

```bash
# Install Doppler CLI
brew install dopplerhq/cli/doppler

# Login and set up
doppler login
doppler setup
```

Required secrets:
- `SUPABASE_URL`
- `SUPABASE_KEY`
- `DATABASE_URL`
- `GEMINI_API_KEY`

### 4. Run Development Server

```bash
make dev
```

Visit http://localhost:3333

## Project Structure

```
hausdog/
├── hausdog-web/           # TanStack Start app
│   ├── src/
│   │   ├── routes/        # File-based routing
│   │   ├── features/      # Feature modules (properties, systems, documents, etc.)
│   │   ├── components/    # Shared UI components
│   │   └── lib/           # Utilities, DB client, auth
│   └── prisma/
│       └── schema.prisma
├── packages/
│   └── domain/            # Shared Zod schemas and types
├── supabase/
│   └── migrations/        # Database migrations
└── Makefile
```

## Commands

```bash
make dev              # Start dev server
make build            # Production build
make test             # Run tests
make lint             # Run linter
make tc               # TypeScript check
make supabase-start   # Start local Supabase
make supabase-stop    # Stop local Supabase
```

## License

MIT
