import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createSpace, deleteSpace, updateSpace } from './api'
import { spaceKeys } from './queries'
import type { CreateSpaceInput, UpdateSpaceInput } from './types'

export function useCreateSpace() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { userId: string; input: CreateSpaceInput }) =>
      createSpace({ data: input }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: spaceKeys.listByProperty(variables.input.propertyId),
      })
    },
  })
}

export function useUpdateSpace() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: {
      id: string
      userId: string
      propertyId: string
      input: UpdateSpaceInput
    }) => updateSpace({ data: { id: input.id, userId: input.userId, input: input.input } }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: spaceKeys.listByProperty(variables.propertyId) })
      queryClient.invalidateQueries({ queryKey: spaceKeys.detail(variables.id) })
    },
  })
}

export function useDeleteSpace() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { id: string; propertyId: string }) =>
      deleteSpace({ data: { id: input.id } }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: spaceKeys.listByProperty(variables.propertyId) })
      queryClient.removeQueries({ queryKey: spaceKeys.detail(variables.id) })
    },
  })
}
