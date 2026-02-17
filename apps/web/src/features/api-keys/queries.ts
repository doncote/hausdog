import { queryOptions, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createApiKey, deleteApiKey, fetchApiKeys } from './api'

export const apiKeyKeys = {
  all: ['apiKeys'] as const,
  list: () => [...apiKeyKeys.all, 'list'] as const,
}

export const apiKeysQueryOptions = () =>
  queryOptions({
    queryKey: apiKeyKeys.list(),
    queryFn: () => fetchApiKeys(),
  })

export function useApiKeys() {
  return useQuery(apiKeysQueryOptions())
}

export function useCreateApiKey() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (name: string) => createApiKey({ data: { name } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiKeyKeys.all })
    },
  })
}

export function useDeleteApiKey() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => deleteApiKey({ data: { id } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: apiKeyKeys.all })
    },
  })
}
