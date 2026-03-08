# Contributing to Hausdog

## Development Setup

### Prerequisites
- [Bun](https://bun.sh) (runtime and package manager)
- [Supabase CLI](https://supabase.com/docs/guides/cli) for local database
- [Doppler](https://www.doppler.com/) for secrets management

### Getting Started

```bash
# Start local Supabase (PostgreSQL + Auth)
make supabase-start

# Configure Doppler (first time only)
make doppler

# Start the dev server
make dev
```

---

## Database Migrations

> **IMPORTANT**: Always use `prisma migrate dev` to change the database schema.
> **Never** use `prisma db push` — it bypasses the migration history and risks schema drift in production.

### How It Works

- Schema is defined in `apps/web/prisma/schema.prisma`
- Migrations live in `apps/web/prisma/migrations/`
- Production migrations run automatically on each Fly.io deploy (via `fly.toml` release command)
- Local dev runs migrations when you run `make migrate`

### Making a Schema Change

```bash
# 1. Edit the schema
vim apps/web/prisma/schema.prisma

# 2. Create and apply the migration
make migrate
# This runs: prisma migrate dev && prisma generate

# 3. Commit the migration files along with your code changes
git add apps/web/prisma/migrations/ apps/web/prisma/schema.prisma
git commit -m "feat: add X column to Y table"
```

### Migration Commands Reference

| Command | What it does | When to use |
|---------|-------------|-------------|
| `make migrate` | Creates migration + applies it locally | **Development** — the standard workflow |
| `make db-generate` | Regenerates Prisma client | After pulling migration changes from main |
| `make db-pull` | Introspects DB into schema | Recovery only, if schema drifted |
| ~~`make db-push`~~ | ~~Pushes schema without migration~~ | **Never use** — schema drift risk |

### Applying Migrations After Pulling from Main

When you pull changes that include new migrations:

```bash
# Apply migrations to local DB and regenerate client
make migrate
```

Prisma will detect and apply any unapplied migrations without creating new ones.

### Production

Migrations run automatically on every deploy via Fly.io release command:
```toml
[deploy]
  release_command = "sh -c 'DATABASE_URL=$DIRECT_URL bunx prisma migrate deploy'"
```

`prisma migrate deploy` applies pending migrations in order. It never creates new migrations — only applies existing ones.

### If You Made a Mistake with db-push

If schema drift occurred from `prisma db push`:

1. Do **not** try to fix it with another `db push`
2. Run `make db-pull` to introspect the current DB state into the schema
3. Compare with the previous committed schema to understand the drift
4. Create a proper migration that captures the change: `bunx prisma migrate dev --name fix_schema_drift`
5. Commit the migration file

---

## Code Style

Hausdog uses [Biome](https://biomejs.dev/) for linting and formatting.

```bash
make lint          # Check for issues
make lint:fix      # Auto-fix issues
```

---

## Testing

See [apps/web/TESTING.md](apps/web/TESTING.md) for the full testing guide.

```bash
make test          # Run unit tests
cd apps/web && bun run test:e2e   # Run E2E tests (requires running dev server)
```

---

## Pull Request Guidelines

- Keep PRs focused — one logical change per PR
- Include migration files when making schema changes
- Run `make test`, `make lint`, and `make tc` before submitting
- Reference the relevant Paperclip issue in the PR description
