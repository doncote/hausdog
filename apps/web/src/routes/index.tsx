import { createFileRoute, Link, useRouteContext } from '@tanstack/react-router'
import { Building2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

export const Route = createFileRoute('/')({ component: HomePage })

function HomePage() {
  const { user } = useRouteContext({ from: '/' })

  if (user) {
    return <LoggedInRedirect />
  }

  return <LandingPage />
}

function LoggedInRedirect() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <p className="text-muted-foreground mb-4">Welcome back!</p>
        <Link to="/dashboard">
          <Button>Go to Dashboard</Button>
        </Link>
      </div>
    </div>
  )
}

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-6 py-24 sm:py-32 lg:px-8">
        <div className="text-center">
          <div className="flex justify-center mb-6">
            <div className="rounded-xl bg-primary p-3">
              <Building2 className="h-10 w-10 text-primary-foreground" />
            </div>
          </div>
          <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
            Hausdog
          </h1>
          <p className="mt-6 text-lg leading-8 text-muted-foreground max-w-2xl mx-auto">
            The Carfax for your home. Catalog systems, track maintenance, and get AI-powered insights
            from your documents.
          </p>
          <div className="mt-10 flex items-center justify-center gap-x-6">
            <Link to="/login">
              <Button size="lg">Get Started</Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-6 pb-24 lg:px-8">
        <div className="grid gap-8 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Capture Everything</CardTitle>
              <CardDescription>
                Snap photos of receipts, manuals, and labels. AI extracts the important details automatically.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Track History</CardTitle>
              <CardDescription>
                Build a complete record of your home's systems, repairs, and maintenance over time.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Ask Questions</CardTitle>
              <CardDescription>
                Chat with your home's documentation. Find warranty info, maintenance schedules, and more.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  )
}
