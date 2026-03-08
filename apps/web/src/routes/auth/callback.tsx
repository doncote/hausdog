import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/auth/callback')({
  server: {
    handlers: {
      GET: async ({ request }) => {
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
          const { data, error } = await supabase.auth.exchangeCodeForSession(code)

          if (error) {
            console.error('[auth callback] Exchange failed:', error.message)
            return new Response(null, {
              status: 302,
              headers: { Location: '/login' },
            })
          }

          // Activate any pending invites for this user's email
          if (data.user?.email) {
            try {
              const { prisma } = await import('@/lib/db/client')
              const { consoleLogger } = await import('@/lib/console-logger')
              const { PropertyMemberService } = await import('@/features/members/service')
              const memberService = new PropertyMemberService({ db: prisma, logger: consoleLogger })
              await memberService.activatePendingInvites(data.user.id, data.user.email)
            } catch (inviteErr) {
              console.error('[auth callback] Failed to activate pending invites:', inviteErr)
              // Non-fatal — continue to dashboard
            }
          }

          return new Response(null, {
            status: 302,
            headers: { Location: '/dashboard' },
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
