import { z } from 'zod'

const clientEnvSchema = z.object({
  SUPABASE_URL: z.string().url(),
  SUPABASE_KEY: z.string().min(1),
})

export type ClientEnv = z.infer<typeof clientEnvSchema>

let _clientEnv: ClientEnv | null = null

export function getClientEnv(): ClientEnv {
  if (_clientEnv) return _clientEnv

  // These are exposed via Vite's envPrefix config
  const parsed = clientEnvSchema.safeParse({
    SUPABASE_URL: import.meta.env.SUPABASE_URL,
    SUPABASE_KEY: import.meta.env.SUPABASE_KEY,
  })

  if (!parsed.success) {
    console.error('Invalid client environment variables:')
    console.error(parsed.error.flatten().fieldErrors)
    throw new Error('Invalid client environment variables')
  }

  _clientEnv = parsed.data
  return _clientEnv
}
