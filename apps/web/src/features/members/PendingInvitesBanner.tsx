import { Check, Home, X } from 'lucide-react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { useAcceptInvite, useDeclineInvite } from './mutations'
import { usePendingInvites } from './queries'
import type { PropertyMember } from './types'

interface PendingInvitesBannerProps {
  userId: string
  userEmail: string
}

function InviteCard({
  invite,
  userId,
  userEmail,
}: {
  invite: PropertyMember
  userId: string
  userEmail: string
}) {
  const accept = useAcceptInvite()
  const decline = useDeclineInvite(userEmail)

  const handleAccept = async () => {
    try {
      await accept.mutateAsync({ memberId: invite.id, userId, userEmail })
      toast.success('Invitation accepted')
    } catch {
      toast.error('Failed to accept invitation')
    }
  }

  const handleDecline = async () => {
    try {
      await decline.mutateAsync({ memberId: invite.id, userId })
      toast.success('Invitation declined')
    } catch {
      toast.error('Failed to decline invitation')
    }
  }

  return (
    <div className="flex items-center justify-between rounded-lg border bg-card p-3 gap-3">
      <div className="flex items-center gap-3 min-w-0">
        <div className="rounded-lg bg-primary/10 p-1.5 shrink-0">
          <Home className="h-4 w-4 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-medium leading-none">Property invitation</p>
          <p className="text-xs text-muted-foreground mt-0.5 truncate">
            Invited as{' '}
            <Badge variant="outline" className="text-xs px-1 py-0">
              {invite.role}
            </Badge>
          </p>
        </div>
      </div>
      <div className="flex gap-2 shrink-0">
        <Button
          size="sm"
          variant="outline"
          className="h-7 gap-1 text-xs"
          onClick={handleDecline}
          disabled={decline.isPending}
        >
          <X className="h-3 w-3" />
          Decline
        </Button>
        <Button
          size="sm"
          className="h-7 gap-1 text-xs"
          onClick={handleAccept}
          disabled={accept.isPending}
        >
          <Check className="h-3 w-3" />
          Accept
        </Button>
      </div>
    </div>
  )
}

export function PendingInvitesBanner({ userId, userEmail }: PendingInvitesBannerProps) {
  const { data: invites } = usePendingInvites(userEmail)

  if (!invites || invites.length === 0) return null

  return (
    <div className="mb-8">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
        Pending Invitations
      </h2>
      <div className="space-y-2">
        {invites.map((invite) => (
          <InviteCard key={invite.id} invite={invite} userId={userId} userEmail={userEmail} />
        ))}
      </div>
    </div>
  )
}
