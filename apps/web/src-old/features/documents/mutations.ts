import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { CreateDocumentInput } from '@hausdog/domain/documents'
import { createDocument, deleteDocument } from './api'
import { uploadDocument } from './upload'
import { extractDocument } from './extract'
import { documentKeys } from './queries'

interface UploadInput {
  userId: string
  filename: string
  contentType: string
  fileData: string // base64 encoded
  propertyId?: string
  systemId?: string
  componentId?: string
}

export function useUploadDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: UploadInput) => uploadDocument({ data: input }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.forUser(variables.userId) })
      if (variables.propertyId) {
        queryClient.invalidateQueries({ queryKey: documentKeys.forProperty(variables.propertyId) })
      }
      if (variables.systemId) {
        queryClient.invalidateQueries({ queryKey: documentKeys.forSystem(variables.systemId) })
      }
    },
  })
}

export function useExtractDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { documentId: string; userId: string; systemId?: string }) =>
      extractDocument({ data: { documentId: input.documentId, userId: input.userId } }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.forUser(variables.userId) })
      if (variables.systemId) {
        queryClient.invalidateQueries({ queryKey: documentKeys.forSystem(variables.systemId) })
      }
      queryClient.invalidateQueries({ queryKey: documentKeys.detail(variables.documentId) })
    },
  })
}

export function useCreateDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { userId: string; input: CreateDocumentInput }) =>
      createDocument({ data: input }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.forUser(variables.userId) })
      if (variables.input.propertyId) {
        queryClient.invalidateQueries({ queryKey: documentKeys.forProperty(variables.input.propertyId) })
      }
      if (variables.input.systemId) {
        queryClient.invalidateQueries({ queryKey: documentKeys.forSystem(variables.input.systemId) })
      }
    },
  })
}

export function useDeleteDocument() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { id: string; userId: string; systemId?: string; propertyId?: string }) =>
      deleteDocument({ data: { id: input.id, userId: input.userId } }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: documentKeys.forUser(variables.userId) })
      if (variables.propertyId) {
        queryClient.invalidateQueries({ queryKey: documentKeys.forProperty(variables.propertyId) })
      }
      if (variables.systemId) {
        queryClient.invalidateQueries({ queryKey: documentKeys.forSystem(variables.systemId) })
      }
      queryClient.removeQueries({ queryKey: documentKeys.detail(variables.id) })
    },
  })
}
