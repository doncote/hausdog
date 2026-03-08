import { TanStackDevtools } from '@tanstack/react-devtools'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
  useRouteContext,
} from '@tanstack/react-router'
import { TanStackRouterDevtoolsPanel } from '@tanstack/react-router-devtools'
import { createServerFn } from '@tanstack/react-start'
import { Toaster } from '@/components/ui/sonner'
import { fetchSessionUser } from '@/lib/auth'

// Server function to get client-safe env vars
const getClientEnv = createServerFn({ method: 'GET' }).handler(async () => {
  const { getServerEnv } = await import('@/lib/env')
  const env = getServerEnv()
  return {
    GOOGLE_PLACES_API_KEY: env.GOOGLE_PLACES_API_KEY,
  }
})

import appCss from '../styles/globals.css?url'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      retry: 1,
    },
  },
})

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1, viewport-fit=cover' },
      { title: 'Hausdog' },
      { name: 'theme-color', content: '#000000' },
      { name: 'mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-capable', content: 'yes' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'black-translucent' },
      { name: 'apple-mobile-web-app-title', content: 'Hausdog' },
      {
        name: 'description',
        content: 'Track your home — systems, appliances, and maintenance history',
      },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      { rel: 'manifest', href: '/manifest.json' },
      { rel: 'apple-touch-icon', href: '/logo192.png' },
    ],
  }),

  beforeLoad: async () => {
    const [{ user }, clientEnv] = await Promise.all([fetchSessionUser(), getClientEnv()])
    return { user, clientEnv }
  },

  component: RootComponent,
  shellComponent: RootDocument,
})

function RootComponent() {
  return (
    <QueryClientProvider client={queryClient}>
      <Outlet />
    </QueryClientProvider>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  const { clientEnv } = useRouteContext({ from: '__root__' })

  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        <script
          // biome-ignore lint/security/noDangerouslySetInnerHtml: Safe - injecting our own env vars
          dangerouslySetInnerHTML={{
            __html: `window.ENV = ${JSON.stringify(clientEnv)};`,
          }}
        />
        {children}
        <Toaster />
        <TanStackDevtools
          config={{ position: 'bottom-right' }}
          plugins={[
            {
              name: 'Tanstack Router',
              render: <TanStackRouterDevtoolsPanel />,
            },
          ]}
        />
        <Scripts />
      </body>
    </html>
  )
}
