# Build stage - Go
FROM golang:1.23-alpine AS go-builder

WORKDIR /app

# Install build dependencies
RUN apk add --no-cache git

# Copy go mod files
COPY go.mod go.sum ./
RUN go mod download

# Copy source code
COPY . .

# Build the binary
RUN CGO_ENABLED=0 GOOS=linux go build -ldflags="-s -w" -o /server ./cmd/server

# Build stage - Node (for Tailwind CSS)
FROM node:20-alpine AS css-builder

WORKDIR /app

# Install pnpm
RUN corepack enable && corepack prepare pnpm@latest --activate

# Copy package files
COPY package.json pnpm-lock.yaml* ./
RUN pnpm install --frozen-lockfile

# Copy Tailwind config and source CSS
COPY tailwind.config.js ./
COPY web/templates ./web/templates
COPY web/static/css/input.css ./web/static/css/

# Build CSS
RUN pnpm run build:css

# Final stage
FROM alpine:3.19

WORKDIR /app

# Install ca-certificates for HTTPS
RUN apk add --no-cache ca-certificates tzdata

# Copy binary from go-builder
COPY --from=go-builder /server /app/server

# Copy static assets
COPY --from=css-builder /app/web/static/css/output.css /app/web/static/css/
COPY web/static /app/web/static
COPY web/templates /app/web/templates

# Create non-root user
RUN adduser -D -g '' appuser
USER appuser

# Expose port
EXPOSE 8080

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD wget --no-verbose --tries=1 --spider http://localhost:8080/health || exit 1

# Run the server
CMD ["/app/server"]
