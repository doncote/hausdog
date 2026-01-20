import { queryOptions, useQuery } from '@tanstack/react-query'
import { fetchCategories } from './api'

export const categoryKeys = {
  all: ['categories'] as const,
}

export const categoriesQueryOptions = () =>
  queryOptions({
    queryKey: categoryKeys.all,
    queryFn: () => fetchCategories(),
    staleTime: 1000 * 60 * 60, // Categories rarely change, cache for 1 hour
  })

export function useCategories() {
  return useQuery(categoriesQueryOptions())
}
