import { createFileRoute, Link, useRouteContext } from '@tanstack/react-router'
import {
  Building2,
  Camera,
  MessageSquare,
  FileText,
  Shield,
  Clock,
  Sparkles,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'

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
      {/* Header */}
      <header className="border-b">
        <div className="mx-auto max-w-5xl px-6 py-4 lg:px-8 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building2 className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">Hausdog</span>
          </div>
          <Link to="/login">
            <Button variant="outline">Sign In</Button>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/5" />
        <div className="relative mx-auto max-w-5xl px-6 py-20 sm:py-28 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">
              The Carfax for Your Home
            </h1>
            <p className="mt-6 text-xl leading-8 text-muted-foreground max-w-2xl mx-auto">
              Snap a photo. AI does the rest. Build a complete history of every system, appliance,
              and repair in your home.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link to="/login">
                <Button size="lg" className="text-lg px-8">
                  Get Started Free
                  <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Problem/Solution Section */}
      <div className="border-y bg-muted/30">
        <div className="mx-auto max-w-5xl px-6 py-16 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold tracking-tight">Sound Familiar?</h2>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            <div className="text-center">
              <p className="text-lg text-muted-foreground">
                "When was the furnace filter last changed?"
              </p>
            </div>
            <div className="text-center">
              <p className="text-lg text-muted-foreground">
                "Where's the warranty for the dishwasher?"
              </p>
            </div>
            <div className="text-center">
              <p className="text-lg text-muted-foreground">
                "What's the model number of the water heater?"
              </p>
            </div>
          </div>
          <p className="text-center mt-8 text-lg">
            <span className="font-semibold">Hausdog remembers everything</span> so you don't have
            to.
          </p>
        </div>
      </div>

      {/* How It Works Section */}
      <div className="mx-auto max-w-5xl px-6 py-20 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight">Dead Simple to Use</h2>
          <p className="mt-4 text-lg text-muted-foreground">
            No spreadsheets. No filing. Just snap and go.
          </p>
        </div>

        <div className="grid gap-12 md:grid-cols-3">
          <div className="text-center">
            <div className="flex justify-center mb-6">
              <div className="rounded-full bg-primary/10 p-4">
                <Camera className="h-8 w-8 text-primary" />
              </div>
            </div>
            <div className="inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium h-6 w-6 mb-3">
              1
            </div>
            <h3 className="text-xl font-semibold mb-2">Snap a Photo</h3>
            <p className="text-muted-foreground">
              Take a picture of any receipt, label, manual, or equipment plate.
            </p>
          </div>

          <div className="text-center">
            <div className="flex justify-center mb-6">
              <div className="rounded-full bg-primary/10 p-4">
                <Sparkles className="h-8 w-8 text-primary" />
              </div>
            </div>
            <div className="inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium h-6 w-6 mb-3">
              2
            </div>
            <h3 className="text-xl font-semibold mb-2">AI Extracts Details</h3>
            <p className="text-muted-foreground">
              Model numbers, dates, costs, warranty info—automatically pulled from the image.
            </p>
          </div>

          <div className="text-center">
            <div className="flex justify-center mb-6">
              <div className="rounded-full bg-primary/10 p-4">
                <CheckCircle2 className="h-8 w-8 text-primary" />
              </div>
            </div>
            <div className="inline-flex items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-medium h-6 w-6 mb-3">
              3
            </div>
            <h3 className="text-xl font-semibold mb-2">Review & Done</h3>
            <p className="text-muted-foreground">
              Quick review, one tap to confirm. Your home's history grows automatically.
            </p>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="bg-muted/30 border-y">
        <div className="mx-auto max-w-5xl px-6 py-20 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold tracking-tight">Everything You Need</h2>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card className="border-0 shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <MessageSquare className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Chat with Your Home</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Ask questions in plain English. "When was the AC last serviced?" "What's the
                  warranty status on the fridge?" Get instant answers from your documented history.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Clock className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Complete Timeline</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Every installation, repair, and maintenance event in one place. See when things
                  were done, who did them, and what it cost.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <FileText className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Documents Organized</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Manuals, warranties, receipts—all linked to the right appliance. Never dig through
                  folders or filing cabinets again.
                </CardDescription>
              </CardContent>
            </Card>

            <Card className="border-0 shadow-sm">
              <CardHeader>
                <div className="flex items-center gap-4">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Shield className="h-6 w-6 text-primary" />
                  </div>
                  <CardTitle>Ready for Anything</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <CardDescription className="text-base">
                  Insurance claims, home sales, warranty disputes—have complete documentation at
                  your fingertips when it matters most.
                </CardDescription>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Use Cases Section */}
      <div className="mx-auto max-w-5xl px-6 py-20 lg:px-8">
        <div className="text-center mb-16">
          <h2 className="text-3xl font-bold tracking-tight">When You'll Be Glad You Have It</h2>
        </div>

        <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
          <div className="border rounded-lg p-6">
            <h3 className="font-semibold mb-2">Filing an Insurance Claim</h3>
            <p className="text-muted-foreground text-sm">
              Water damage from the water heater? Pull up the install date, maintenance history, and
              original receipt in seconds.
            </p>
          </div>

          <div className="border rounded-lg p-6">
            <h3 className="font-semibold mb-2">Selling Your Home</h3>
            <p className="text-muted-foreground text-sm">
              Hand buyers a complete history of every major system. New roof in 2022? HVAC serviced
              annually? It's all documented.
            </p>
          </div>

          <div className="border rounded-lg p-6">
            <h3 className="font-semibold mb-2">Warranty Disputes</h3>
            <p className="text-muted-foreground text-sm">
              Appliance failed within warranty? Find the purchase date, warranty terms, and service
              history instantly.
            </p>
          </div>

          <div className="border rounded-lg p-6">
            <h3 className="font-semibold mb-2">Hiring Contractors</h3>
            <p className="text-muted-foreground text-sm">
              Tell the HVAC tech exactly what model you have, when it was installed, and what's been
              done before.
            </p>
          </div>

          <div className="border rounded-lg p-6">
            <h3 className="font-semibold mb-2">Planning Maintenance</h3>
            <p className="text-muted-foreground text-sm">
              Know at a glance what's due for service. Filter changes, inspections, seasonal
              prep—never miss a beat.
            </p>
          </div>

          <div className="border rounded-lg p-6">
            <h3 className="font-semibold mb-2">Moving to a New Home</h3>
            <p className="text-muted-foreground text-sm">
              Start fresh with a quick walkthrough. Capture every appliance label and build your
              inventory in an afternoon.
            </p>
          </div>
        </div>
      </div>

      {/* Final CTA Section */}
      <div className="bg-primary text-primary-foreground">
        <div className="mx-auto max-w-5xl px-6 py-20 lg:px-8 text-center">
          <h2 className="text-3xl font-bold tracking-tight mb-4">
            Start Building Your Home's History
          </h2>
          <p className="text-lg opacity-90 mb-8 max-w-2xl mx-auto">
            Every photo you take today is information you'll be glad you have tomorrow.
          </p>
          <Link to="/login">
            <Button size="lg" variant="secondary" className="text-lg px-8">
              Get Started Free
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </Link>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t">
        <div className="mx-auto max-w-5xl px-6 py-8 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              <span className="font-semibold">Hausdog</span>
            </div>
            <p className="text-sm text-muted-foreground">
              The complete home documentation system.
            </p>
          </div>
        </div>
      </footer>
    </div>
  )
}
