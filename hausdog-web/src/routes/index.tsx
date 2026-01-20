import { createFileRoute, Link, useRouteContext } from '@tanstack/react-router'
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
  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-5xl px-6 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-foreground">
            Welcome back, {userName.split(' ')[0]}
          </h1>
          <p className="mt-2 text-muted-foreground">
            Here's an overview of your home documentation.
          </p>
        </div>

        <DashboardContent userId={userId} />
      </div>
    </div>
  )
}

function DashboardContent({ userId }: { userId: string }) {
  const { data: properties, isPending, error } = useProperties(userId)

  if (isPending) {
    return (
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        {[1, 2, 3].map((i) => (
          <Card key={i}>
            <CardHeader>
              <div className="h-4 w-24 bg-muted animate-pulse rounded" />
              <div className="h-8 w-16 bg-muted animate-pulse rounded mt-2" />
            </CardHeader>
          </Card>
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <Card className="border-destructive">
        <CardContent className="pt-6">
          <p className="text-destructive">Failed to load dashboard data</p>
        </CardContent>
      </Card>
    )
  }

  const propertyCount = properties?.length ?? 0
  const systemCount = properties?.reduce((acc, p) => acc + (p._count?.systems ?? 0), 0) ?? 0
  const recentProperties = properties?.slice(0, 3) ?? []

  return (
    <>
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-3 mb-8">
        <Card>
          <CardHeader>
            <CardDescription>Properties</CardDescription>
            <CardTitle className="text-3xl">{propertyCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Systems</CardDescription>
            <CardTitle className="text-3xl">{systemCount}</CardTitle>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <CardDescription>Documents</CardDescription>
            <CardTitle className="text-3xl">0</CardTitle>
          </CardHeader>
        </Card>
      </div>

      {/* Quick Actions */}
      <div className="flex gap-4 mb-8">
        <Link to="/properties/new">
          <Button>Add Property</Button>
        </Link>
        <Link to="/properties">
          <Button variant="outline">View All Properties</Button>
        </Link>
      </div>

      {/* Recent Properties */}
      {recentProperties.length > 0 && (
        <div>
          <h2 className="text-xl font-semibold mb-4">Recent Properties</h2>
          <div className="grid gap-4 md:grid-cols-3">
            {recentProperties.map((property) => (
              <Link
                key={property.id}
                to="/properties/$propertyId"
                params={{ propertyId: property.id }}
              >
                <Card className="hover:border-primary/50 transition-colors cursor-pointer">
                  <CardHeader>
                    <CardTitle className="text-lg">{property.name}</CardTitle>
                    {property.address && <CardDescription>{property.address}</CardDescription>}
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-muted-foreground">
                      {property._count?.systems ?? 0} system
                      {(property._count?.systems ?? 0) !== 1 ? 's' : ''}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Empty State */}
      {recentProperties.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <h3 className="text-lg font-medium mb-2">No properties yet</h3>
            <p className="text-muted-foreground mb-4">Get started by adding your first property</p>
            <Link to="/properties/new">
              <Button>Add Your First Property</Button>
            </Link>
          </CardContent>
        </Card>
      )}
    </>
  )
}
