# Testing Guide

## Overview

Hausdog uses two testing layers:

| Layer | Tool | Command | Purpose |
|-------|------|---------|---------|
| Unit / Integration | Vitest | `bun run test` | Service logic, schema validation, utilities |
| End-to-End | Playwright | `bun run test:e2e` | Core user flows in a real browser |

---

## Unit Tests (Vitest)

### Running Tests

```bash
# Run all unit tests (single pass)
bun run test

# Run in watch mode during development
bun run test:watch

# Run with coverage report
bun run test:coverage
```

### Configuration

Tests are configured in `vitest.config.ts`. Key settings:
- **Environment**: `jsdom` for DOM-dependent code
- **Path aliases**: `@/*` maps to `src/*` matching `tsconfig.json`
- **Setup file**: `src/test/setup.ts` for global test utilities

### File Conventions

Place test files alongside the source they test:

```
src/
  lib/
    utils.ts
    utils.test.ts          ← unit test
    ingest-token.ts
    ingest-token.test.ts   ← unit test
  features/
    properties/
      service.ts
      service.test.ts      ← unit test (with mocked Prisma)
      types.ts
      types.test.ts        ← schema validation test
```

### Writing Unit Tests

Import from `vitest` directly (no globals required, but globals are enabled):

```typescript
import { describe, expect, it, vi } from 'vitest'

describe('MyService', () => {
  it('does something', () => {
    expect(true).toBe(true)
  })
})
```

### Mocking Prisma

Services accept injected dependencies (`PrismaClient`, `Logger`). Mock them with `vi.fn()`:

```typescript
const mockDb = {
  property: {
    findMany: vi.fn().mockResolvedValue([]),
    create: vi.fn(),
  },
}

const service = new PropertyService({
  db: mockDb as unknown as PrismaClient,
  logger: mockLogger,
})
```

---

## E2E Tests (Playwright)

### Running Tests

```bash
# Run E2E tests (requires dev server running, or Playwright starts it)
bun run test:e2e

# Run with Playwright UI for debugging
bun run test:e2e:ui

# Run specific test file
bunx playwright test e2e/auth.spec.ts
```

### Prerequisites

1. **Local dev server**: Playwright will start the dev server automatically (via `webServer` in `playwright.config.ts`). Ensure local Supabase is running:
   ```bash
   supabase start
   make dev
   ```

2. **Authentication**: Most E2E tests require a real session. Set up auth by providing a session token:
   ```bash
   export E2E_TEST_SESSION_TOKEN="your-supabase-access-token"
   ```

   To get a token for a test user, you can use the Supabase local dashboard at `http://localhost:54323`.

### Storage State (Persistent Auth)

To avoid logging in on every test run, save your authenticated state:

```bash
# Run the auth setup script (creates auth.json)
bunx playwright test e2e/global-setup.ts
export E2E_STORAGE_STATE=e2e/auth.json
```

### Test Structure

```
e2e/
  auth.spec.ts        ← Login flow, redirect behavior
  properties.spec.ts  ← Property CRUD flows
  items.spec.ts       ← Item capture and management
  documents.spec.ts   ← Document upload and review
  maintenance.spec.ts ← Maintenance task management
  helpers/
    auth.ts           ← Shared auth utilities
```

### Writing E2E Tests

```typescript
import { test, expect } from '@playwright/test'

test('user can view properties page', async ({ page }) => {
  await page.goto('/properties')
  await expect(page.getByRole('heading', { name: 'Properties' })).toBeVisible()
})
```

Use `test.skip()` for tests that require auth but token isn't available:

```typescript
const REQUIRES_AUTH = !process.env.E2E_TEST_SESSION_TOKEN

test.describe('Protected flow', () => {
  test.skip(REQUIRES_AUTH, 'Requires E2E_TEST_SESSION_TOKEN')

  test('does protected thing', async ({ page }) => {
    // ...
  })
})
```

---

## CI

GitHub Actions runs unit tests on every PR and push to main:

```yaml
- name: Test
  run: bun run test
```

E2E tests are **not run in CI by default** because they require a running Supabase instance. To add E2E to CI:

1. Set up Supabase in CI (see `supabase/config.toml`)
2. Add a seeded test user and generate a session token
3. Add a CI step:
   ```yaml
   - name: Install Playwright browsers
     run: bunx playwright install --with-deps chromium
   - name: Run E2E tests
     run: bun run test:e2e
     env:
       E2E_TEST_SESSION_TOKEN: ${{ secrets.E2E_TEST_SESSION_TOKEN }}
   ```

---

## Patterns & Tips

### Test service logic, not the database

Services use dependency injection — mock the DB and test business logic in isolation.

### Prefer integration tests for complex flows

For multi-step server functions, integration tests against a test DB are more reliable than mocking every call.

### Keep E2E tests focused on user-visible behavior

E2E tests should check what users see and do, not implementation details. Use role-based selectors:
- `page.getByRole('button', { name: 'Save' })` ✅
- `page.locator('[data-testid="submit-btn"]')` ✅
- `page.locator('.btn-primary.submit')` ❌

### Snapshot tests

Vitest supports snapshot testing for serializable outputs:

```typescript
expect(transformedData).toMatchSnapshot()
```
