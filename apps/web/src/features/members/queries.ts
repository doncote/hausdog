import { queryOptions, useQuery } from '@tanstack/react-query'
import { fetchPendingInvites, fetchPropertyMembers } from './api'

export const memberKeys = {
  all: ['members'] as const,
  forProperty: (propertyId: string) => [...memberKeys.all, 'property', propertyId] as const,
  pending: () => [...memberKeys.all, 'pending'] as const,
}

export const propertyMembersQueryOptions = (propertyId: string) =>
  queryOptions({
    queryKey: memberKeys.forProperty(propertyId),
    queryFn: () => fetchPropertyMembers({ data: { propertyId } }),
  })

export const pendingInvitesQueryOptions = () =>
  queryOptions({
    queryKey: memberKeys.pending(),
    queryFn: () => fetchPendingInvites({ data: {} }),
  })

export function usePropertyMembers(propertyId: string) {
  return useQuery({
    ...propertyMembersQueryOptions(propertyId),
    enabled: !!propertyId,
  })
}

export function usePendingInvites() {
  return useQuery(pendingInvitesQueryOptions())
}
