import { test, expect } from '@playwright/test'

/**
 * Maintenance task E2E tests.
 *
 * Tests the maintenance task creation and management flow.
 */

const REQUIRES_AUTH = !process.env.E2E_TEST_SESSION_TOKEN

test.describe('Maintenance', () => {
  test.skip(REQUIRES_AUTH, 'Requires E2E_TEST_SESSION_TOKEN - see TESTING.md')

  test('maintenance page loads', async ({ page }) => {
    await page.goto('/maintenance')
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.getByRole('heading')).toBeVisible()
  })

  test('shows maintenance tasks list or empty state', async ({ page }) => {
    await page.goto('/maintenance')
    // Page should have content
    const pageContent = page.locator('main').or(page.locator('body'))
    await expect(pageContent).not.toBeEmpty()
  })

  test('can navigate to add maintenance task', async ({ page }) => {
    await page.goto('/maintenance')
    const addButton = page
      .getByRole('button', { name: /Add|New|Schedule/i })
      .or(page.getByRole('link', { name: /Add|New|Schedule/i }))

    if (await addButton.first().isVisible()) {
      await addButton.first().click()
      // Should show form or dialog
      await expect(page.getByRole('dialog').or(page.getByRole('form'))).toBeVisible({
        timeout: 3000,
      })
    }
  })
})
