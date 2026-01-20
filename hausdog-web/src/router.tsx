import type { User } from '@supabase/supabase-js'
import { createRouter } from '@tanstack/react-router'

// Import the generated route tree
import { routeTree } from './routeTree.gen'

// Router context type - available in all routes
export interface RouterContext {
  user: User | null
}

// Create a new router instance
export const getRouter = () => {
  const router = createRouter({
    routeTree,
    context: {
      user: null,
    } satisfies RouterContext,

    scrollRestoration: true,
    defaultPreloadStaleTime: 0,
  })

  return router
}

// Type helper for routes
declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>
  }
}
