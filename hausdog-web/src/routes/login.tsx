import { createFileRoute, redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { getBaseUrl } from '@/lib/env.server'
import { getSupabaseServerClient } from '@/lib/supabase'

/**
 * Server function to initiate Google OAuth login.
 */
const signInWithGoogle = createServerFn({ method: 'POST' }).handler(async () => {
  const supabase = getSupabaseServerClient()

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${getBaseUrl()}/auth/callback`,
    },
  })

  if (error) {
    return { error: error.message, url: null }
  }

  return { error: null, url: data.url }
})

export const Route = createFileRoute('/login')({
  beforeLoad: ({ context }) => {
    // If already logged in, redirect to home
    if (context.user) {
      throw redirect({ to: '/' })
    }
  },
  component: LoginPage,
})

function LoginPage() {
  const handleGoogleLogin = async () => {
    const result = await signInWithGoogle()
    if (result.url) {
      window.location.href = result.url
    }
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Welcome to Hausdog</CardTitle>
          <CardDescription>Sign in to manage your home documentation</CardDescription>
        </CardHeader>
        <CardContent>
          <Button onClick={handleGoogleLogin} className="w-full" size="lg">
            Sign in with Google
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
