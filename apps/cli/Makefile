.PHONY: build install clean generate test lint

VERSION ?= $(shell git describe --tags --always --dirty 2>/dev/null || echo "dev")
COMMIT ?= $(shell git rev-parse --short HEAD 2>/dev/null || echo "unknown")
LDFLAGS := -ldflags "-X github.com/hausdog/cli/cmd.Version=$(VERSION) -X github.com/hausdog/cli/cmd.Commit=$(COMMIT)"
GOBIN ?= $(shell go env GOPATH)/bin

build:
	go build $(LDFLAGS) -o bin/hausdog .

# Install to GOPATH/bin as 'hausdog'
install: build
	cp bin/hausdog $(GOBIN)/hausdog
	@echo "Installed to $(GOBIN)/hausdog"

# Install globally to /usr/local/bin (requires sudo)
install-global: build
	sudo cp bin/hausdog /usr/local/bin/hausdog
	@echo "Installed to /usr/local/bin/hausdog"

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
