import { Loader2, Mail, Shield, Trash2, UserPlus, Users } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useInviteMember, useRemoveMember, useUpdateMemberRole } from './mutations'
import { usePropertyMembers } from './queries'
import type { MemberRole, PropertyMember } from './types'

interface SharingSectionProps {
  propertyId: string
  userId: string
  isOwner: boolean
}

const ROLE_LABELS: Record<MemberRole, string> = {
  owner: 'Owner',
  editor: 'Editor',
  viewer: 'Viewer',
}

const ROLE_DESCRIPTIONS: Record<MemberRole, string> = {
  owner: 'Full access',
  editor: 'Can add and edit items',
  viewer: 'Read-only access',
}

const ROLE_BADGE_VARIANT: Record<MemberRole, 'default' | 'secondary' | 'outline'> = {
  owner: 'default',
  editor: 'secondary',
  viewer: 'outline',
}

function StatusBadge({ status }: { status: PropertyMember['status'] }) {
  if (status === 'pending')
    return (
      <Badge variant="outline" className="text-yellow-600 border-yellow-300 bg-yellow-50">
        Pending
      </Badge>
    )
  if (status === 'declined')
    return (
      <Badge variant="outline" className="text-red-600 border-red-300 bg-red-50">
        Declined
      </Badge>
    )
  return null
}

interface MemberRowProps {
  member: PropertyMember
  isOwner: boolean
  currentUserId: string
  propertyId: string
}

function MemberRow({ member, isOwner, currentUserId, propertyId }: MemberRowProps) {
  const updateRole = useUpdateMemberRole(propertyId)
  const removeMember = useRemoveMember(propertyId)
  const isSelf = member.userId === currentUserId

  const handleRoleChange = async (newRole: string) => {
    try {
      await updateRole.mutateAsync({
        memberId: member.id,
        input: { role: newRole as 'editor' | 'viewer' },
      })
      toast.success('Role updated')
    } catch {
      toast.error('Failed to update role')
    }
  }

  const handleRemove = async () => {
    try {
      await removeMember.mutateAsync({ memberId: member.id })
      toast.success('Member removed')
    } catch {
      toast.error('Failed to remove member')
    }
  }

  return (
    <div className="flex items-center justify-between py-3 border-b last:border-0">
      <div className="flex items-center gap-3">
        <div className="rounded-full bg-secondary w-9 h-9 flex items-center justify-center text-sm font-medium shrink-0">
          {member.email[0].toUpperCase()}
        </div>
        <div>
          <p className="text-sm font-medium leading-none">{member.email}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{ROLE_DESCRIPTIONS[member.role]}</p>
        </div>
        <StatusBadge status={member.status} />
      </div>

      <div className="flex items-center gap-2">
        {isOwner && member.role !== 'owner' && !isSelf ? (
          <>
            <Select
              value={member.role}
              onValueChange={handleRoleChange}
              disabled={updateRole.isPending}
            >
              <SelectTrigger className="w-28 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="editor">Editor</SelectItem>
                <SelectItem value="viewer">Viewer</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 text-muted-foreground hover:text-destructive"
              onClick={handleRemove}
              disabled={removeMember.isPending}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </>
        ) : (
          <Badge variant={ROLE_BADGE_VARIANT[member.role]}>{ROLE_LABELS[member.role]}</Badge>
        )}
      </div>
    </div>
  )
}

function InviteForm({ propertyId }: { propertyId: string }) {
  const [email, setEmail] = useState('')
  const [role, setRole] = useState<'editor' | 'viewer'>('viewer')
  const invite = useInviteMember(propertyId)

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) return
    try {
      await invite.mutateAsync({ input: { email: email.trim(), role } })
      toast.success(`Invitation sent to ${email}`)
      setEmail('')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed to send invitation')
    }
  }

  return (
    <form onSubmit={handleInvite} className="space-y-3">
      <div className="flex gap-2">
        <div className="flex-1 space-y-1.5">
          <Label htmlFor="invite-email" className="text-xs">
            Email address
          </Label>
          <Input
            id="invite-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@example.com"
            className="h-9"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="invite-role" className="text-xs">
            Role
          </Label>
          <Select value={role} onValueChange={(v) => setRole(v as 'editor' | 'viewer')}>
            <SelectTrigger id="invite-role" className="w-28 h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="editor">Editor</SelectItem>
              <SelectItem value="viewer">Viewer</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>
      <Button
        type="submit"
        size="sm"
        disabled={invite.isPending || !email.trim()}
        className="gap-2"
      >
        {invite.isPending ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <UserPlus className="h-4 w-4" />
        )}
        Send Invite
      </Button>
    </form>
  )
}

export function SharingSection({ propertyId, userId, isOwner }: SharingSectionProps) {
  const { data: members, isPending } = usePropertyMembers(propertyId)

  const activeAndPending = members?.filter((m) => m.status !== 'declined') ?? []

  return (
    <div className="rounded-xl border bg-card p-6 mb-8">
      <div className="flex items-center gap-3 mb-6">
        <div className="rounded-lg bg-primary/10 p-2">
          <Users className="h-5 w-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Sharing</h2>
          <p className="text-sm text-muted-foreground">Manage who has access to this property</p>
        </div>
      </div>

      {/* Current members */}
      {isPending ? (
        <div className="space-y-3 mb-6">
          <div className="h-12 bg-muted animate-pulse rounded" />
          <div className="h-12 bg-muted animate-pulse rounded" />
        </div>
      ) : activeAndPending.length > 0 ? (
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-3">
            <Shield className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">
              {activeAndPending.length} {activeAndPending.length === 1 ? 'member' : 'members'}
            </span>
          </div>
          <div>
            {activeAndPending.map((member) => (
              <MemberRow
                key={member.id}
                member={member}
                isOwner={isOwner}
                currentUserId={userId}
                propertyId={propertyId}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="mb-6 rounded-lg border-2 border-dashed bg-muted/30 p-6 text-center">
          <Mail className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">
            No collaborators yet. Invite someone to share access.
          </p>
        </div>
      )}

      {/* Invite form (owner only) */}
      {isOwner && (
        <div className="border-t pt-4">
          <p className="text-sm font-medium mb-3">Invite a collaborator</p>
          <InviteForm propertyId={propertyId} />
        </div>
      )}

      {!isOwner && (
        <p className="text-xs text-muted-foreground">Only the property owner can manage sharing.</p>
      )}
    </div>
  )
}
