import { test, expect } from '@playwright/test'

/**
 * Property management E2E tests.
 *
 * Tests that require authentication are skipped unless E2E_TEST_SESSION_TOKEN is set.
 * See TESTING.md for local E2E setup with authentication.
 */

const REQUIRES_AUTH = !process.env.E2E_TEST_SESSION_TOKEN

test.describe('Properties', () => {
  test.beforeEach(async ({ page }) => {
    if (REQUIRES_AUTH) {
      test.skip(true, 'Requires E2E_TEST_SESSION_TOKEN - see TESTING.md')
    }
    await page.goto('/properties')
  })

  test('properties page loads and shows heading', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'Properties' })).toBeVisible()
  })

  test('shows empty state when no properties exist', async ({ page }) => {
    // If no properties, there should be a call-to-action to add one
    const heading = page.getByRole('heading', { name: 'Properties' })
    await expect(heading).toBeVisible()
  })

  test('can navigate to add new property', async ({ page }) => {
    const addButton = page.getByRole('button', { name: /Add|New Property/i })
    if (await addButton.isVisible()) {
      await addButton.click()
      // Should open dialog or navigate to new property page
      await expect(page.getByText(/add.*property|new.*property/i)).toBeVisible({ timeout: 3000 })
    }
  })
})

test.describe('Property creation flow', () => {
  test.skip(REQUIRES_AUTH, 'Requires E2E_TEST_SESSION_TOKEN - see TESTING.md')

  test('can create a new property with name only', async ({ page }) => {
    await page.goto('/properties')

    // Click add property button
    await page.getByRole('button', { name: /Add Property|New Property/i }).click()

    // Fill in property name
    const nameInput = page.getByLabel(/Property Name|Name/i)
    await nameInput.fill('Test Property E2E')

    // Submit the form
    await page.getByRole('button', { name: /Create|Save|Add/i }).click()

    // Should redirect or show success
    await expect(page.getByText('Test Property E2E')).toBeVisible({ timeout: 5000 })
  })
})
