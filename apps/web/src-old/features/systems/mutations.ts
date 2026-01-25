import { useMutation, useQueryClient } from '@tanstack/react-query'
import type { CreateSystemInput, UpdateSystemInput } from '@hausdog/domain/systems'
import { createSystem, updateSystem, deleteSystem } from './api'
import { systemKeys } from './queries'

export function useCreateSystem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { userId: string; input: CreateSystemInput }) =>
      createSystem({ data: input }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: systemKeys.forProperty(variables.input.propertyId),
      })
    },
  })
}

export function useUpdateSystem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { id: string; userId: string; propertyId: string; input: UpdateSystemInput }) =>
      updateSystem({ data: { id: input.id, userId: input.userId, input: input.input } }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: systemKeys.forProperty(variables.propertyId),
      })
      queryClient.invalidateQueries({ queryKey: systemKeys.detail(variables.id) })
    },
  })
}

export function useDeleteSystem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { id: string; userId: string; propertyId: string }) =>
      deleteSystem({ data: { id: input.id, userId: input.userId } }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: systemKeys.forProperty(variables.propertyId),
      })
      queryClient.removeQueries({ queryKey: systemKeys.detail(variables.id) })
    },
  })
}
