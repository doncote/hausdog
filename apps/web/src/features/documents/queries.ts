import { queryOptions, useQuery } from '@tanstack/react-query'
import {
  fetchDocumentsForProperty,
  fetchPendingReviewDocuments,
  fetchDocumentsByStatus,
  fetchDocument,
} from './api'

export const documentKeys = {
  all: ['documents'] as const,
  lists: () => [...documentKeys.all, 'list'] as const,
  listByProperty: (propertyId: string) => [...documentKeys.lists(), 'property', propertyId] as const,
  listByStatus: (propertyId: string, status: string) =>
    [...documentKeys.lists(), 'property', propertyId, 'status', status] as const,
  pendingReview: (propertyId: string) =>
    [...documentKeys.lists(), 'property', propertyId, 'pending-review'] as const,
  details: () => [...documentKeys.all, 'detail'] as const,
  detail: (id: string) => [...documentKeys.details(), id] as const,
}

export const documentsForPropertyQueryOptions = (propertyId: string) =>
  queryOptions({
    queryKey: documentKeys.listByProperty(propertyId),
    queryFn: () => fetchDocumentsForProperty({ data: { propertyId } }),
  })

export const pendingReviewDocumentsQueryOptions = (propertyId: string) =>
  queryOptions({
    queryKey: documentKeys.pendingReview(propertyId),
    queryFn: () => fetchPendingReviewDocuments({ data: { propertyId } }),
  })

export const documentsByStatusQueryOptions = (propertyId: string, status: string) =>
  queryOptions({
    queryKey: documentKeys.listByStatus(propertyId, status),
    queryFn: () => fetchDocumentsByStatus({ data: { propertyId, status } }),
  })

export const documentQueryOptions = (id: string) =>
  queryOptions({
    queryKey: documentKeys.detail(id),
    queryFn: () => fetchDocument({ data: { id } }),
  })

export function useDocumentsForProperty(propertyId: string | undefined) {
  return useQuery({
    ...documentsForPropertyQueryOptions(propertyId ?? ''),
    enabled: !!propertyId,
  })
}

export function usePendingReviewDocuments(propertyId: string | undefined) {
  return useQuery({
    ...pendingReviewDocumentsQueryOptions(propertyId ?? ''),
    enabled: !!propertyId,
  })
}

export function useDocumentsByStatus(propertyId: string | undefined, status: string) {
  return useQuery({
    ...documentsByStatusQueryOptions(propertyId ?? '', status),
    enabled: !!propertyId,
  })
}

export function useDocument(id: string | undefined) {
  return useQuery({
    ...documentQueryOptions(id ?? ''),
    enabled: !!id,
  })
}
