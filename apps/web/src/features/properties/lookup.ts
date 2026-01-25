import { createServerFn } from '@tanstack/react-start'
import { z } from 'zod'
import { lookupPropertyWithGemini, type PropertyLookupResponse } from '@/lib/llm/property-lookup'
import { logger } from '@/lib/logger'

const LookupPropertyInput = z.object({
  address: z.string().min(1, 'Address is required'),
})

export type LookupPropertyInput = z.infer<typeof LookupPropertyInput>

export type { PropertyLookupResponse }

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
