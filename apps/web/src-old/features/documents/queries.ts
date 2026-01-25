import { queryOptions, useQuery } from '@tanstack/react-query'
import { fetchDocumentsForUser, fetchDocumentsForProperty, fetchDocumentsForSystem, fetchDocument } from './api'

export const documentKeys = {
  all: ['documents'] as const,
  forUser: (userId: string) => [...documentKeys.all, 'user', userId] as const,
  forProperty: (propertyId: string) => [...documentKeys.all, 'property', propertyId] as const,
  forSystem: (systemId: string) => [...documentKeys.all, 'system', systemId] as const,
  details: () => [...documentKeys.all, 'detail'] as const,
  detail: (id: string) => [...documentKeys.details(), id] as const,
}

export const documentsForUserQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: documentKeys.forUser(userId),
    queryFn: () => fetchDocumentsForUser({ data: { userId } }),
  })

export const documentsForPropertyQueryOptions = (propertyId: string, userId: string) =>
  queryOptions({
    queryKey: documentKeys.forProperty(propertyId),
    queryFn: () => fetchDocumentsForProperty({ data: { propertyId, userId } }),
  })

export const documentsForSystemQueryOptions = (systemId: string, userId: string) =>
  queryOptions({
    queryKey: documentKeys.forSystem(systemId),
    queryFn: () => fetchDocumentsForSystem({ data: { systemId, userId } }),
  })

export const documentQueryOptions = (id: string, userId: string) =>
  queryOptions({
    queryKey: documentKeys.detail(id),
    queryFn: () => fetchDocument({ data: { id, userId } }),
  })

export function useDocumentsForUser(userId: string | undefined) {
  return useQuery({
    ...documentsForUserQueryOptions(userId ?? ''),
    enabled: !!userId,
  })
}

export function useDocumentsForProperty(propertyId: string, userId: string | undefined) {
  return useQuery({
    ...documentsForPropertyQueryOptions(propertyId, userId ?? ''),
    enabled: !!userId && !!propertyId,
  })
}

export function useDocumentsForSystem(systemId: string, userId: string | undefined) {
  return useQuery({
    ...documentsForSystemQueryOptions(systemId, userId ?? ''),
    enabled: !!userId && !!systemId,
  })
}

export function useDocument(id: string, userId: string | undefined) {
  return useQuery({
    ...documentQueryOptions(id, userId ?? ''),
    enabled: !!userId && !!id,
  })
}
