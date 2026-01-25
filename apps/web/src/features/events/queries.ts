import { queryOptions, useQuery } from '@tanstack/react-query'
import { fetchEvent, fetchEventsForItem } from './api'

export const eventKeys = {
  all: ['events'] as const,
  lists: () => [...eventKeys.all, 'list'] as const,
  listByItem: (itemId: string) => [...eventKeys.lists(), 'item', itemId] as const,
  details: () => [...eventKeys.all, 'detail'] as const,
  detail: (id: string) => [...eventKeys.details(), id] as const,
}

export const eventsForItemQueryOptions = (itemId: string) =>
  queryOptions({
    queryKey: eventKeys.listByItem(itemId),
    queryFn: () => fetchEventsForItem({ data: { itemId } }),
  })

export const eventQueryOptions = (id: string) =>
  queryOptions({
    queryKey: eventKeys.detail(id),
    queryFn: () => fetchEvent({ data: { id } }),
  })

export function useEventsForItem(itemId: string | undefined) {
  return useQuery({
    ...eventsForItemQueryOptions(itemId ?? ''),
    enabled: !!itemId,
  })
}

export function useEvent(id: string | undefined) {
  return useQuery({
    ...eventQueryOptions(id ?? ''),
    enabled: !!id,
  })
}
