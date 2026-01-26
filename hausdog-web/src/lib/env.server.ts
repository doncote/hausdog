import { z } from 'zod'

const serverEnvSchema = z.object({
  // Supabase
  SUPABASE_URL: z.string().url(),
  SUPABASE_KEY: z.string().min(1),
  SUPABASE_SERVICE_KEY: z.string().min(1),

  // Database
  DATABASE_URL: z.string().min(1),

  // Server
  PORT: z.coerce.number(),
  PUBLIC_URL: z.string().url(),

  // Session
  SESSION_SECRET: z.string().min(1),

  // AI
  ANTHROPIC_API_KEY: z.string().min(1),
  GEMINI_API_KEY: z.string().min(1),

  // Node
  NODE_ENV: z.enum(['development', 'production', 'test']),
})

export type ServerEnv = z.infer<typeof serverEnvSchema>

let _serverEnv: ServerEnv | null = null

export function getServerEnv(): ServerEnv {
  if (_serverEnv) return _serverEnv

  const parsed = serverEnvSchema.safeParse(process.env)

  if (!parsed.success) {
    console.error('Invalid server environment variables:')
    console.error(parsed.error.flatten().fieldErrors)
    throw new Error('Invalid server environment variables')
  }

  _serverEnv = parsed.data
  return _serverEnv
}

export function getBaseUrl(): string {
  return getServerEnv().PUBLIC_URL
}
