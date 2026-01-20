.PHONY: dev build test lint supabase-start supabase-stop clean tc

# Start development server with Doppler secrets
dev:
	cd hausdog-web && doppler run -- bun run dev

# Build for production
build:
	cd hausdog-web && bun run build

# Run tests
test:
	cd hausdog-web && bun run test

# Run linter
lint:
	cd hausdog-web && bun run lint

# Run TypeScript type checking
tc:
	cd hausdog-web && bunx tsc --noEmit

# Start local Supabase
supabase-start:
	supabase start

# Stop local Supabase
supabase-stop:
	supabase stop

# Clean build artifacts
clean:
	rm -rf hausdog-web/.output hausdog-web/node_modules/.vite
