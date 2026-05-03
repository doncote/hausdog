import { queryOptions, useQuery } from '@tanstack/react-query'
import { fetchCategories } from './api'

export const categoryKeys = {
  all: ['categories'] as const,
  list: () => [...categoryKeys.all, 'list'] as const,
}

export const categoriesQueryOptions = () =>
  queryOptions({
    queryKey: categoryKeys.list(),
    queryFn: () => fetchCategories({ data: {} }),
  })

export function useCategories() {
  return useQuery(categoriesQueryOptions())
}
