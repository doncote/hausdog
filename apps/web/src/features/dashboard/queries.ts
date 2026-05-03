import { queryOptions, useQuery } from '@tanstack/react-query'
import { fetchDashboardStats } from './api'

export const dashboardKeys = {
  all: ['dashboard'] as const,
  stats: () => [...dashboardKeys.all, 'stats'] as const,
}

export const dashboardStatsQueryOptions = () =>
  queryOptions({
    queryKey: dashboardKeys.stats(),
    queryFn: () => fetchDashboardStats({ data: {} }),
  })

export function useDashboardStats() {
  return useQuery(dashboardStatsQueryOptions())
}
