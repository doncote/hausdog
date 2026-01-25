import { queryOptions, useQuery } from '@tanstack/react-query'
import { fetchSpacesForProperty, fetchSpace } from './api'

export const spaceKeys = {
  all: ['spaces'] as const,
  lists: () => [...spaceKeys.all, 'list'] as const,
  listByProperty: (propertyId: string) => [...spaceKeys.lists(), 'property', propertyId] as const,
  details: () => [...spaceKeys.all, 'detail'] as const,
  detail: (id: string) => [...spaceKeys.details(), id] as const,
}

export const spacesForPropertyQueryOptions = (propertyId: string) =>
  queryOptions({
    queryKey: spaceKeys.listByProperty(propertyId),
    queryFn: () => fetchSpacesForProperty({ data: { propertyId } }),
  })

export const spaceQueryOptions = (id: string) =>
  queryOptions({
    queryKey: spaceKeys.detail(id),
    queryFn: () => fetchSpace({ data: { id } }),
  })

export function useSpacesForProperty(propertyId: string | undefined) {
  return useQuery({
    ...spacesForPropertyQueryOptions(propertyId ?? ''),
    enabled: !!propertyId,
  })
}

export function useSpace(id: string | undefined) {
  return useQuery({
    ...spaceQueryOptions(id ?? ''),
    enabled: !!id,
  })
}
