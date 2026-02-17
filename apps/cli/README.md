# Hausdog CLI

Command-line interface for interacting with Hausdog home documentation data. Designed for LLM agents (Claude Code, OpenClaw) and human users.

## Installation

### Option 1: Download Binary (Recommended)

Download the latest release for your platform from the [releases page](https://github.com/doncote/hausdog/releases).

```bash
# macOS (Apple Silicon)
curl -LO https://github.com/doncote/hausdog/releases/latest/download/hausdog_Darwin_arm64.tar.gz
tar xzf hausdog_Darwin_arm64.tar.gz
sudo mv hausdog /usr/local/bin/

# macOS (Intel)
curl -LO https://github.com/doncote/hausdog/releases/latest/download/hausdog_Darwin_amd64.tar.gz
tar xzf hausdog_Darwin_amd64.tar.gz
sudo mv hausdog /usr/local/bin/

# Linux (amd64)
curl -LO https://github.com/doncote/hausdog/releases/latest/download/hausdog_Linux_amd64.tar.gz
tar xzf hausdog_Linux_amd64.tar.gz
sudo mv hausdog /usr/local/bin/

# Linux (arm64)
curl -LO https://github.com/doncote/hausdog/releases/latest/download/hausdog_Linux_arm64.tar.gz
tar xzf hausdog_Linux_arm64.tar.gz
sudo mv hausdog /usr/local/bin/
```

### Option 2: Build from Source

```bash
git clone https://github.com/hausdog/hausdog.git
cd hausdog/apps/cli
make install        # Installs to $GOPATH/bin
# or
make install-global # Installs to /usr/local/bin (requires sudo)
```

### Option 3: Go Install (from source)

If you have Go installed and have cloned the repo:

```bash
cd apps/cli
go install .
mv $(go env GOPATH)/bin/cli $(go env GOPATH)/bin/hausdog
```

## Configuration

The CLI requires an API key. Generate one from Settings > API Keys in the Hausdog web app.

### Environment Variables

```bash
export HAUSDOG_API_KEY="hd_your_api_key_here"
export HAUSDOG_API_URL="https://your-hausdog-instance.com"  # Optional, defaults to localhost:3000
```

### Command-line Flags

```bash
hausdog --api-key="hd_..." --api-url="https://..." <command>
```

## Usage

### Check Version and API Health

```bash
hausdog version
```

### Properties

```bash
# List all properties
hausdog properties list

# Get a specific property
hausdog properties get <id>

# Create a property
hausdog properties create --name "123 Main St" --address "123 Main St, City, ST 12345"

# Update a property
hausdog properties update <id> --name "New Name"

# Delete a property
hausdog properties delete <id>
```

### Spaces

```bash
hausdog spaces list --property-id <property-id>
hausdog spaces get <id>
hausdog spaces create --property-id <id> --name "Kitchen" --type "room"
hausdog spaces update <id> --name "Updated Name"
hausdog spaces delete <id>
```

### Items

```bash
hausdog items list --space-id <space-id>
hausdog items get <id>
hausdog items create --space-id <id> --name "Refrigerator" --manufacturer "Samsung"
hausdog items update <id> --name "Updated Name"
hausdog items delete <id>
```

### Events

```bash
hausdog events list --item-id <item-id>
hausdog events get <id>
hausdog events create --item-id <id> --type "maintenance" --title "Filter replaced"
hausdog events update <id> --title "Updated Title"
hausdog events delete <id>
```

### Documents

```bash
# List documents for an item
hausdog documents list --item-id <item-id>

# Get document details
hausdog documents get <id>

# Upload a document from a file path
hausdog documents upload --item-id <id> --file /path/to/document.pdf --name "Manual"

# Delete a document
hausdog documents delete <id>
```

## Output Formats

```bash
# JSON output (default)
hausdog properties list --format json

# Table output for human readability
hausdog properties list --format table
```

## For LLM Agents

This CLI is designed for seamless integration with LLM agents:

1. **Structured output**: Use `--format json` for machine-parseable responses
2. **Document upload**: Upload photos/PDFs from local file paths for OCR processing
3. **Error handling**: Non-zero exit codes and JSON error messages for programmatic handling

### Example: OpenClaw Document Upload

```bash
# Upload a Telegram photo to an item
hausdog documents upload \
  --item-id "item-uuid" \
  --file "/tmp/telegram_photo.jpg" \
  --name "Appliance photo"
```

## Development

```bash
# Build
make build

# Run tests
make test

# Lint
make lint

# Generate client from OpenAPI spec (requires API server running)
make generate
```

## Releasing

To create a new release:

```bash
# Tag the release (use cli/ prefix)
git tag cli/v1.0.0
git push origin cli/v1.0.0
```

GitHub Actions will automatically build binaries for all platforms and create a release.
