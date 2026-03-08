import { test, expect } from '@playwright/test'

/**
 * Authentication flow E2E tests.
 *
 * Note: These tests verify the UI structure of the auth flow.
 * Full OAuth testing requires real credentials (see TESTING.md for local auth setup).
 */
test.describe('Authentication', () => {
  test('redirects unauthenticated users to login', async ({ page }) => {
    await page.goto('/')
    await expect(page).toHaveURL(/\/login/)
  })

  test('login page shows the Hausdog branding', async ({ page }) => {
    await page.goto('/login')
    await expect(page.getByText('Hausdog')).toBeVisible()
    await expect(page.getByText('Welcome')).toBeVisible()
  })

  test('login page shows Google sign-in button', async ({ page }) => {
    await page.goto('/login')
    const googleButton = page.getByRole('button', { name: /Continue with Google/i })
    await expect(googleButton).toBeVisible()
    await expect(googleButton).toBeEnabled()
  })

  test('authenticated users are redirected away from login', async ({ page, context }) => {
    // This test requires pre-authenticated state via storageState
    // See TESTING.md for setup instructions
    test.skip(!process.env.E2E_STORAGE_STATE, 'Requires authenticated storage state')

    await context.addCookies([]) // Reset cookies
    await page.goto('/login')
    // If user is already authenticated, router redirects to dashboard
    await expect(page).not.toHaveURL(/\/login/)
  })
})
