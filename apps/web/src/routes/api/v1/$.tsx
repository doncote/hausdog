import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/v1/$')({
  server: {
    handlers: {
      GET: handleRequest,
      POST: handleRequest,
      PUT: handleRequest,
      PATCH: handleRequest,
      DELETE: handleRequest,
      OPTIONS: handleRequest,
    },
  },
})

async function handleRequest({ request }: { request: Request }): Promise<Response> {
  const { api } = await import('@/api')

  // Hono's fetch expects the full URL but routes from /api/v1/
  // The splat route captures everything after /api/v1/
  return api.fetch(request)
}
