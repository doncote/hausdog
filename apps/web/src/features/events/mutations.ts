import { useMutation, useQueryClient } from '@tanstack/react-query'
import { createEvent, updateEvent, deleteEvent } from './api'
import { eventKeys } from './queries'
import { itemKeys } from '@/features/items/queries'
import type { CreateEventInput, UpdateEventInput } from './types'

export function useCreateEvent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { userId: string; input: CreateEventInput }) =>
      createEvent({ data: input }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: eventKeys.listByItem(variables.input.itemId) })
      // Also invalidate item detail to update event count
      queryClient.invalidateQueries({ queryKey: itemKeys.detail(variables.input.itemId) })
    },
  })
}

export function useUpdateEvent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { id: string; userId: string; itemId: string; input: UpdateEventInput }) =>
      updateEvent({ data: { id: input.id, userId: input.userId, input: input.input } }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: eventKeys.listByItem(variables.itemId) })
      queryClient.invalidateQueries({ queryKey: eventKeys.detail(variables.id) })
    },
  })
}

export function useDeleteEvent() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { id: string; itemId: string }) => deleteEvent({ data: { id: input.id } }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: eventKeys.listByItem(variables.itemId) })
      queryClient.removeQueries({ queryKey: eventKeys.detail(variables.id) })
      // Also invalidate item detail to update event count
      queryClient.invalidateQueries({ queryKey: itemKeys.detail(variables.itemId) })
    },
  })
}
