import { test, expect } from '@playwright/test'

/**
 * Item / inventory E2E tests.
 *
 * Tests the item capture flow - adding appliances, systems, and other tracked items.
 */

const REQUIRES_AUTH = !process.env.E2E_TEST_SESSION_TOKEN

test.describe('Item capture flow', () => {
  test.skip(REQUIRES_AUTH, 'Requires E2E_TEST_SESSION_TOKEN - see TESTING.md')

  test('capture page is accessible', async ({ page }) => {
    await page.goto('/capture')
    // Capture page should load without auth redirect
    await expect(page).not.toHaveURL(/\/login/)
  })

  test('inventory page shows items list', async ({ page }) => {
    await page.goto('/inventory')
    await expect(page.getByRole('heading')).toBeVisible()
  })

  test('new item form renders correctly', async ({ page }) => {
    // Navigate to new item page (needs a propertyId in query params in real usage)
    await page.goto('/items/new?propertyId=00000000-0000-0000-0000-000000000001')

    // Form fields should be present
    await expect(page.getByLabel(/Name/i)).toBeVisible()
    await expect(page.getByLabel(/Category/i)).toBeVisible()
  })

  test('new item form validates required fields', async ({ page }) => {
    await page.goto('/items/new?propertyId=00000000-0000-0000-0000-000000000001')

    // Try to submit empty form
    const submitButton = page.getByRole('button', { name: /Add Item|Create|Save/i })
    if (await submitButton.isVisible()) {
      await submitButton.click()
      // Should show validation error
      await expect(page.getByText(/required|Name is required/i)).toBeVisible({ timeout: 3000 })
    }
  })
})
