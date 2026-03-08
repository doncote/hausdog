import { queryOptions, useQuery } from '@tanstack/react-query'
import { fetchActivityFeed } from './api'

export const activityKeys = {
  forProperty: (propertyId: string) => ['activity', 'property', propertyId] as const,
}

export const activityFeedQueryOptions = (propertyId: string, userId: string, limit?: number) =>
  queryOptions({
    queryKey: activityKeys.forProperty(propertyId),
    queryFn: () => fetchActivityFeed({ data: { propertyId, userId, limit } }),
  })

export function useActivityFeed(propertyId: string, userId: string | undefined, limit?: number) {
  return useQuery({
    ...activityFeedQueryOptions(propertyId, userId ?? '', limit),
    enabled: !!userId && !!propertyId,
  })
}
