import { useMutation, useQueryClient } from '@tanstack/react-query'
import { acceptInvite, declineInvite, inviteMember, removeMember, updateMemberRole } from './api'
import { memberKeys } from './queries'
import type { InviteMemberInput, UpdateMemberRoleInput } from './types'

export function useInviteMember(propertyId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { input: InviteMemberInput }) =>
      inviteMember({ data: { propertyId, input: input.input } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: memberKeys.forProperty(propertyId) })
    },
  })
}

export function useUpdateMemberRole(propertyId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { memberId: string; input: UpdateMemberRoleInput }) =>
      updateMemberRole({
        data: {
          memberId: input.memberId,
          propertyId,
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
    mutationFn: (input: { memberId: string }) =>
      removeMember({
        data: { memberId: input.memberId, propertyId },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: memberKeys.forProperty(propertyId) })
    },
  })
}

export function useAcceptInvite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { memberId: string }) =>
      acceptInvite({ data: { memberId: input.memberId } }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: memberKeys.pending() })
      queryClient.invalidateQueries({ queryKey: memberKeys.forProperty(data.propertyId) })
    },
  })
}

export function useDeclineInvite() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (input: { memberId: string }) =>
      declineInvite({ data: { memberId: input.memberId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: memberKeys.pending() })
    },
  })
}
