import { Link } from '@tanstack/react-router'
import type { User } from '@supabase/supabase-js'
import {
  Box,
  Building2,
  Camera,
  Check,
  ChevronDown,
  FileText,
  Home,
  Layers,
  MessageSquare,
  Plus,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { signOut } from '@/lib/auth'
import { useCurrentProperty } from '@/hooks/use-current-property'
import { useProperties } from '@/features/properties'

interface HeaderProps {
  user: User
}

export function Header({ user }: HeaderProps) {
  const { currentProperty, selectProperty, isLoaded } = useCurrentProperty()
  const { data: properties } = useProperties(user.id)

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
        <div className="flex items-center gap-6">
          <Link to="/dashboard" className="flex items-center gap-2">
            <div className="rounded-lg bg-primary p-1.5">
              <Building2 className="h-5 w-5 text-primary-foreground" />
            </div>
            <span className="font-semibold hidden sm:inline">Hausdog</span>
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            <Link to="/inventory">
              <Button variant="ghost" size="sm" className="gap-2">
                <Box className="h-4 w-4" />
                Inventory
              </Button>
            </Link>
            <Link to="/spaces">
              <Button variant="ghost" size="sm" className="gap-2">
                <Layers className="h-4 w-4" />
                Spaces
              </Button>
            </Link>
            <Link to="/documents">
              <Button variant="ghost" size="sm" className="gap-2">
                <FileText className="h-4 w-4" />
                Documents
              </Button>
            </Link>
            <Link to="/capture">
              <Button variant="ghost" size="sm" className="gap-2">
                <Camera className="h-4 w-4" />
                Capture
              </Button>
            </Link>
            <Link to="/review">
              <Button variant="ghost" size="sm" className="gap-2">
                <Check className="h-4 w-4" />
                Review
              </Button>
            </Link>
            <Link to="/chat" search={{ conversationId: undefined }}>
              <Button variant="ghost" size="sm" className="gap-2">
                <MessageSquare className="h-4 w-4" />
                Chat
              </Button>
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          {/* Property Picker */}
          {isLoaded && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="gap-2 max-w-[180px]">
                  <Home className="h-4 w-4 shrink-0" />
                  <span className="truncate">
                    {currentProperty?.name || 'Select property'}
                  </span>
                  <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-[200px]">
                {properties && properties.length > 0 ? (
                  <>
                    {properties.map((property) => (
                      <DropdownMenuItem
                        key={property.id}
                        onClick={() =>
                          selectProperty({ id: property.id, name: property.name })
                        }
                        className="gap-2"
                      >
                        {currentProperty?.id === property.id ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <div className="w-4" />
                        )}
                        <span className="truncate">{property.name}</span>
                      </DropdownMenuItem>
                    ))}
                    <DropdownMenuSeparator />
                  </>
                ) : (
                  <DropdownMenuItem disabled>No properties yet</DropdownMenuItem>
                )}
                <DropdownMenuItem asChild>
                  <Link to="/properties/new" className="gap-2">
                    <Plus className="h-4 w-4" />
                    Add Property
                  </Link>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9">
                <div className="h-7 w-7 rounded-full bg-secondary flex items-center justify-center text-xs font-medium">
                  {initials}
                </div>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-48">
              <DropdownMenuItem asChild>
                <Link to="/properties">Properties</Link>
              </DropdownMenuItem>
              <DropdownMenuItem asChild>
                <Link to="/settings">Settings</Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>Sign out</DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
