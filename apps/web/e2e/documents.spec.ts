import { test, expect } from '@playwright/test'

/**
 * Document management E2E tests.
 *
 * Tests document upload and review flow.
 */

const REQUIRES_AUTH = !process.env.E2E_TEST_SESSION_TOKEN

test.describe('Documents', () => {
  test.skip(REQUIRES_AUTH, 'Requires E2E_TEST_SESSION_TOKEN - see TESTING.md')

  test('documents page loads', async ({ page }) => {
    await page.goto('/documents')
    await expect(page).not.toHaveURL(/\/login/)
    await expect(page.getByRole('heading')).toBeVisible()
  })

  test('review page is accessible', async ({ page }) => {
    await page.goto('/review')
    await expect(page).not.toHaveURL(/\/login/)
  })

  test('document upload button is visible', async ({ page }) => {
    await page.goto('/documents')
    // Some form of upload affordance should exist
    const uploadElement = page.getByRole('button', { name: /upload|add document/i })
      .or(page.getByText(/upload|drag.*drop/i))
    await expect(uploadElement.first()).toBeVisible()
  })
})
