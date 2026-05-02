import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/env', () => ({
  getServerEnv: () => ({ GEMINI_API_KEY: 'test-key' }),
}))

vi.mock('@/lib/console-logger', () => ({
  consoleLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { lookupPropertyWithGemini } from './property-lookup'

const validResult = {
  found: true,
  normalizedAddress: '123 Main St, Springfield, CA 90210',
  yearBuilt: 1990,
  squareFeet: 2000,
  lotSquareFeet: 5000,
  bedrooms: 3,
  bathrooms: 2.5,
  propertyType: 'single_family',
  stories: 2,
  lastSaleDate: '2020-06-15',
  lastSalePrice: 650000,
  estimatedValue: 750000,
  source: 'Zillow',
}

function makeOkResponse(
  text: string,
  groundingChunks?: Array<{ web?: { uri: string; title: string } }>,
) {
  return {
    ok: true,
    json: async () => ({
      candidates: [
        {
          content: { parts: [{ text }] },
          groundingMetadata: groundingChunks ? { groundingChunks } : undefined,
        },
      ],
    }),
  }
}

function makeErrorHttpResponse(status: number, body: string) {
  return {
    ok: false,
    status,
    text: async () => body,
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('lookupPropertyWithGemini', () => {
  describe('HTTP errors', () => {
    it('throws when API response is not ok', async () => {
      mockFetch.mockResolvedValue(makeErrorHttpResponse(500, 'Internal Server Error'))

      await expect(lookupPropertyWithGemini('123 Main St')).rejects.toThrow('Gemini API error: 500')
    })
  })

  describe('API-level errors', () => {
    it('throws when Gemini returns an error object', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          error: { code: 400, message: 'Bad request', status: 'INVALID_ARGUMENT' },
        }),
      })

      await expect(lookupPropertyWithGemini('123 Main St')).rejects.toThrow(
        'Gemini API error: Bad request',
      )
    })

    it('throws when no candidates returned', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ candidates: [] }),
      })

      await expect(lookupPropertyWithGemini('123 Main St')).rejects.toThrow(
        'No response from Gemini',
      )
    })
  })

  describe('successful response parsing', () => {
    it('parses plain JSON response', async () => {
      mockFetch.mockResolvedValue(makeOkResponse(JSON.stringify(validResult)))

      const response = await lookupPropertyWithGemini('123 Main St')

      expect(response.result.found).toBe(true)
      expect(response.result.yearBuilt).toBe(1990)
      expect(response.result.squareFeet).toBe(2000)
      expect(response.result.estimatedValue).toBe(750000)
    })

    it('parses JSON wrapped in markdown json code block', async () => {
      const markdown = `\`\`\`json\n${JSON.stringify(validResult)}\n\`\`\``
      mockFetch.mockResolvedValue(makeOkResponse(markdown))

      const response = await lookupPropertyWithGemini('123 Main St')

      expect(response.result.found).toBe(true)
      expect(response.result.normalizedAddress).toBe('123 Main St, Springfield, CA 90210')
    })

    it('parses JSON wrapped in plain code block (no language)', async () => {
      const markdown = `\`\`\`\n${JSON.stringify(validResult)}\n\`\`\``
      mockFetch.mockResolvedValue(makeOkResponse(markdown))

      const response = await lookupPropertyWithGemini('123 Main St')

      expect(response.result.yearBuilt).toBe(1990)
    })

    it('falls back to not-found result on JSON parse failure', async () => {
      mockFetch.mockResolvedValue(makeOkResponse('This is not valid JSON at all'))

      const response = await lookupPropertyWithGemini('123 Main St')

      expect(response.result.found).toBe(false)
      expect(response.result.yearBuilt).toBeNull()
      expect(response.result.estimatedValue).toBeNull()
    })
  })

  describe('grounding sources', () => {
    it('extracts grounding sources from groundingChunks', async () => {
      const chunks = [
        { web: { uri: 'https://zillow.com/prop', title: 'Zillow Listing' } },
        { web: { uri: 'https://redfin.com/prop', title: 'Redfin Listing' } },
      ]
      mockFetch.mockResolvedValue(makeOkResponse(JSON.stringify(validResult), chunks))

      const response = await lookupPropertyWithGemini('123 Main St')

      expect(response.groundingSources).toHaveLength(2)
      expect(response.groundingSources[0]?.uri).toBe('https://zillow.com/prop')
      expect(response.groundingSources[1]?.title).toBe('Redfin Listing')
    })

    it('ignores chunks without web data', async () => {
      const chunks = [{ web: { uri: 'https://zillow.com/prop', title: 'Zillow' } }, {}]
      mockFetch.mockResolvedValue(makeOkResponse(JSON.stringify(validResult), chunks))

      const response = await lookupPropertyWithGemini('123 Main St')

      expect(response.groundingSources).toHaveLength(1)
    })

    it('returns empty grounding sources when no groundingMetadata', async () => {
      mockFetch.mockResolvedValue(makeOkResponse(JSON.stringify(validResult)))

      const response = await lookupPropertyWithGemini('123 Main St')

      expect(response.groundingSources).toEqual([])
    })
  })

  describe('response shape', () => {
    it('returns result, raw, and groundingSources', async () => {
      mockFetch.mockResolvedValue(makeOkResponse(JSON.stringify(validResult)))

      const response = await lookupPropertyWithGemini('123 Main St')

      expect(response).toHaveProperty('result')
      expect(response).toHaveProperty('raw')
      expect(response).toHaveProperty('groundingSources')
      expect(response.raw).toMatchObject(response.result)
    })
  })
})
