import { defineConfig } from '@trigger.dev/sdk/v3'

export default defineConfig({
  project: 'hausdog',
  dirs: ['./trigger'],
  maxDuration: 300, // 5 minutes
})
