import { queryOptions, useQuery } from '@tanstack/react-query'
import { fetchPendingInvites, fetchPropertyMembers } from './api'

export const memberKeys = {
  all: ['members'] as const,
  forProperty: (propertyId: string) => [...memberKeys.all, 'property', propertyId] as const,
  pendingForEmail: (email: string) => [...memberKeys.all, 'pending', email] as const,
}

export const propertyMembersQueryOptions = (propertyId: string, userId: string) =>
  queryOptions({
    queryKey: memberKeys.forProperty(propertyId),
    queryFn: () => fetchPropertyMembers({ data: { propertyId, userId } }),
  })

export const pendingInvitesQueryOptions = (userEmail: string) =>
  queryOptions({
    queryKey: memberKeys.pendingForEmail(userEmail),
    queryFn: () => fetchPendingInvites({ data: { userEmail } }),
  })

export function usePropertyMembers(propertyId: string, userId: string | undefined) {
  return useQuery({
    ...propertyMembersQueryOptions(propertyId, userId ?? ''),
    enabled: !!userId && !!propertyId,
  })
}

export function usePendingInvites(userEmail: string | undefined) {
  return useQuery({
    ...pendingInvitesQueryOptions(userEmail ?? ''),
    enabled: !!userEmail,
  })
}
