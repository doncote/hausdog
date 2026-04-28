import { queryOptions, useQuery } from '@tanstack/react-query'
import { fetchWorkIssues, type FetchWorkIssuesInput } from './api'

export const workIssuesQueryOptions = (filters: FetchWorkIssuesInput) =>
  queryOptions({
    queryKey: ['work-issues', filters],
    queryFn: () => fetchWorkIssues({ data: filters }),
    staleTime: 30_000,
  })

export function useWorkIssues(filters: FetchWorkIssuesInput) {
  return useQuery(workIssuesQueryOptions(filters))
}
