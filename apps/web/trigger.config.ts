import { defineConfig } from '@trigger.dev/sdk/v3'
import { syncEnvVars } from '@trigger.dev/build/extensions/core'

const EXCLUDED_PREFIXES = ['npm_', 'BUN_', 'HOME', 'PATH', 'SHELL', 'USER', 'LANG', 'TERM', 'DOPPLER_']

export default defineConfig({
  project: 'proj_aeybunmgupltmhuulrbr',
  dirs: ['./trigger'],
  maxDuration: 300, // 5 minutes
  build: {
    extensions: [
      syncEnvVars(async () =>
        Object.entries(process.env)
          .filter(([key]) => !EXCLUDED_PREFIXES.some((p) => key.startsWith(p)))
          .filter(([, value]) => value !== undefined)
          .map(([name, value]) => ({ name, value: value! })),
      ),
    ],
  },
})
