import { queryOptions, useQuery } from '@tanstack/react-query'
import { fetchItemsForProperty, fetchRootItemsForProperty, fetchItem } from './api'

export const itemKeys = {
  all: ['items'] as const,
  lists: () => [...itemKeys.all, 'list'] as const,
  listByProperty: (propertyId: string) => [...itemKeys.lists(), 'property', propertyId] as const,
  rootByProperty: (propertyId: string) => [...itemKeys.lists(), 'root', propertyId] as const,
  details: () => [...itemKeys.all, 'detail'] as const,
  detail: (id: string) => [...itemKeys.details(), id] as const,
}

export const itemsForPropertyQueryOptions = (propertyId: string) =>
  queryOptions({
    queryKey: itemKeys.listByProperty(propertyId),
    queryFn: () => fetchItemsForProperty({ data: { propertyId } }),
  })

export const rootItemsForPropertyQueryOptions = (propertyId: string) =>
  queryOptions({
    queryKey: itemKeys.rootByProperty(propertyId),
    queryFn: () => fetchRootItemsForProperty({ data: { propertyId } }),
  })

export const itemQueryOptions = (id: string) =>
  queryOptions({
    queryKey: itemKeys.detail(id),
    queryFn: () => fetchItem({ data: { id } }),
  })

export function useItemsForProperty(propertyId: string | undefined) {
  return useQuery({
    ...itemsForPropertyQueryOptions(propertyId ?? ''),
    enabled: !!propertyId,
  })
}

export function useRootItemsForProperty(propertyId: string | undefined) {
  return useQuery({
    ...rootItemsForPropertyQueryOptions(propertyId ?? ''),
    enabled: !!propertyId,
  })
}

export function useItem(id: string | undefined) {
  return useQuery({
    ...itemQueryOptions(id ?? ''),
    enabled: !!id,
  })
}
