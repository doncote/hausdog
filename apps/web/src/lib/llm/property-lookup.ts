import { getServerEnv } from '@/lib/env'
import { consoleLogger as logger } from '@/lib/console-logger'

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent'

const PROPERTY_LOOKUP_PROMPT = `Find property details for this address. Search for publicly available real estate information.

Address: {address}

Return JSON only (no markdown):
{
  "found": true or false,
  "normalizedAddress": "full normalized address or null",
  "yearBuilt": number or null,
  "squareFeet": number or null,
  "lotSquareFeet": number or null,
  "bedrooms": number or null,
  "bathrooms": number or null,
  "propertyType": "single_family|condo|townhouse|multi_family|manufactured|land|other" or null,
  "stories": number or null,
  "lastSaleDate": "YYYY-MM-DD or null (most recent sale date)",
  "lastSalePrice": number or null (most recent sale price in dollars),
  "estimatedValue": number or null (current estimated market value in dollars),
  "source": "primary source of the data"
}

If you cannot find reliable property data, set found to false and other fields to null.`

export interface PropertyLookupResult {
  found: boolean
  normalizedAddress: string | null
  yearBuilt: number | null
  squareFeet: number | null
  lotSquareFeet: number | null
  bedrooms: number | null
  bathrooms: number | null
  propertyType: string | null
  stories: number | null
  lastSaleDate: string | null
  lastSalePrice: number | null
  estimatedValue: number | null
  source: string | null
}

export interface PropertyLookupRaw extends PropertyLookupResult {
  groundingSources: Array<{ uri: string; title: string }>
  searchEntryPoint?: string
}

export interface PropertyLookupResponse {
  result: PropertyLookupResult
  raw: PropertyLookupRaw
  groundingSources: Array<{ uri: string; title: string }>
}

interface GeminiResponse {
  candidates?: Array<{
    content: {
      parts: Array<{ text?: string }>
    }
    groundingMetadata?: {
      groundingChunks?: Array<{
        web?: { uri: string; title: string }
      }>
      searchEntryPoint?: {
        renderedContent: string
      }
    }
  }>
  error?: {
    code: number
    message: string
    status: string
  }
}

export async function lookupPropertyWithGemini(address: string): Promise<PropertyLookupResponse> {
  const env = getServerEnv()

  if (!env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured')
  }

  const prompt = PROPERTY_LOOKUP_PROMPT.replace('{address}', address)

  logger.info('Looking up property data with Gemini', { address })

  const response = await fetch(`${GEMINI_API_URL}?key=${env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          parts: [{ text: prompt }],
        },
      ],
      tools: [{ googleSearch: {} }],
      generationConfig: {
        temperature: 1.0, // Recommended for search grounding
        maxOutputTokens: 1024,
      },
    }),
  })

  if (!response.ok) {
    const errorText = await response.text()
    logger.error('Gemini API error', { status: response.status, error: errorText })
    throw new Error(`Gemini API error: ${response.status} - ${errorText}`)
  }

  const geminiResponse: GeminiResponse = await response.json()

  if (geminiResponse.error) {
    logger.error('Gemini API returned error', { error: geminiResponse.error })
    throw new Error(`Gemini API error: ${geminiResponse.error.message}`)
  }

  if (!geminiResponse.candidates || geminiResponse.candidates.length === 0) {
    throw new Error('No response from Gemini')
  }

  const candidate = geminiResponse.candidates[0]

  // Extract text from response
  let textResponse = ''
  for (const part of candidate.content.parts) {
    if (part.text) {
      textResponse += part.text
    }
  }

  // Parse JSON from response (handle markdown code blocks)
  let jsonStr = textResponse
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (jsonMatch) {
    jsonStr = jsonMatch[1]
  }

  let result: PropertyLookupResult
  try {
    result = JSON.parse(jsonStr.trim()) as PropertyLookupResult
  } catch {
    logger.warn('Failed to parse property lookup response', { response: textResponse })
    result = {
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
  }

  // Extract grounding sources
  const groundingSources: Array<{ uri: string; title: string }> = []
  if (candidate.groundingMetadata?.groundingChunks) {
    for (const chunk of candidate.groundingMetadata.groundingChunks) {
      if (chunk.web) {
        groundingSources.push({
          uri: chunk.web.uri,
          title: chunk.web.title,
        })
      }
    }
  }

  logger.info('Property lookup complete', {
    address,
    found: result.found,
    yearBuilt: result.yearBuilt,
    squareFeet: result.squareFeet,
    sourcesCount: groundingSources.length,
  })

  const raw: PropertyLookupRaw = {
    ...result,
    groundingSources,
    searchEntryPoint: candidate.groundingMetadata?.searchEntryPoint?.renderedContent,
  }

  return {
    result,
    raw,
    groundingSources,
  }
}
