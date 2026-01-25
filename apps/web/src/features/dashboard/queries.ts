import { queryOptions, useQuery } from '@tanstack/react-query'
import { fetchDashboardStats } from './api'

export const dashboardKeys = {
  all: ['dashboard'] as const,
  stats: (userId: string) => [...dashboardKeys.all, 'stats', userId] as const,
}

export const dashboardStatsQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: dashboardKeys.stats(userId),
    queryFn: () => fetchDashboardStats({ data: { userId } }),
  })

export function useDashboardStats(userId: string | undefined) {
  return useQuery({
    ...dashboardStatsQueryOptions(userId ?? ''),
    enabled: !!userId,
  })
}
