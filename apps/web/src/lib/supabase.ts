import { createBrowserClient, createServerClient } from '@supabase/ssr'
import { getCookies, setCookie } from '@tanstack/react-start/server'
import { getClientEnv } from './client-env'
import { getServerEnv } from './env'

/**
 * Creates a Supabase server client using TanStack Start server utilities for cookie handling.
 * Use this in server functions and loaders.
 */
export function getSupabaseServerClient() {
  const env = getServerEnv()
  return createServerClient(env.SUPABASE_URL, env.SUPABASE_KEY, {
    cookies: {
      getAll() {
        const cookies = getCookies()
        return Object.entries(cookies).map(([name, value]) => ({
          name,
          value: value ?? '',
        }))
      },
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value, options }) => {
          setCookie(name, value, options)
        })
      },
    },
  })
}

/**
 * Gets the current session and user from Supabase.
 * Returns null values if no session exists.
 */
export async function getSafeSession() {
  const supabase = getSupabaseServerClient()

  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return { session: null, user: null, error: 'No session found' }
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser()

  if (userError) {
    return { session, user: null, error: userError.message }
  }

  return { session, user, error: null }
}

/**
 * Creates a Supabase browser client for client-side usage.
 */
export function getSupabaseBrowserClient() {
  const env = getClientEnv()
  return createBrowserClient(env.SUPABASE_URL, env.SUPABASE_KEY)
}
