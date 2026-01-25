import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createItem, updateItem, deleteItem } from './api'
import { itemKeys } from './queries'
import type { CreateItemInput, UpdateItemInput } from './types'

export function useCreateItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { userId: string; input: CreateItemInput }) =>
      createItem({ data: input }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: itemKeys.listByProperty(variables.input.propertyId) })
      queryClient.invalidateQueries({ queryKey: itemKeys.rootByProperty(variables.input.propertyId) })
    },
  })
}

export function useUpdateItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { id: string; userId: string; propertyId: string; input: UpdateItemInput }) =>
      updateItem({ data: { id: input.id, userId: input.userId, input: input.input } }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: itemKeys.listByProperty(variables.propertyId) })
      queryClient.invalidateQueries({ queryKey: itemKeys.rootByProperty(variables.propertyId) })
      queryClient.invalidateQueries({ queryKey: itemKeys.detail(variables.id) })
    },
  })
}

export function useDeleteItem() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { id: string; propertyId: string }) => deleteItem({ data: { id: input.id } }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: itemKeys.listByProperty(variables.propertyId) })
      queryClient.invalidateQueries({ queryKey: itemKeys.rootByProperty(variables.propertyId) })
      queryClient.removeQueries({ queryKey: itemKeys.detail(variables.id) })
    },
  })
}
