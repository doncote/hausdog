import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { consoleLogger as logger } from '@/lib/console-logger'
import { prisma } from '@/lib/db/client'
import type { PropertyLookupResponse } from '@/lib/llm/property-lookup'
import { lookupPropertyWithGemini } from '@/lib/llm/property-lookup'
import { PropertyService } from './service'
import type { CreatePropertyInput, UpdatePropertyInput } from './types'

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
