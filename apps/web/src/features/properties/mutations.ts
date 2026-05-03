import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createProperty, deleteProperty, updateProperty } from './api'
import { propertyKeys } from './queries'
import type { CreatePropertyInput, UpdatePropertyInput } from './types'

export function useCreateProperty() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { input: CreatePropertyInput }) =>
      createProperty({ data: { input: input.input } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: propertyKeys.list() })
    },
  })
}

export function useUpdateProperty() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { id: string; input: UpdatePropertyInput }) =>
      updateProperty({ data: { id: input.id, input: input.input } }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: propertyKeys.list() })
      queryClient.invalidateQueries({ queryKey: propertyKeys.detail(variables.id) })
    },
  })
}

export function useDeleteProperty() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { id: string }) => deleteProperty({ data: { id: input.id } }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: propertyKeys.list() })
      queryClient.removeQueries({ queryKey: propertyKeys.detail(variables.id) })
    },
  })
}
