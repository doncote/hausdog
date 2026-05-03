import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createCategory, deleteCategory, updateCategory } from './api'
import { categoryKeys } from './queries'
import type { CreateCategoryInput, UpdateCategoryInput } from './types'

export function useCreateCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { input: CreateCategoryInput }) =>
      createCategory({ data: { input: input.input } }),
    onSuccess: (_) => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.list() })
    },
  })
}

export function useUpdateCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { id: string; input: UpdateCategoryInput }) =>
      updateCategory({ data: { id: input.id, input: input.input } }),
    onSuccess: (_) => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.list() })
    },
  })
}

export function useDeleteCategory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { id: string }) =>
      deleteCategory({ data: { id: input.id } }),
    onSuccess: (_) => {
      queryClient.invalidateQueries({ queryKey: categoryKeys.list() })
    },
  })
}
