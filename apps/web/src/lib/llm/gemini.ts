import { consoleLogger as logger } from '@/lib/console-logger'
import { getServerEnv } from '@/lib/env'

const GEMINI_API_URL =
  'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

const EXTRACTION_SYSTEM_PROMPT = `You are an expert at extracting structured information from home-related documents. Analyze images of equipment plates, receipts, manuals, warranties, invoices, and product photos.

Document types to identify:
- equipment_plate: Manufacturer labels, serial number stickers, data plates
- receipt: Purchase receipts, sales slips
- manual: Product manuals, user guides, installation instructions
- warranty: Warranty cards, certificates, extended warranty documents
- invoice: Service invoices, bills
- product_photo: General photos of equipment/appliances
- other: Documents that don't fit other categories

Categories for home items:
- hvac: Heating, ventilation, air conditioning, furnaces, heat pumps
- plumbing: Water heaters, pipes, fixtures, water treatment
- electrical: Panels, wiring, generators, solar
- appliance: Kitchen appliances, laundry, etc.
- structure: Roof, foundation, walls, insulation
- tool: Power tools, hand tools, equipment
- fixture: Lighting, faucets, hardware
- other: Anything else`

const EXTRACTION_USER_PROMPT = `Analyze this image of home-related documentation.

Extract all visible information and return JSON only (no markdown):
{
  "documentType": "equipment_plate|receipt|manual|warranty|invoice|product_photo|other",
  "confidence": 0.0-1.0,
  "rawText": "all visible text from the document",
  "extracted": {
    "manufacturer": "string or null",
    "model": "string or null",
    "serialNumber": "string or null",
    "productName": "string or null",
    "date": "YYYY-MM-DD or null",
    "price": "number or null",
    "vendor": "string or null",
    "warrantyExpires": "YYYY-MM-DD or null",
    "specs": {}
  },
  "suggestedItemName": "descriptive name for the item",
  "suggestedCategory": "hvac|plumbing|electrical|appliance|structure|tool|fixture|other"
}`

export interface GeminiExtractionResult {
  documentType: string
  confidence: number
  rawText: string
  extracted: {
    manufacturer: string | null
    model: string | null
    serialNumber: string | null
    productName: string | null
    date: string | null
    price: number | null
    vendor: string | null
    warrantyExpires: string | null
    specs: Record<string, unknown>
  }
  suggestedItemName: string
  suggestedCategory: string
}

interface GeminiResponse {
  candidates?: Array<{
    content: {
      parts: Array<{ text?: string }>
    }
  }>
  error?: {
    code: number
    message: string
    status: string
  }
}

export async function extractWithGemini(
  imageBase64: string,
  mimeType: string,
): Promise<GeminiExtractionResult> {
  const env = getServerEnv()

  if (!env.GEMINI_API_KEY) {
    throw new Error('GEMINI_API_KEY not configured')
  }

  // Gemini doesn't support HEIC directly
  const effectiveMimeType = mimeType === 'image/heic' ? 'image/jpeg' : mimeType

  logger.info('Calling Gemini API for extraction')

  const response = await fetch(`${GEMINI_API_URL}?key=${env.GEMINI_API_KEY}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      systemInstruction: {
        parts: [{ text: EXTRACTION_SYSTEM_PROMPT }],
      },
      contents: [
        {
          parts: [
            {
              inlineData: {
                mimeType: effectiveMimeType,
                data: imageBase64,
              },
            },
            {
              text: EXTRACTION_USER_PROMPT,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.1,
        maxOutputTokens: 4096,
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

  // Extract text from response
  let textResponse = ''
  for (const part of geminiResponse.candidates[0].content.parts) {
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

  const result = JSON.parse(jsonStr.trim()) as GeminiExtractionResult

  logger.info('Gemini extraction complete', {
    documentType: result.documentType,
    confidence: result.confidence,
    suggestedCategory: result.suggestedCategory,
  })

  return result
}
