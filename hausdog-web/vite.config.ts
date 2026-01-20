import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'url'
import { nitro } from 'nitro/vite'

const config = defineConfig({
  envPrefix: ['VITE_', 'SUPABASE_'],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
      '@generated': fileURLToPath(new URL('./generated', import.meta.url)),
    },
  },
  plugins: [
    tailwindcss(),
    devtools({ eventBusConfig: { port: 42070 } }),
    nitro(),
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tanstackStart(),
    viteReact(),
  ],
})

export default config
