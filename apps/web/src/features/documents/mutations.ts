import { useMutation, useQueryClient } from '@tanstack/react-query'
import { itemKeys } from '../items/queries'
import {
  confirmDocumentAndCreateItem,
  createDocument,
  deleteDocument,
  updateDocument,
  updateDocumentStatus,
} from './api'
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

export function useConfirmDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: {
      documentId: string
      userId: string
      propertyId: string
      overrides?: {
        itemName?: string
        category?: string
        manufacturer?: string
        model?: string
        serialNumber?: string
        spaceId?: string
      }
    }) => confirmDocumentAndCreateItem({ data: input }),
    onSuccess: (_, variables) => {
      // Invalidate document queries
      queryClient.invalidateQueries({
        queryKey: documentKeys.listByProperty(variables.propertyId),
      })
      queryClient.invalidateQueries({
        queryKey: documentKeys.pendingReview(variables.propertyId),
      })
      queryClient.invalidateQueries({
        queryKey: documentKeys.detail(variables.documentId),
      })
      // Invalidate item queries since we may have created a new item
      queryClient.invalidateQueries({
        queryKey: itemKeys.listByProperty(variables.propertyId),
      })
      queryClient.invalidateQueries({
        queryKey: itemKeys.rootByProperty(variables.propertyId),
      })
    },
  })
}
