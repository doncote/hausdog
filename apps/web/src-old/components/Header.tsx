import type { User } from '@supabase/supabase-js'
import { Link, useRouter } from '@tanstack/react-router'
import { Building2, LogOut, Upload, User as UserIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { signOut } from '@/lib/auth'

interface HeaderProps {
  user: User | null
}

export function Header({ user }: HeaderProps) {
  const router = useRouter()

  const handleSignOut = async () => {
    await signOut()
    router.invalidate()
  }

  return (
    <header className="sticky top-0 z-50 border-b bg-background/80 backdrop-blur-lg">
      <div className="mx-auto max-w-6xl px-6 flex h-16 items-center justify-between">
        {/* Logo/Brand */}
        <Link to="/" className="flex items-center gap-2.5 group">
          <div className="rounded-lg bg-primary p-1.5">
            <Building2 className="h-5 w-5 text-primary-foreground" />
          </div>
          <span className="text-xl font-bold tracking-tight group-hover:text-primary transition-colors">
            Hausdog
          </span>
        </Link>

        {/* Navigation - only show when logged in */}
        {user && (
          <nav className="hidden sm:flex items-center gap-1">
            <Link
              to="/properties"
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
              activeProps={{
                className: 'px-4 py-2 text-sm font-medium text-foreground bg-secondary rounded-lg',
              }}
            >
              Properties
            </Link>
            <Link
              to="/uploads"
              className="px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground hover:bg-secondary rounded-lg transition-colors"
              activeProps={{
                className: 'px-4 py-2 text-sm font-medium text-foreground bg-secondary rounded-lg',
              }}
            >
              Uploads
            </Link>
          </nav>
        )}

        {/* User Menu / Login */}
        <div className="flex items-center gap-3">
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="relative h-9 w-9 rounded-full ring-2 ring-border hover:ring-primary/50 transition-all"
                >
                  {user.user_metadata?.avatar_url ? (
                    <img
                      src={user.user_metadata.avatar_url}
                      alt={user.user_metadata?.full_name || 'User'}
                      className="h-9 w-9 rounded-full object-cover"
                    />
                  ) : (
                    <div className="h-9 w-9 rounded-full bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground text-sm font-semibold">
                      {(user.user_metadata?.full_name || user.email || 'U')[0].toUpperCase()}
                    </div>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">
                      {user.user_metadata?.full_name || 'User'}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/properties" className="gap-2 cursor-pointer">
                    <Building2 className="h-4 w-4" />
                    My Properties
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleSignOut}
                  className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                >
                  <LogOut className="h-4 w-4" />
                  Sign out
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link to="/login">
              <Button size="sm" className="gap-2">
                <UserIcon className="h-4 w-4" />
                Sign in
              </Button>
            </Link>
          )}
        </div>
      </div>
    </header>
  )
}

export default Header
