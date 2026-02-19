import { useMutation, useQueryClient } from '@tanstack/react-query'
import { eventKeys } from '@/features/events/queries'
import { itemKeys } from '@/features/items/queries'
import {
  completeMaintenanceTask,
  createMaintenanceTask,
  deleteMaintenanceTask,
  snoozeMaintenanceTask,
  triggerMaintenanceSuggestions,
  updateMaintenanceTask,
} from './api'
import { maintenanceKeys } from './queries'
import type {
  CompleteMaintenanceTaskInput,
  CreateMaintenanceTaskInput,
  UpdateMaintenanceTaskInput,
} from './types'

export function useCreateMaintenanceTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { userId: string; input: CreateMaintenanceTaskInput }) =>
      createMaintenanceTask({ data: input }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: maintenanceKeys.listByProperty(variables.input.propertyId),
      })
      if (variables.input.itemId) {
        queryClient.invalidateQueries({
          queryKey: maintenanceKeys.listByItem(variables.input.itemId),
        })
      }
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.lists() })
    },
  })
}

export function useUpdateMaintenanceTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: {
      id: string
      userId: string
      propertyId: string
      input: UpdateMaintenanceTaskInput
    }) =>
      updateMaintenanceTask({ data: { id: input.id, userId: input.userId, input: input.input } }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: maintenanceKeys.listByProperty(variables.propertyId),
      })
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.detail(variables.id) })
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.lists() })
    },
  })
}

export function useCompleteMaintenanceTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: {
      id: string
      userId: string
      propertyId: string
      itemId: string | null
      input: CompleteMaintenanceTaskInput
    }) =>
      completeMaintenanceTask({
        data: { id: input.id, userId: input.userId, input: input.input },
      }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: maintenanceKeys.listByProperty(variables.propertyId),
      })
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.detail(variables.id) })
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.lists() })
      // Completing a task creates an Event record if itemId is present
      if (variables.itemId) {
        queryClient.invalidateQueries({ queryKey: eventKeys.listByItem(variables.itemId) })
        queryClient.invalidateQueries({ queryKey: itemKeys.detail(variables.itemId) })
      }
    },
  })
}

export function useSnoozeMaintenanceTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { id: string; userId: string; propertyId: string }) =>
      snoozeMaintenanceTask({ data: { id: input.id, userId: input.userId } }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: maintenanceKeys.listByProperty(variables.propertyId),
      })
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.detail(variables.id) })
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.lists() })
    },
  })
}

export function useDeleteMaintenanceTask() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { id: string; propertyId: string }) =>
      deleteMaintenanceTask({ data: { id: input.id } }),
    onSuccess: (_, variables) => {
      queryClient.removeQueries({ queryKey: maintenanceKeys.detail(variables.id) })
      queryClient.invalidateQueries({
        queryKey: maintenanceKeys.listByProperty(variables.propertyId),
      })
      queryClient.invalidateQueries({ queryKey: maintenanceKeys.lists() })
    },
  })
}

export function useTriggerMaintenanceSuggestions() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { itemId: string; userId: string }) =>
      triggerMaintenanceSuggestions({ data: input }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: maintenanceKeys.listByItem(variables.itemId),
      })
    },
  })
}
