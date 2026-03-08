import { Link, useRouterState } from '@tanstack/react-router'
import { Box, Camera, Home, MessageSquare, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  { to: '/dashboard', icon: Home, label: 'Home' },
  { to: '/inventory', icon: Box, label: 'Inventory' },
  { to: '/capture', icon: Camera, label: 'Capture' },
  { to: '/maintenance', icon: Wrench, label: 'Maintenance' },
  { to: '/chat', icon: MessageSquare, label: 'Chat' },
] as const

export function MobileNav() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 border-t bg-background pb-safe">
      <div className="flex items-stretch h-16">
        {navItems.map(({ to, icon: Icon, label }) => {
          const active = pathname === to || (to !== '/dashboard' && pathname.startsWith(to))
          return (
            <Link
              key={to}
              to={to}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-medium transition-colors',
                active ? 'text-foreground' : 'text-muted-foreground',
              )}
            >
              <Icon className={cn('h-5 w-5', active && 'stroke-[2.5]')} />
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
