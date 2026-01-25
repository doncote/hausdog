import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createProperty, updateProperty, deleteProperty } from './api'
import { propertyKeys } from './queries'
import type { CreatePropertyInput, UpdatePropertyInput } from './types'

export function useCreateProperty() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { userId: string; input: CreatePropertyInput }) =>
      createProperty({ data: input }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: propertyKeys.list(variables.userId) })
    },
  })
}

export function useUpdateProperty() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { id: string; userId: string; input: UpdatePropertyInput }) =>
      updateProperty({ data: input }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: propertyKeys.list(variables.userId) })
      queryClient.invalidateQueries({ queryKey: propertyKeys.detail(variables.id) })
    },
  })
}

export function useDeleteProperty() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { id: string; userId: string }) => deleteProperty({ data: input }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: propertyKeys.list(variables.userId) })
      queryClient.removeQueries({ queryKey: propertyKeys.detail(variables.id) })
    },
  })
}
