import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { consoleLogger as logger } from '@/lib/console-logger'
import { prisma } from '@/lib/db/client'
import type { PropertyLookupResponse } from '@/lib/llm/property-lookup'
import { lookupPropertyWithGemini } from '@/lib/llm/property-lookup'
import { getSafeSession } from '@/lib/supabase'
import { PropertyService } from './service'
import type { CreatePropertyInput, UpdatePropertyInput } from './types'

const getPropertyService = () => new PropertyService({ db: prisma, logger })

export const fetchProperties = createServerFn({ method: 'GET' })
  .inputValidator((d: Record<string, never>) => d)
  .handler(async () => {
    const { user } = await getSafeSession()
    if (!user) throw new Error('Unauthorized')
    const service = getPropertyService()
    return service.findAllForUserWithCounts(user.id)
  })

export const fetchProperty = createServerFn({ method: 'GET' })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const { user } = await getSafeSession()
    if (!user) throw new Error('Unauthorized')
    const service = getPropertyService()
    return service.findById(data.id, user.id)
  })

export const createProperty = createServerFn({ method: 'POST' })
  .inputValidator((d: { input: CreatePropertyInput }) => d)
  .handler(async ({ data }) => {
    const { user } = await getSafeSession()
    if (!user) throw new Error('Unauthorized')
    const service = getPropertyService()
    return service.create(user.id, data.input)
  })

export const updateProperty = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string; input: UpdatePropertyInput }) => d)
  .handler(async ({ data }) => {
    const { user } = await getSafeSession()
    if (!user) throw new Error('Unauthorized')
    const service = getPropertyService()
    return service.update(data.id, user.id, data.input)
  })

export const deleteProperty = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const { user } = await getSafeSession()
    if (!user) throw new Error('Unauthorized')
    const service = getPropertyService()
    await service.delete(data.id, user.id)
    return { success: true }
  })

const LookupPropertyInput = z.object({
  address: z.string().min(1, 'Address is required'),
})

export type LookupPropertyInput = z.infer<typeof LookupPropertyInput>

/**
 * Look up property data using Gemini with Google Search grounding.
 * Returns structured property information and raw lookup data.
 */
export const lookupPropertyData = createServerFn({ method: 'POST' })
  .inputValidator((d: LookupPropertyInput) => LookupPropertyInput.parse(d))
  .handler(async ({ data }): Promise<PropertyLookupResponse> => {
    logger.info('Property lookup requested', { address: data.address })

    try {
      const response = await lookupPropertyWithGemini(data.address)
      return response
    } catch (error) {
      logger.error('Property lookup failed', {
        address: data.address,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      // Return empty result on failure
      const emptyResult = {
        found: false,
        normalizedAddress: null,
        yearBuilt: null,
        squareFeet: null,
        lotSquareFeet: null,
        bedrooms: null,
        bathrooms: null,
        propertyType: null,
        stories: null,
        lastSaleDate: null,
        lastSalePrice: null,
        estimatedValue: null,
        source: null,
      }
      return {
        result: emptyResult,
        raw: { ...emptyResult, groundingSources: [] },
        groundingSources: [],
      }
    }
  })
