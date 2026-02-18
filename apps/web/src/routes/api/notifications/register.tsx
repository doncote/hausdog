import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const RegisterTokenSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(['web']),
})

export const Route = createFileRoute('/api/notifications/register')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        // Dynamic imports to avoid bundling server modules in client
        const { registerDeviceToken } = await import('@/features/notifications')
        const { getSafeSession } = await import('@/lib/supabase')

        const session = await getSafeSession()
        if (!session?.user) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        const body = await request.json()
        const parsed = RegisterTokenSchema.safeParse(body)

        if (!parsed.success) {
          return new Response(JSON.stringify({ error: 'Invalid request', details: parsed.error }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        const { token, platform } = parsed.data

        const deviceToken = await registerDeviceToken(session.user.id, token, platform)

        return new Response(JSON.stringify({ success: true, id: deviceToken.id }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
})
