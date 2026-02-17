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

  // Rewrite URL to strip /api/v1 prefix since Hono routes start from /
  const url = new URL(request.url)
  url.pathname = url.pathname.replace(/^\/api\/v1/, '') || '/'
  const rewrittenRequest = new Request(url.toString(), request)

  return api.fetch(rewrittenRequest)
}
