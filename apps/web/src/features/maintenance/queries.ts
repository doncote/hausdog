import { queryOptions, useQuery } from '@tanstack/react-query'
import {
  fetchMaintenanceTask,
  fetchMaintenanceTasksForItem,
  fetchMaintenanceTasksForProperty,
  fetchUpcomingMaintenanceTasks,
} from './api'

export const maintenanceKeys = {
  all: ['maintenance'] as const,
  lists: () => [...maintenanceKeys.all, 'list'] as const,
  listByProperty: (propertyId: string) =>
    [...maintenanceKeys.lists(), 'property', propertyId] as const,
  listByItem: (itemId: string) => [...maintenanceKeys.lists(), 'item', itemId] as const,
  upcoming: () => [...maintenanceKeys.lists(), 'upcoming'] as const,
  details: () => [...maintenanceKeys.all, 'detail'] as const,
  detail: (id: string) => [...maintenanceKeys.details(), id] as const,
}

export const maintenanceForPropertyQueryOptions = (propertyId: string) =>
  queryOptions({
    queryKey: maintenanceKeys.listByProperty(propertyId),
    queryFn: () => fetchMaintenanceTasksForProperty({ data: { propertyId } }),
  })

export const maintenanceForItemQueryOptions = (itemId: string) =>
  queryOptions({
    queryKey: maintenanceKeys.listByItem(itemId),
    queryFn: () => fetchMaintenanceTasksForItem({ data: { itemId } }),
  })

export const upcomingMaintenanceQueryOptions = (userId: string) =>
  queryOptions({
    queryKey: maintenanceKeys.upcoming(),
    queryFn: () => fetchUpcomingMaintenanceTasks({ data: { userId } }),
  })

export const maintenanceTaskQueryOptions = (id: string) =>
  queryOptions({
    queryKey: maintenanceKeys.detail(id),
    queryFn: () => fetchMaintenanceTask({ data: { id } }),
  })

export function useMaintenanceForProperty(propertyId: string | undefined) {
  return useQuery({
    ...maintenanceForPropertyQueryOptions(propertyId ?? ''),
    enabled: !!propertyId,
  })
}

export function useMaintenanceForItem(itemId: string | undefined) {
  return useQuery({
    ...maintenanceForItemQueryOptions(itemId ?? ''),
    enabled: !!itemId,
  })
}

export function useUpcomingMaintenance(userId: string | undefined) {
  return useQuery({
    ...upcomingMaintenanceQueryOptions(userId ?? ''),
    enabled: !!userId,
  })
}
