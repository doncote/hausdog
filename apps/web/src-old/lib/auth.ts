import type { User } from '@supabase/supabase-js'
import { redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { getSafeSession } from './supabase'

/**
 * Router context type for auth.
 * Available in all routes via context.
 */
export type AuthContext = {
  user: User | null
}

/**
 * Safely serialize an object, handling circular references.
 */
function safeSerialize<T>(obj: T): T | null {
  if (!obj) return null
  const seen = new WeakSet()
  return JSON.parse(
    JSON.stringify(obj, (_key, value) => {
      if (typeof value === 'object' && value !== null) {
        if (seen.has(value)) {
          return undefined
        }
        seen.add(value)
      }
      return value
    }),
  )
}

/**
 * Server function to fetch the current session user.
 * Called in __root.tsx beforeLoad to populate auth context.
 */
export const fetchSessionUser = createServerFn({ method: 'GET' }).handler(
  async (): Promise<{ user: User | null; error: string | null }> => {
    const sessionResponse = await getSafeSession()

    if (!sessionResponse || !sessionResponse.session) {
      return { user: null, error: 'No session found' }
    }

    // Serialize user to avoid circular reference issues
    return {
      user: safeSerialize(sessionResponse.user),
      error: null,
    }
  },
)

/**
 * Require authentication from route context.
 * Throws redirect to /login if not authenticated.
 * Use in route beforeLoad.
 *
 * @example
 * ```ts
 * beforeLoad: ({ context }) => {
 *   requireAuthFromContext(context)
 * }
 * ```
 */
export function requireAuthFromContext(context: { user: User | null }): User {
  if (!context.user) {
    throw redirect({ to: '/login' })
  }
  return context.user
}

/**
 * Server function to sign out the current user.
 */
export const signOut = createServerFn({ method: 'POST' }).handler(async () => {
  const { getSupabaseServerClient } = await import('./supabase')
  const supabase = getSupabaseServerClient()
  await supabase.auth.signOut()
  return { success: true }
})
