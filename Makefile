.PHONY: dev watch run build css css-watch supabase-start supabase-stop clean test web

# Development with Doppler secrets
dev:
	doppler run -- go run ./cmd/server

# Development with hot reload (requires: go install github.com/air-verse/air@latest)
watch:
	doppler run -- air

# Run without Doppler (uses .env.local)
run:
	go run ./cmd/server

# Build binary
build:
	go build -o bin/server ./cmd/server

# Build CSS
css:
	pnpm run build:css

# Watch CSS for changes
css-watch:
	pnpm run watch:css

# Start local Supabase
supabase-start:
	supabase start

# Stop local Supabase
supabase-stop:
	supabase stop

# Run tests
test:
	go test ./...

# Clean build artifacts
clean:
	rm -rf bin/

# Start TanStack Start web app with Doppler secrets
web:
	cd hausdog-web && doppler run -- pnpm dev
