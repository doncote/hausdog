import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createCategory, deleteCategory, updateCategory } from './api'
import { categoryKeys } from './queries'
import type { CreateCategoryInput, UpdateCategoryInput } from './types'

export function useCreateCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { userId: string; input: CreateCategoryInput }) =>
      createCategory({ data: input }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.list(variables.userId) })
    },
  })
}

export function useUpdateCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { id: string; userId: string; input: UpdateCategoryInput }) =>
      updateCategory({ data: { id: input.id, input: input.input } }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.list(variables.userId) })
    },
  })
}

export function useDeleteCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { id: string; userId: string }) =>
      deleteCategory({ data: { id: input.id } }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.list(variables.userId) })
    },
  })
}
