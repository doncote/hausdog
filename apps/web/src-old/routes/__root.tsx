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
import { Header } from '@/components/Header'
import { Toaster } from '@/components/ui/sonner'
import { fetchSessionUser } from '@/lib/auth'

import appCss from '../styles/globals.css?url'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 5 minutes
      retry: 1,
    },
  },
})

export const Route = createRootRoute({
  head: () => ({
    meta: [
      {
        charSet: 'utf-8',
      },
      {
        name: 'viewport',
        content: 'width=device-width, initial-scale=1',
      },
      {
        title: 'Hausdog',
      },
    ],
    links: [
      {
        rel: 'stylesheet',
        href: appCss,
      },
    ],
  }),

  beforeLoad: async () => {
    const { user } = await fetchSessionUser()
    return { user }
  },

  component: RootComponent,
  shellComponent: RootDocument,
})

function RootComponent() {
  const { user } = useRouteContext({ from: '__root__' })

  return (
    <QueryClientProvider client={queryClient}>
      <Header user={user} />
      <main>
        <Outlet />
      </main>
    </QueryClientProvider>
  )
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Toaster />
        <TanStackDevtools
          config={{
            position: 'bottom-right',
          }}
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
