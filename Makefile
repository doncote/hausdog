.PHONY: dev build preview test lint tc db-pull db-generate db-push supabase-start supabase-stop clean

# Start development server with Doppler secrets
dev:
	cd apps/web && doppler run -- bun run dev

# Build for production
build:
	cd apps/web && doppler run -- bun run build

# Preview production build
preview:
	cd apps/web && doppler run -- bun run preview

# Run tests
test:
	cd apps/web && doppler run -- bun run test

# Run linter
lint:
	cd apps/web && bun run lint

# Run TypeScript type checking
tc:
	cd apps/web && doppler run -- bunx tsc --noEmit

# Introspect database schema
db-pull:
	cd apps/web && doppler run -- bunx prisma db pull

# Generate Prisma client
db-generate:
	cd apps/web && bunx prisma generate

# Push schema to database
db-push:
	cd apps/web && doppler run -- bunx prisma db push

# Start local Supabase
supabase-start:
	supabase start

# Stop local Supabase
supabase-stop:
	supabase stop

# Clean build artifacts
clean:
	rm -rf apps/web/.output apps/web/node_modules/.vite
