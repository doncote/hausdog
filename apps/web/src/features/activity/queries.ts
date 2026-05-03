import { queryOptions, useQuery } from '@tanstack/react-query'
import { fetchActivityFeed } from './api'

export const activityKeys = {
  forProperty: (propertyId: string) => ['activity', 'property', propertyId] as const,
}

export const activityFeedQueryOptions = (propertyId: string, limit?: number) =>
  queryOptions({
    queryKey: activityKeys.forProperty(propertyId),
    queryFn: () => fetchActivityFeed({ data: { propertyId, limit } }),
  })

export function useActivityFeed(propertyId: string, limit?: number) {
  return useQuery({
    ...activityFeedQueryOptions(propertyId, limit),
    enabled: !!propertyId,
  })
}
