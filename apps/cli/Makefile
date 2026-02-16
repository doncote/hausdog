.PHONY: build install clean generate

VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
COMMIT ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown")
LDFLAGS := -ldflags "-X github.com/hausdog/cli/cmd.Version=$(VERSION) -X github.com/hausdog/cli/cmd.Commit=$(COMMIT)"

build:
	go build $(LDFLAGS) -o bin/hausdog .

install:
	go install $(LDFLAGS) .

clean:
	rm -rf bin/

# Generate client from OpenAPI spec
# Requires: go install github.com/oapi-codegen/oapi-codegen/v2/cmd/oapi-codegen@latest
generate:
	@echo "Fetching OpenAPI spec from API..."
	curl -s http://localhost:3000/api/v1/openapi.json -o openapi.json
	oapi-codegen -package client -generate types,client openapi.json > internal/client/generated.go
	rm openapi.json
	@echo "Client generated successfully"

test:
	go test ./...

lint:
	golangci-lint run
