import { useMutation, useQueryClient } from '@tanstack/react-query'
import { acceptInvite, declineInvite, inviteMember, removeMember, updateMemberRole } from './api'
import { memberKeys } from './queries'
import type { InviteMemberInput, UpdateMemberRoleInput } from './types'

export function useInviteMember(propertyId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { userId: string; input: InviteMemberInput }) =>
      inviteMember({ data: { propertyId, userId: input.userId, input: input.input } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: memberKeys.forProperty(propertyId) })
    },
  })
}

export function useUpdateMemberRole(propertyId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: {
      memberId: string
      requestingUserId: string
      input: UpdateMemberRoleInput
    }) =>
      updateMemberRole({
        data: {
          memberId: input.memberId,
          propertyId,
          requestingUserId: input.requestingUserId,
          input: input.input,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: memberKeys.forProperty(propertyId) })
    },
  })
}

export function useRemoveMember(propertyId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { memberId: string; requestingUserId: string }) =>
      removeMember({
        data: { memberId: input.memberId, propertyId, requestingUserId: input.requestingUserId },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: memberKeys.forProperty(propertyId) })
    },
  })
}

export function useAcceptInvite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { memberId: string; userId: string; userEmail: string }) =>
      acceptInvite({ data: input }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: memberKeys.pendingForEmail('') })
      queryClient.invalidateQueries({ queryKey: memberKeys.forProperty(data.propertyId) })
    },
  })
}

export function useDeclineInvite(userEmail: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { memberId: string; userId: string }) => declineInvite({ data: input }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: memberKeys.pendingForEmail(userEmail) })
    },
  })
}
