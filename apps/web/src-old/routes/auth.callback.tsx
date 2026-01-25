import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/auth/callback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        // Dynamic import to avoid client bundle pollution
        const { getSupabaseServerClient } = await import('@/lib/supabase')

        const url = new URL(request.url)
        const code = url.searchParams.get('code')

        if (!code) {
          return new Response(null, {
            status: 302,
            headers: { Location: '/login' },
          })
        }

        const supabase = getSupabaseServerClient()

        try {
          const { error } = await supabase.auth.exchangeCodeForSession(code)

          if (error) {
            console.error('[auth callback] Exchange failed:', error.message)
            return new Response(null, {
              status: 302,
              headers: { Location: '/login' },
            })
          }

          console.log('[auth callback] Exchange successful')
          return new Response(null, {
            status: 302,
            headers: { Location: '/' },
          })
        } catch (err) {
          console.error('[auth callback] Exception:', err)
          return new Response(null, {
            status: 302,
            headers: { Location: '/login' },
          })
        }
      },
    },
  },
})
