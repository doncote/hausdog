import { createFileRoute, Link } from '@tanstack/react-router'
import { Box, Camera, ChevronRight, FileText, Home, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useDashboardStats } from '@/features/dashboard'

export const Route = createFileRoute('/_authenticated/dashboard')({
  component: DashboardPage,
})

function DashboardPage() {
  const { user } = Route.useRouteContext()
  const firstName = (user?.user_metadata?.full_name || user?.email || 'User').split(' ')[0]
  const greeting = getGreeting()

  const { data: stats, isPending } = useDashboardStats(user?.id)

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <header className="mb-10">
        <p className="text-sm font-medium text-primary mb-1">{greeting}</p>
        <h1 className="text-3xl font-bold tracking-tight">{firstName}</h1>
        <p className="mt-2 text-muted-foreground">
          Here's an overview of your home documentation.
        </p>
      </header>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4 mb-8">
        <StatCard
          label="Properties"
          value={isPending ? '-' : stats?.propertyCount ?? 0}
          icon={Home}
          href="/properties"
        />
        <StatCard
          label="Items"
          value={isPending ? '-' : stats?.itemCount ?? 0}
          icon={Box}
        />
        <StatCard
          label="Pending Review"
          value={isPending ? '-' : stats?.pendingReviewCount ?? 0}
          icon={FileText}
          href="/review"
        />
        <StatCard
          label="Documents"
          value={isPending ? '-' : stats?.documentCount ?? 0}
          icon={Camera}
          href="/documents"
        />
      </div>

      <div className="flex flex-wrap gap-3 mb-10">
        <Link to="/properties/new">
          <Button className="gap-2">
            <Plus className="h-4 w-4" />
            Add Property
          </Button>
        </Link>
        <Link to="/capture">
          <Button variant="outline" className="gap-2">
            <Camera className="h-4 w-4" />
            Capture Document
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Items</CardTitle>
            <CardDescription>Your latest tracked items</CardDescription>
          </CardHeader>
          <CardContent>
            {isPending ? (
              <div className="space-y-3">
                <div className="h-12 bg-muted animate-pulse rounded" />
                <div className="h-12 bg-muted animate-pulse rounded" />
              </div>
            ) : stats?.recentItems && stats.recentItems.length > 0 ? (
              <div className="space-y-2">
                {stats.recentItems.map((item) => (
                  <Link
                    key={item.id}
                    to="/items/$itemId"
                    params={{ itemId: item.id }}
                    className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted transition-colors group"
                  >
                    <div className="rounded-lg bg-secondary p-2">
                      <Box className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium group-hover:text-primary transition-colors truncate">
                        {item.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {item.category} · {item.propertyName}
                      </p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            ) : (
              <EmptyState
                message="No items yet"
                action={
                  <Link to="/capture">
                    <Button size="sm" variant="outline">
                      Capture your first item
                    </Button>
                  </Link>
                }
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Pending Review</CardTitle>
            <CardDescription>Documents waiting for your review</CardDescription>
          </CardHeader>
          <CardContent>
            {isPending ? (
              <div className="space-y-3">
                <div className="h-12 bg-muted animate-pulse rounded" />
              </div>
            ) : stats?.pendingReviewCount && stats.pendingReviewCount > 0 ? (
              <div className="text-center py-4">
                <p className="text-3xl font-bold mb-2">{stats.pendingReviewCount}</p>
                <p className="text-sm text-muted-foreground mb-4">
                  document{stats.pendingReviewCount !== 1 ? 's' : ''} pending review
                </p>
                <Link to="/review">
                  <Button size="sm" variant="outline">
                    Review Documents
                  </Button>
                </Link>
              </div>
            ) : (
              <EmptyState
                message="No pending reviews"
                action={
                  <p className="text-sm text-muted-foreground">
                    Captured documents will appear here
                  </p>
                }
              />
            )}
          </CardContent>
        </Card>
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

function StatCard({
  label,
  value,
  icon: Icon,
  href,
}: {
  label: string
  value: number | string
  icon: React.ComponentType<{ className?: string }>
  href?: string
}) {
  const content = (
    <div className="rounded-xl border bg-card p-6 hover:shadow-md transition-shadow">
      <div className="inline-flex rounded-lg p-2.5 bg-secondary mb-4">
        <Icon className="h-5 w-5 text-muted-foreground" />
      </div>
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="text-3xl font-semibold tracking-tight mt-1">{value}</p>
    </div>
  )

  if (href) {
    return <Link to={href}>{content}</Link>
  }

  return content
}

function EmptyState({
  message,
  action,
}: {
  message: string
  action: React.ReactNode
}) {
  return (
    <div className="py-8 text-center">
      <p className="text-muted-foreground mb-4">{message}</p>
      {action}
    </div>
  )
}
