import { queryOptions, useQuery } from '@tanstack/react-query'
import { fetchSystemsForProperty, fetchSystem } from './api'

export const systemKeys = {
  all: ['systems'] as const,
  forProperty: (propertyId: string) => [...systemKeys.all, 'property', propertyId] as const,
  details: () => [...systemKeys.all, 'detail'] as const,
  detail: (id: string) => [...systemKeys.details(), id] as const,
}

export const systemsForPropertyQueryOptions = (propertyId: string, userId: string) =>
  queryOptions({
    queryKey: systemKeys.forProperty(propertyId),
    queryFn: () => fetchSystemsForProperty({ data: { propertyId, userId } }),
  })

export const systemQueryOptions = (id: string, userId: string) =>
  queryOptions({
    queryKey: systemKeys.detail(id),
    queryFn: () => fetchSystem({ data: { id, userId } }),
  })

export function useSystemsForProperty(propertyId: string, userId: string | undefined) {
  return useQuery({
    ...systemsForPropertyQueryOptions(propertyId, userId ?? ''),
    enabled: !!userId && !!propertyId,
  })
}

export function useSystem(id: string, userId: string | undefined) {
  return useQuery({
    ...systemQueryOptions(id, userId ?? ''),
    enabled: !!userId && !!id,
  })
}
