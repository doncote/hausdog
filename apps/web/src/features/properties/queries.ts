import { queryOptions, useQuery } from '@tanstack/react-query'
import { fetchProperties, fetchProperty } from './api'

export const propertyKeys = {
  all: ['properties'] as const,
  lists: () => [...propertyKeys.all, 'list'] as const,
  list: (userId: string) => [...propertyKeys.lists(), userId] as const,
  details: () => [...propertyKeys.all, 'detail'] as const,
  detail: (id: string) => [...propertyKeys.details(), id] as const,
}

export const propertiesQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: propertyKeys.list(userId),
    queryFn: () => fetchProperties({ data: userId }),
  })

export const propertyQueryOptions = (id: string, userId: string) =>
  queryOptions({
    queryKey: propertyKeys.detail(id),
    queryFn: () => fetchProperty({ data: { id, userId } }),
  })

export function useProperties(userId: string | undefined) {
  return useQuery({
    ...propertiesQueryOptions(userId ?? ''),
    enabled: !!userId,
  })
}

export function useProperty(id: string, userId: string | undefined) {
  return useQuery({
    ...propertyQueryOptions(id, userId ?? ''),
    enabled: !!userId && !!id,
  })
}
