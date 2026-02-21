import { queryOptions, useQuery } from '@tanstack/react-query'
import { fetchCategories } from './api'

export const categoryKeys = {
  all: ['categories'] as const,
  list: (userId: string) => [...categoryKeys.all, 'list', userId] as const,
}

export const categoriesQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: categoryKeys.list(userId),
    queryFn: () => fetchCategories({ data: { userId } }),
  })

export function useCategories(userId: string | undefined) {
  return useQuery({
    ...categoriesQueryOptions(userId ?? ''),
    enabled: !!userId,
  })
}
