import { createFileRoute, Outlet } from '@tanstack/react-router'
import { Header } from '@/components/layout/header'
import { MobileNav } from '@/components/layout/mobile-nav'
import { requireAuthFromContext } from '@/lib/auth'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ context }) => {
    requireAuthFromContext(context)
  },
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext()

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header user={user!} />
      <main className="flex-1 pb-16 md:pb-0">
        <Outlet />
      </main>
      <MobileNav />
    </div>
  )
}
