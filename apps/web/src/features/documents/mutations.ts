import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createDocument, updateDocument, updateDocumentStatus, deleteDocument } from './api'
import { documentKeys } from './queries'
import type { CreateDocumentInput, UpdateDocumentInput } from './types'

export function useCreateDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { userId: string; input: CreateDocumentInput }) =>
      createDocument({ data: input }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: documentKeys.listByProperty(variables.input.propertyId),
      })
      queryClient.invalidateQueries({
        queryKey: documentKeys.pendingReview(variables.input.propertyId),
      })
    },
  })
}

export function useUpdateDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { id: string; propertyId: string; input: UpdateDocumentInput }) =>
      updateDocument({ data: { id: input.id, input: input.input } }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: documentKeys.listByProperty(variables.propertyId),
      })
      queryClient.invalidateQueries({
        queryKey: documentKeys.pendingReview(variables.propertyId),
      })
      queryClient.invalidateQueries({
        queryKey: documentKeys.detail(variables.id),
      })
    },
  })
}

export function useUpdateDocumentStatus() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { id: string; propertyId: string; status: string }) =>
      updateDocumentStatus({ data: { id: input.id, status: input.status } }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: documentKeys.listByProperty(variables.propertyId),
      })
      queryClient.invalidateQueries({
        queryKey: documentKeys.pendingReview(variables.propertyId),
      })
      queryClient.invalidateQueries({
        queryKey: documentKeys.detail(variables.id),
      })
    },
  })
}

export function useDeleteDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { id: string; propertyId: string }) =>
      deleteDocument({ data: { id: input.id } }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: documentKeys.listByProperty(variables.propertyId),
      })
      queryClient.invalidateQueries({
        queryKey: documentKeys.pendingReview(variables.propertyId),
      })
      queryClient.removeQueries({
        queryKey: documentKeys.detail(variables.id),
      })
    },
  })
}
