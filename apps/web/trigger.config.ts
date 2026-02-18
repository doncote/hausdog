import { defineConfig } from '@trigger.dev/sdk/v3'
import { syncEnvVars } from '@trigger.dev/build/extensions/core'

const SYNCED_ENV_VARS = [
  'DATABASE_URL',
  'SUPABASE_URL',
  'SUPABASE_KEY',
  'SUPABASE_SERVICE_KEY',
  'GEMINI_API_KEY',
  'ANTHROPIC_API_KEY',
  'FIREBASE_SERVICE_ACCOUNT_KEY',
]

export default defineConfig({
  project: 'proj_aeybunmgupltmhuulrbr',
  dirs: ['./trigger'],
  maxDuration: 300, // 5 minutes
  build: {
    extensions: [
      syncEnvVars(async () =>
        SYNCED_ENV_VARS.filter((name) => process.env[name]).map((name) => ({
          name,
          value: process.env[name]!,
        })),
      ),
    ],
  },
})
