import type { PluginOption } from 'vite'
import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'
import { tanstackStart } from '@tanstack/react-start/plugin/vite'
import viteReact from '@vitejs/plugin-react'
import viteTsConfigPaths from 'vite-tsconfig-paths'
import tailwindcss from '@tailwindcss/vite'
import { fileURLToPath, URL } from 'url'
import { nitro } from 'nitro/vite'
import { VitePWA } from 'vite-plugin-pwa'

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
    nitro() as PluginOption,
    viteTsConfigPaths({
      projects: ['./tsconfig.json'],
    }),
    tanstackStart(),
    viteReact(),
    VitePWA({
      registerType: 'autoUpdate',
      strategies: 'generateSW',
      // Don't inject the manifest link tag - we manage it manually in __root.tsx
      injectRegister: 'auto',
      workbox: {
        // Cache static assets
        globPatterns: ['**/*.{js,css,ico,png,svg,woff,woff2}'],
        // SSR app - do not use navigateFallback (server handles navigation)
        navigateFallback: null,
        // Skip waiting so updates apply immediately
        skipWaiting: true,
        clientsClaim: true,
        runtimeCaching: [
          {
            // Don't cache API/server function routes
            urlPattern: /^\/api\/.*/i,
            handler: 'NetworkOnly',
          },
          {
            // Cache images with a stale-while-revalidate strategy
            urlPattern: /\.(?:png|jpg|jpeg|svg|gif|webp|ico)$/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'images-cache',
              expiration: {
                maxEntries: 100,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
        ],
      },
      manifest: {
        name: 'Hausdog',
        short_name: 'Hausdog',
        description: 'Track your home — systems, appliances, and maintenance history',
        theme_color: '#000000',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/dashboard',
        scope: '/',
        icons: [
          {
            src: '/favicon.ico',
            sizes: '64x64 32x32 24x24 16x16',
            type: 'image/x-icon',
          },
          {
            src: '/logo192.png',
            type: 'image/png',
            sizes: '192x192',
          },
          {
            src: '/logo512.png',
            type: 'image/png',
            sizes: '512x512',
            purpose: 'any maskable',
          },
        ],
      },
      devOptions: {
        enabled: false, // Don't run SW in dev to avoid cache conflicts
      },
    }) as PluginOption,
  ],
})

export default config
