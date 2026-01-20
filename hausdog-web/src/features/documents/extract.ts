import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import { getServerEnv } from '@/lib/env.server'
import { prisma } from '@/lib/db/client'
import { logger } from '@/lib/logger'
import { DocumentService } from './service'
import type { ExtractedData } from '@hausdog/domain/documents'

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent'

const SYSTEM_PROMPT = `You are an expert at extracting structured information from home-related documents. Your task is to analyze documents (receipts, invoices, manuals, warranty cards, service records, equipment photos, permits, inspections) and extract relevant information in a structured JSON format.

Be thorough but only include fields that you can confidently extract from the document. For dates, use ISO 8601 format (YYYY-MM-DD). For currency amounts, extract just the numeric value.

Document types to identify:
- manual: Product manuals, user guides, installation instructions
- receipt: Purchase receipts, sales slips
- invoice: Service invoices, bills
- warranty: Warranty cards, certificates, extended warranty documents
- permit: Building permits, installation permits
- inspection: Inspection reports, certificates
- service_record: Maintenance logs, service records
- photo: Photos of equipment, data plates, serial numbers
- other: Documents that don't fit other categories

Categories for home systems:
- HVAC: Heating, ventilation, air conditioning, furnaces, heat pumps
- Plumbing: Water heaters, pipes, fixtures, water treatment
- Electrical: Panels, wiring, generators, solar
- Appliances: Kitchen appliances, laundry, etc.
- Roofing: Roof, gutters, skylights
- Exterior: Siding, windows, doors, decks
- Interior: Flooring, paint, fixtures
- Landscaping: Irrigation, outdoor equipment
- Security: Alarms, cameras, locks
- Other: Anything else`

const USER_PROMPT = `Please analyze this document and extract all relevant information. Return your response as a JSON object with the following structure:

{
  "documentType": "receipt|invoice|manual|warranty|permit|inspection|service_record|photo|other",
  "confidence": 0.95,
  "equipment": {
    "manufacturer": "Brand name",
    "model": "Model number",
    "serialNumber": "Serial number",
    "capacity": "Size/capacity if applicable"
  },
  "financial": {
    "vendor": "Store or company name",
    "amount": 123.45,
    "currency": "USD",
    "invoiceNumber": "Invoice/order number"
  },
  "service": {
    "serviceType": "installation|repair|maintenance|inspection",
    "provider": "Company name",
    "workPerformed": "Description of work"
  },
  "warranty": {
    "warrantyType": "manufacturer|extended|labor",
    "coverageStart": "YYYY-MM-DD",
    "coverageEnd": "YYYY-MM-DD",
    "provider": "Warranty provider",
    "policyNumber": "Policy/warranty number"
  },
  "suggestedCategory": "HVAC|Plumbing|Electrical|Appliances|Roofing|Exterior|Interior|Landscaping|Security|Other",
  "rawText": "Key text content for searchability"
}

Only include fields that you can extract from the document. Omit fields that aren't present or can't be determined. Return ONLY valid JSON, no markdown.`

interface ExtractInput {
  documentId: string
  userId: string
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

export const extractDocument = createServerFn({ method: 'POST' })
  .inputValidator((d: ExtractInput) => d)
  .handler(async ({ data }) => {
    const env = getServerEnv()

    if (!env.GEMINI_API_KEY) {
      throw new Error('GEMINI_API_KEY not configured')
    }

    const service = new DocumentService({ db: prisma, logger })

    // Get the document
    const document = await service.findById(data.documentId, data.userId)
    if (!document) {
      throw new Error('Document not found')
    }

    // Update status to processing
    await service.updateStatus(data.documentId, data.userId, 'processing')

    try {
      // Get file from Supabase Storage
      const supabaseServiceKey = env.SUPABASE_SERVICE_KEY || env.SUPABASE_KEY
      const supabase = createClient(env.SUPABASE_URL, supabaseServiceKey)

      const { data: fileData, error: downloadError } = await supabase.storage
        .from('documents')
        .download(document.storagePath)

      if (downloadError || !fileData) {
        throw new Error(`Failed to download file: ${downloadError?.message}`)
      }

      // Convert to base64
      const arrayBuffer = await fileData.arrayBuffer()
      const base64Data = Buffer.from(arrayBuffer).toString('base64')

      // Determine MIME type for Gemini
      let mimeType = document.contentType
      if (mimeType === 'image/heic') {
        mimeType = 'image/jpeg' // Gemini doesn't support HEIC directly
      }

      logger.info('Calling Gemini API for extraction', { documentId: document.id })

      // Call Gemini API
      const response = await fetch(`${GEMINI_API_URL}?key=${env.GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          systemInstruction: {
            parts: [{ text: SYSTEM_PROMPT }],
          },
          contents: [
            {
              parts: [
                {
                  inlineData: {
                    mimeType,
                    data: base64Data,
                  },
                },
                {
                  text: USER_PROMPT,
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
        throw new Error(`Gemini API error: ${response.status} - ${errorText}`)
      }

      const geminiResponse: GeminiResponse = await response.json()

      if (geminiResponse.error) {
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

      const extractedData = JSON.parse(jsonStr.trim()) as ExtractedData

      logger.info('Extraction complete', {
        documentId: document.id,
        documentType: extractedData.documentType,
        confidence: extractedData.confidence,
      })

      // Update document with extracted data
      const updatedDocument = await service.updateExtractedData(
        data.documentId,
        data.userId,
        extractedData
      )

      return updatedDocument
    } catch (error) {
      logger.error('Extraction failed', {
        documentId: document.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      })

      // Update status to failed
      await service.updateStatus(
        data.documentId,
        data.userId,
        'failed',
        document.retryCount + 1
      )

      throw error
    }
  })
