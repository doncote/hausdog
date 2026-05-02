import { createClient } from '@supabase/supabase-js'

/** Resolve a Supabase user ID to their email. Returns null if env vars are missing or user not found. */
export async function getUserEmail(userId: string): Promise<string | null> {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_KEY
  if (!url || !key) return null
  const admin = createClient(url, key, { auth: { persistSession: false } })
  const { data } = await admin.auth.admin.getUserById(userId)
  return data.user?.email ?? null
}
