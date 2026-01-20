import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { createServerFn } from '@tanstack/react-start'
import { prisma } from '@/lib/db/client'
import type { CreatePropertyInput, UpdatePropertyInput } from '@/lib/domain/property'
import { logger } from '@/lib/logger'
import { PropertyService } from '@/lib/services/property.service'

// ---------------------------------------------------------------------------
// Server Functions
// ---------------------------------------------------------------------------

const getPropertyService = () => new PropertyService({ db: prisma, logger })

export const fetchProperties = createServerFn({ method: 'GET' })
  .inputValidator((d: string) => d)
  .handler(async ({ data: userId }) => {
    const service = getPropertyService()
    return service.findAllForUserWithCounts(userId)
  })

export const fetchProperty = createServerFn({ method: 'GET' })
  .inputValidator((d: { id: string; userId: string }) => d)
  .handler(async ({ data }) => {
    const service = getPropertyService()
    return service.findById(data.id, data.userId)
  })

export const createProperty = createServerFn({ method: 'POST' })
  .inputValidator((d: { userId: string; input: CreatePropertyInput }) => d)
  .handler(async ({ data }) => {
    const service = getPropertyService()
    return service.create(data.userId, data.input)
  })

export const updateProperty = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string; userId: string; input: UpdatePropertyInput }) => d)
  .handler(async ({ data }) => {
    const service = getPropertyService()
    return service.update(data.id, data.userId, data.input)
  })

export const deleteProperty = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string; userId: string }) => d)
  .handler(async ({ data }) => {
    const service = getPropertyService()
    await service.delete(data.id, data.userId)
    return { success: true }
  })

// ---------------------------------------------------------------------------
// Query Keys
// ---------------------------------------------------------------------------

export const propertyKeys = {
  all: ['properties'] as const,
  lists: () => [...propertyKeys.all, 'list'] as const,
  list: (userId: string) => [...propertyKeys.lists(), userId] as const,
  details: () => [...propertyKeys.all, 'detail'] as const,
  detail: (id: string) => [...propertyKeys.details(), id] as const,
}

// ---------------------------------------------------------------------------
// Query Hooks
// ---------------------------------------------------------------------------

export function useProperties(userId: string | undefined) {
  return useQuery({
    queryKey: propertyKeys.list(userId ?? ''),
    queryFn: () => fetchProperties({ data: userId ?? '' }),
    enabled: !!userId,
  })
}

export function useProperty(id: string, userId: string | undefined) {
  return useQuery({
    queryKey: propertyKeys.detail(id),
    queryFn: () => fetchProperty({ data: { id, userId: userId ?? '' } }),
    enabled: !!userId && !!id,
  })
}

// ---------------------------------------------------------------------------
// Mutation Hooks
// ---------------------------------------------------------------------------

export function useCreateProperty() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { userId: string; input: CreatePropertyInput }) =>
      createProperty({ data: input }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: propertyKeys.list(variables.userId) })
    },
  })
}

export function useUpdateProperty() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { id: string; userId: string; input: UpdatePropertyInput }) =>
      updateProperty({ data: input }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: propertyKeys.list(variables.userId) })
      queryClient.invalidateQueries({ queryKey: propertyKeys.detail(variables.id) })
    },
  })
}

export function useDeleteProperty() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { id: string; userId: string }) => deleteProperty({ data: input }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: propertyKeys.list(variables.userId) })
      queryClient.removeQueries({ queryKey: propertyKeys.detail(variables.id) })
    },
  })
}
