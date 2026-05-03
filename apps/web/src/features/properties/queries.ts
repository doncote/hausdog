import { queryOptions, useQuery } from '@tanstack/react-query'
import { fetchProperties, fetchProperty } from './api'

export const propertyKeys = {
  all: ['properties'] as const,
  lists: () => [...propertyKeys.all, 'list'] as const,
  list: () => [...propertyKeys.lists()] as const,
  details: () => [...propertyKeys.all, 'detail'] as const,
  detail: (id: string) => [...propertyKeys.details(), id] as const,
}

export const propertiesQueryOptions = () =>
  queryOptions({
    queryKey: propertyKeys.list(),
    queryFn: () => fetchProperties({ data: {} }),
  })

export const propertyQueryOptions = (id: string) =>
  queryOptions({
    queryKey: propertyKeys.detail(id),
    queryFn: () => fetchProperty({ data: { id } }),
  })

export function useProperties() {
  return useQuery(propertiesQueryOptions())
}

export function useProperty(id: string) {
  return useQuery({
    ...propertyQueryOptions(id),
    enabled: !!id,
  })
}
