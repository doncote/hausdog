# Hausdog

Home documentation management app that helps you track your property's systems, appliances, and maintenance history. Upload receipts and documents, and AI automatically extracts and organizes the information.

## Features

- **Document Upload**: Drag & drop or use camera to capture receipts, manuals, and warranty documents
- **AI Extraction**: Claude AI automatically extracts key information from uploaded documents
- **Review Queue**: Review and confirm AI-extracted data before saving
- **Property Management**: Organize systems by property and category (HVAC, Plumbing, Electrical, etc.)
- **Service History**: Track maintenance and service records

## Tech Stack

- **Backend**: Go 1.23 with standard library HTTP server
- **Database**: PostgreSQL via Supabase
- **Auth**: Supabase Auth with Google OAuth
- **Storage**: Supabase Storage
- **AI**: Claude API for document extraction
- **Frontend**: DaisyUI + Tailwind CSS + Alpine.js + HTMX
- **Deployment**: Fly.io

## Prerequisites

- Go 1.23+
- Node.js 18+ with pnpm
- Supabase project
- Claude API key
- Fly.io account (for deployment)

## Local Development

### 1. Clone and Install Dependencies

```bash
git clone https://github.com/don/hausdog
cd hausdog

# Install Go dependencies
go mod download

# Install Node dependencies and build CSS
pnpm install
pnpm run build:css
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Run the migration in `migrations/001_initial_schema.sql` via the SQL Editor
3. Enable Google OAuth in Authentication > Providers > Google
4. Create a storage bucket named `documents` (private, 50MB file size limit)

### 3. Configure Environment

This project uses [Doppler](https://doppler.com) for secrets management.

```bash
# Install Doppler CLI (macOS)
brew install dopplerhq/cli/doppler

# Login and set up project
doppler login
doppler setup  # Select 'web' project, 'dev' config
```

Alternatively, create a `.env.local` file for local development without Doppler.

### 4. Run the Server

```bash
# Start server with Doppler secrets
make dev

# Or run without Doppler (uses .env.local)
make run

# Build CSS
make css

# Watch CSS for changes (in separate terminal)
make css-watch
```

Visit http://localhost:8080

## Deployment to Fly.io

### 1. Install Fly CLI

```bash
curl -L https://fly.io/install.sh | sh
fly auth login
```

### 2. Create App and Set Secrets

```bash
fly apps create hausdog

fly secrets set \
  SUPABASE_URL="https://your-project.supabase.co" \
  SUPABASE_KEY="your-anon-key" \
  SUPABASE_SERVICE_KEY="your-service-key" \
  DATABASE_URL="postgresql://..." \
  CLAUDE_API_KEY="your-claude-key" \
  SESSION_SECRET="your-session-secret"
```

### 3. Deploy

```bash
fly deploy
```

## Project Structure

```
hausdog/
├── cmd/server/          # Main application entry point
├── internal/
│   ├── auth/            # Supabase auth client and middleware
│   ├── config/          # Environment configuration
│   ├── database/        # Database models and queries
│   ├── extraction/      # Claude AI document extraction
│   ├── handlers/        # HTTP handlers
│   ├── storage/         # Supabase storage client
│   └── templates/       # Template rendering
├── migrations/          # SQL migrations
├── web/
│   ├── static/css/      # Tailwind CSS output
│   └── templates/       # HTML templates
├── Dockerfile
├── fly.toml
└── tailwind.config.js
```

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `PORT` | No | Server port (default: 8080) |
| `LOG_LEVEL` | No | Log level (default: info) |
| `SUPABASE_URL` | Yes | Supabase project URL |
| `SUPABASE_KEY` | Yes | Supabase anon key |
| `SUPABASE_SERVICE_KEY` | Yes | Supabase service role key |
| `DATABASE_URL` | Yes | PostgreSQL connection string |
| `CLAUDE_API_KEY` | Yes | Anthropic Claude API key |
| `SESSION_SECRET` | Yes | Secret for session encryption |

## License

MIT
