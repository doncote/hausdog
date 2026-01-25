import { createFileRoute, Link, useRouteContext } from '@tanstack/react-router'
import { Building2, FileText, Layers, Plus, ArrowRight, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useProperties } from '@/features/properties'

export const Route = createFileRoute('/')({ component: HomePage })

function HomePage() {
  const { user } = useRouteContext({ from: '/' })

  if (user) {
    return (
      <Dashboard
        userId={user.id}
        userName={user.user_metadata?.full_name || user.email || 'User'}
      />
    )
  }

  return <LandingPage />
}

function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="mx-auto max-w-5xl px-6 py-24 sm:py-32 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-bold tracking-tight text-foreground sm:text-6xl">
              Hausdog
            </h1>
            <p className="mt-6 text-lg leading-8 text-muted-foreground max-w-2xl mx-auto">
              Keep your home documentation organized. Track appliances, systems, warranties, and
              maintenance schedules all in one place.
            </p>
            <div className="mt-10 flex items-center justify-center gap-x-6">
              <Link to="/login">
                <Button size="lg">Get Started</Button>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Features Section */}
      <div className="mx-auto max-w-5xl px-6 pb-24 lg:px-8">
        <div className="grid gap-8 md:grid-cols-3">
          <Card>
            <CardHeader>
              <CardTitle>Track Everything</CardTitle>
              <CardDescription>
                Record appliances, HVAC systems, plumbing, electrical, and more with purchase dates,
                warranties, and manuals.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Smart Extraction</CardTitle>
              <CardDescription>
                Upload documents and let AI extract key information automatically - model numbers,
                warranty dates, and specifications.
              </CardDescription>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Multiple Properties</CardTitle>
              <CardDescription>
                Manage documentation for all your properties - primary residence, vacation homes, or
                rentals.
              </CardDescription>
            </CardHeader>
          </Card>
        </div>
      </div>
    </div>
  )
}

function Dashboard({ userId, userName }: { userId: string; userName: string }) {
  const firstName = userName.split(' ')[0]
  const greeting = getGreeting()

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <header className="mb-10">
          <p className="text-sm font-medium text-primary mb-1">{greeting}</p>
          <h1 className="text-3xl font-bold tracking-tight">{firstName}</h1>
          <p className="mt-2 text-muted-foreground">
            Here's an overview of your home documentation.
          </p>
        </header>

        <DashboardContent userId={userId} />
      </div>
    </div>
  )
}

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning,'
  if (hour < 17) return 'Good afternoon,'
  return 'Good evening,'
}

function DashboardContent({ userId }: { userId: string }) {
  const { data: properties, isPending, error } = useProperties(userId)

  if (isPending) {
    return (
      <div className="grid gap-6 md:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="rounded-xl border bg-card p-6">
            <div className="h-10 w-10 bg-muted animate-pulse rounded-lg mb-4" />
            <div className="h-4 w-20 bg-muted animate-pulse rounded mb-2" />
            <div className="h-8 w-12 bg-muted animate-pulse rounded" />
          </div>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-destructive/50 bg-destructive/5 p-6">
        <p className="text-destructive">Failed to load dashboard data</p>
      </div>
    )
  }

  const propertyCount = properties?.length ?? 0
  const systemCount = properties?.reduce((acc, p) => acc + (p._count?.systems ?? 0), 0) ?? 0
  const recentProperties = properties?.slice(0, 3) ?? []

  const stats = [
    {
      label: 'Properties',
      value: propertyCount,
      icon: Building2,
      color: 'text-primary',
      bg: 'bg-primary/10',
    },
    {
      label: 'Systems',
      value: systemCount,
      icon: Layers,
      color: 'text-emerald-600',
      bg: 'bg-emerald-500/10',
    },
    {
      label: 'Documents',
      value: 0,
      icon: FileText,
      color: 'text-amber-600',
      bg: 'bg-amber-500/10',
    },
  ]

  return (
    <div className="space-y-8">
      {/* Stats Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        {stats.map((stat) => (
          <div
            key={stat.label}
            className="group rounded-xl border bg-card p-6 transition-all hover:shadow-md hover:border-primary/20"
          >
            <div className={`inline-flex rounded-lg p-2.5 ${stat.bg} mb-4`}>
              <stat.icon className={`h-5 w-5 ${stat.color}`} />
            </div>
            <p className="text-sm font-medium text-muted-foreground">{stat.label}</p>
            <p className="text-3xl font-semibold tracking-tight mt-1">{stat.value}</p>
          </div>
        ))}
      </div>

      {/* Quick Actions */}
      <div className="flex flex-wrap gap-3">
        <Link to="/properties/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Property
          </Button>
        </Link>
        <Link to="/properties">
          <Button variant="outline" className="gap-2">
            View All Properties
            <ArrowRight className="h-4 w-4" />
          </Button>
        </Link>
      </div>

      {/* Recent Properties */}
      {recentProperties.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Your Properties</h2>
            <Link
              to="/properties"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              View all
            </Link>
          </div>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {recentProperties.map((property) => (
              <Link
                key={property.id}
                to="/properties/$propertyId"
                params={{ propertyId: property.id }}
                className="group"
              >
                <div className="rounded-xl border bg-card p-5 transition-all hover:shadow-md hover:border-primary/30">
                  <div className="flex items-start gap-4">
                    <div className="rounded-lg bg-secondary p-2.5">
                      <Home className="h-5 w-5 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium truncate group-hover:text-primary transition-colors">
                        {property.name}
                      </h3>
                      {property.address && (
                        <p className="text-sm text-muted-foreground truncate mt-0.5">
                          {property.address}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground mt-2">
                        {property._count?.systems ?? 0} system
                        {(property._count?.systems ?? 0) !== 1 ? 's' : ''}
                      </p>
                    </div>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {recentProperties.length === 0 && (
        <div className="rounded-xl border-2 border-dashed bg-muted/30 p-12 text-center">
          <div className="mx-auto w-fit rounded-full bg-primary/10 p-4 mb-4">
            <Building2 className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No properties yet</h3>
          <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
            Add your first property to start tracking your home documentation
          </p>
          <Link to="/properties/new">
            <Button className="gap-2">
              <Plus className="h-4 w-4" />
              Add Your First Property
            </Button>
          </Link>
        </div>
      )}
    </div>
  )
}
