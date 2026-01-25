import { z } from 'zod'

const serverEnvSchema = z.object({
  // Supabase - Required
  // Get from: https://supabase.com/dashboard/project/_/settings/api
  SUPABASE_URL: z.string().url(),
  SUPABASE_KEY: z.string().min(1), // anon/public key
  SUPABASE_SERVICE_KEY: z.string().min(1).optional(), // service_role key for admin operations

  // Database - Required
  // Get from: Supabase dashboard → Settings → Database → Connection string
  DATABASE_URL: z.string().min(1),

  // Gemini - Required for document extraction
  // Get from: https://aistudio.google.com/app/apikey
  GEMINI_API_KEY: z.string().min(1),

  // Anthropic - Required for resolution and chat
  // Get from: https://console.anthropic.com/settings/keys
  ANTHROPIC_API_KEY: z.string().min(1),

  // Trigger.dev - Optional, for background job processing
  // Get from: https://cloud.trigger.dev
  TRIGGER_API_KEY: z.string().min(1).optional(),
  TRIGGER_API_URL: z.string().url().optional(),

  // Server
  PORT: z.coerce.number().default(3333),
  PUBLIC_URL: z.string().url().optional(),
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
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
  const env = getServerEnv()
  if (env.PUBLIC_URL) return env.PUBLIC_URL
  return `http://localhost:${env.PORT}`
}
