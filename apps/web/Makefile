.PHONY: dev build preview test db-pull db-generate

# Run dev server with Doppler secrets
dev:
	doppler run -p web -c dev -- bun --bun run dev

# Build for production
build:
	doppler run -p web -c dev -- bun run build

# Preview production build
preview:
	doppler run -p web -c dev -- bun run preview

# Run tests
test:
	doppler run -p web -c dev -- bun run test

# Introspect database schema
db-pull:
	doppler run -p web -c dev -- bunx prisma db pull

# Generate Prisma client
db-generate:
	bunx prisma generate
