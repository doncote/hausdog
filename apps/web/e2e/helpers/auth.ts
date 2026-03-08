import type { Page } from '@playwright/test'

/**
 * Helper to set up an authenticated session for E2E tests.
 *
 * Uses a pre-seeded test account. Requires E2E_TEST_EMAIL and E2E_TEST_SESSION_TOKEN
 * environment variables to be set (see TESTING.md).
 *
 * In a real setup, you'd use Supabase's admin API to create a test session
 * and inject the auth cookies.
 */
export async function setupAuthenticatedSession(page: Page): Promise<void> {
  const sessionToken = process.env.E2E_TEST_SESSION_TOKEN
  if (!sessionToken) {
    throw new Error(
      'E2E_TEST_SESSION_TOKEN not set. See TESTING.md for E2E auth setup instructions.',
    )
  }

  // Inject Supabase auth cookies
  // The actual cookie names depend on your Supabase project ref
  await page.context().addCookies([
    {
      name: 'sb-access-token',
      value: sessionToken,
      domain: 'localhost',
      path: '/',
      httpOnly: true,
      secure: false,
    },
  ])
}

/**
 * Navigate to a page that requires auth. If not authenticated, will redirect to login.
 */
export async function gotoAuthenticated(page: Page, path: string): Promise<void> {
  await page.goto(path)
  // If redirected to login, auth setup is needed
  if (page.url().includes('/login')) {
    throw new Error(
      `Not authenticated. Use setupAuthenticatedSession() before navigating to ${path}`,
    )
  }
}
