import { useRouter } from '@tanstack/react-router'
import { Camera, Home, Plus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { getSupabaseBrowserClient } from '@/lib/supabase'

interface WelcomeModalProps {
  open: boolean
  onClose: () => void
}

export function WelcomeModal({ open, onClose }: WelcomeModalProps) {
  const router = useRouter()

  async function markSeen() {
    const supabase = getSupabaseBrowserClient()
    await supabase.auth.updateUser({ data: { onboarding_seen: true } })
  }

  async function handleAddProperty() {
    await markSeen()
    onClose()
    router.navigate({ to: '/properties/new' })
  }

  async function handleExplore() {
    await markSeen()
    onClose()
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) handleExplore()
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader className="text-center items-center">
          <div className="rounded-full bg-primary/10 p-4 mb-3">
            <Home className="h-8 w-8 text-primary" />
          </div>
          <DialogTitle className="text-2xl">Welcome to Hausdog</DialogTitle>
          <p className="text-sm text-muted-foreground mt-1">
            Your home's memory — organized and always at hand.
          </p>
        </DialogHeader>

        <div className="mt-4 space-y-3">
          {steps.map((step, i) => (
            <div key={step.title} className="flex items-start gap-3">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-secondary text-xs font-semibold">
                {i + 1}
              </div>
              <div>
                <p className="text-sm font-medium">{step.title}</p>
                <p className="text-xs text-muted-foreground">{step.description}</p>
              </div>
              <step.icon className="h-4 w-4 shrink-0 mt-0.5 text-muted-foreground ml-auto" />
            </div>
          ))}
        </div>

        <div className="mt-6 flex flex-col gap-2">
          <Button className="w-full gap-2" onClick={handleAddProperty}>
            <Plus className="h-4 w-4" />
            Add Your First Property
          </Button>
          <Button variant="ghost" className="w-full" onClick={handleExplore}>
            Explore first
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}

const steps = [
  {
    title: 'Add Property',
    description: 'Register your home to get started.',
    icon: Home,
  },
  {
    title: 'Capture Photo',
    description: 'Snap appliances, warranties, and documents.',
    icon: Camera,
  },
  {
    title: 'See Your Home',
    description: 'Browse your organized home profile anytime.',
    icon: Home,
  },
]
