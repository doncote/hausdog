import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/env', () => ({
  getServerEnv: () => ({ GEMINI_API_KEY: 'test-gemini-key' }),
}))

vi.mock('@/lib/console-logger', () => ({
  consoleLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

// Mock global fetch
const mockFetch = vi.fn()
vi.stubGlobal('fetch', mockFetch)

import { extractWithGemini } from './gemini'

function makeGeminiOkResponse(text: string) {
  return {
    ok: true,
    json: async () => ({
      candidates: [
        {
          content: { parts: [{ text }] },
        },
      ],
    }),
  }
}

function makeGeminiErrorResponse(status: number, body: string) {
  return {
    ok: false,
    status,
    text: async () => body,
  }
}

const validExtraction = {
  documentType: 'receipt',
  confidence: 0.92,
  rawText: 'Carrier HVAC receipt...',
  extracted: {
    manufacturer: 'Carrier',
    model: '24ACC636',
    serialNumber: 'SN-12345',
    productName: 'Central Air Conditioner',
    date: '2024-01-15',
    price: 3500,
    vendor: 'HVAC Plus',
    warrantyExpires: '2029-01-15',
    specs: {},
  },
  suggestedItemName: 'Carrier Central Air Conditioner',
  suggestedDescription: 'Central AC unit, 3-ton capacity',
  suggestedCategory: 'hvac',
}

beforeEach(() => {
  vi.clearAllMocks()
})

describe('extractWithGemini', () => {
  it('returns parsed extraction result from valid JSON response', async () => {
    mockFetch.mockResolvedValue(makeGeminiOkResponse(JSON.stringify(validExtraction)))

    const result = await extractWithGemini('base64data', 'image/jpeg')

    expect(result.documentType).toBe('receipt')
    expect(result.confidence).toBe(0.92)
    expect(result.extracted.manufacturer).toBe('Carrier')
    expect(result.suggestedCategory).toBe('hvac')
  })

  it('strips markdown code block before parsing', async () => {
    const wrapped = `\`\`\`json\n${JSON.stringify(validExtraction)}\n\`\`\``
    mockFetch.mockResolvedValue(makeGeminiOkResponse(wrapped))

    const result = await extractWithGemini('base64data', 'application/pdf')

    expect(result.documentType).toBe('receipt')
  })

  it('concatenates multiple text parts from response', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        candidates: [
          {
            content: {
              parts: [
                { text: JSON.stringify(validExtraction).slice(0, 50) },
                { text: JSON.stringify(validExtraction).slice(50) },
              ],
            },
          },
        ],
      }),
    })

    // The two halves concatenated form valid JSON
    const result = await extractWithGemini('base64data', 'image/jpeg')

    expect(result).toBeDefined()
  })

  it('throws when Gemini API returns HTTP error', async () => {
    mockFetch.mockResolvedValue(makeGeminiErrorResponse(429, 'Rate limit exceeded'))

    await expect(extractWithGemini('base64data', 'image/jpeg')).rejects.toThrow(
      'Gemini API error: 429',
    )
  })

  it('throws when Gemini returns error in response body', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        error: { code: 400, message: 'Invalid image data', status: 'INVALID_ARGUMENT' },
      }),
    })

    await expect(extractWithGemini('bad-base64', 'image/jpeg')).rejects.toThrow(
      'Gemini API error: Invalid image data',
    )
  })

  it('throws when Gemini returns no candidates', async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({ candidates: [] }),
    })

    await expect(extractWithGemini('base64data', 'image/jpeg')).rejects.toThrow(
      'No response from Gemini',
    )
  })

  it('throws descriptive error when response text is not valid JSON', async () => {
    mockFetch.mockResolvedValue(makeGeminiOkResponse('I cannot analyze this image.'))

    await expect(extractWithGemini('base64data', 'image/jpeg')).rejects.toThrow(
      /Failed to parse Gemini extraction response as JSON/,
    )
  })

  it('remaps HEIC mime type to JPEG for Gemini', async () => {
    mockFetch.mockResolvedValue(makeGeminiOkResponse(JSON.stringify(validExtraction)))

    await extractWithGemini('base64data', 'image/heic')

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(callBody.contents[0].parts[0].inlineData.mimeType).toBe('image/jpeg')
  })

  it('preserves non-HEIC mime types unchanged', async () => {
    mockFetch.mockResolvedValue(makeGeminiOkResponse(JSON.stringify(validExtraction)))

    await extractWithGemini('base64data', 'application/pdf')

    const callBody = JSON.parse(mockFetch.mock.calls[0][1].body)
    expect(callBody.contents[0].parts[0].inlineData.mimeType).toBe('application/pdf')
  })
})
