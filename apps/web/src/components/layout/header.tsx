import { Link } from '@tanstack/react-router'
import type { User } from '@supabase/supabase-js'
import { Building2, Camera, FileText, Home, MessageSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { signOut } from '@/lib/auth'

interface HeaderProps {
  user: User
}

export function Header({ user }: HeaderProps) {
  const handleSignOut = async () => {
    await signOut()
    window.location.href = '/'
  }

  const displayName = user.user_metadata?.full_name || user.email || 'User'
  const initials = displayName
    .split(' ')
    .map((n: string) => n[0])
    .join('')
    .toUpperCase()
    .slice(0, 2)

  return (
    <header className="border-b bg-card">
      <div className="mx-auto max-w-6xl px-6 h-16 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="rounded-lg bg-primary p-1.5">
              <Building2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold">Hausdog</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            <Link to="/properties">
              <Button variant="ghost" size="sm" className="gap-2">
                <Home className="h-4 w-4" />
                Properties
              </Button>
            </Link>
            <Link to="/capture">
              <Button variant="ghost" size="sm" className="gap-2">
                <Camera className="h-4 w-4" />
                Capture
              </Button>
            </Link>
            <Link to="/documents">
              <Button variant="ghost" size="sm" className="gap-2">
                <FileText className="h-4 w-4" />
                Documents
              </Button>
            </Link>
            <Link to="/chat" search={{ propertyId: undefined, conversationId: undefined }}>
              <Button variant="ghost" size="sm" className="gap-2">
                <MessageSquare className="h-4 w-4" />
                Chat
              </Button>
            </Link>
          </nav>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-2">
              <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center text-xs font-medium">
                {initials}
              </div>
              <span className="hidden sm:inline">{displayName}</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem asChild>
              <Link to="/settings">Settings</Link>
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleSignOut}>
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
