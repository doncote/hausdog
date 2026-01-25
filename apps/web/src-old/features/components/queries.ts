import { queryOptions, useQuery } from '@tanstack/react-query'
import { fetchComponentsForSystem, fetchComponent } from './api'

export const componentKeys = {
  all: ['components'] as const,
  forSystem: (systemId: string) => [...componentKeys.all, 'system', systemId] as const,
  details: () => [...componentKeys.all, 'detail'] as const,
  detail: (id: string) => [...componentKeys.details(), id] as const,
}

export const componentsForSystemQueryOptions = (systemId: string, userId: string) =>
  queryOptions({
    queryKey: componentKeys.forSystem(systemId),
    queryFn: () => fetchComponentsForSystem({ data: { systemId, userId } }),
  })

export const componentQueryOptions = (id: string, userId: string) =>
  queryOptions({
    queryKey: componentKeys.detail(id),
    queryFn: () => fetchComponent({ data: { id, userId } }),
  })

export function useComponentsForSystem(systemId: string, userId: string | undefined) {
  return useQuery({
    ...componentsForSystemQueryOptions(systemId, userId ?? ''),
    enabled: !!userId && !!systemId,
  })
}

export function useComponent(id: string, userId: string | undefined) {
  return useQuery({
    ...componentQueryOptions(id, userId ?? ''),
    enabled: !!userId && !!id,
  })
}
