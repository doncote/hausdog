import { queryOptions, useQuery } from '@tanstack/react-query'
import { fetchItemsForProperty, fetchRootItemsForProperty, fetchItemsForSpace, fetchItem } from './api'

export const itemKeys = {
  all: ['items'] as const,
  lists: () => [...itemKeys.all, 'list'] as const,
  listByProperty: (propertyId: string) => [...itemKeys.lists(), 'property', propertyId] as const,
  listBySpace: (spaceId: string) => [...itemKeys.lists(), 'space', spaceId] as const,
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

export const itemsForSpaceQueryOptions = (spaceId: string) =>
  queryOptions({
    queryKey: itemKeys.listBySpace(spaceId),
    queryFn: () => fetchItemsForSpace({ data: { spaceId } }),
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

export function useItemsForSpace(spaceId: string | undefined) {
  return useQuery({
    ...itemsForSpaceQueryOptions(spaceId ?? ''),
    enabled: !!spaceId,
  })
}

export function useItem(id: string | undefined) {
  return useQuery({
    ...itemQueryOptions(id ?? ''),
    enabled: !!id,
  })
}
