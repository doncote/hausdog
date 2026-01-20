import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { CreateComponentInput, UpdateComponentInput } from '@hausdog/domain/components'
import { createComponent, updateComponent, deleteComponent } from './api'
import { componentKeys } from './queries'

export function useCreateComponent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { userId: string; input: CreateComponentInput }) =>
      createComponent({ data: input }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: componentKeys.forSystem(variables.input.systemId),
      })
    },
  })
}

export function useUpdateComponent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { id: string; userId: string; systemId: string; input: UpdateComponentInput }) =>
      updateComponent({ data: { id: input.id, userId: input.userId, input: input.input } }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: componentKeys.forSystem(variables.systemId),
      })
      queryClient.invalidateQueries({ queryKey: componentKeys.detail(variables.id) })
    },
  })
}

export function useDeleteComponent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { id: string; userId: string; systemId: string }) =>
      deleteComponent({ data: { id: input.id, userId: input.userId } }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: componentKeys.forSystem(variables.systemId),
      })
      queryClient.removeQueries({ queryKey: componentKeys.detail(variables.id) })
    },
  })
}
