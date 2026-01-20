import { createServerFn } from '@tanstack/react-start'
import { createClient } from '@supabase/supabase-js'
import Anthropic from '@anthropic-ai/sdk'
import { getServerEnv } from '@/lib/env.server'
import { prisma } from '@/lib/db/client'
import { logger } from '@/lib/logger'
import { DocumentService } from './service'
import type { ExtractedData } from '@hausdog/domain/documents'

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
  "document_type": "receipt|invoice|manual|warranty|permit|inspection|service_record|photo|other",
  "confidence": 0.95,
  "title": "Brief descriptive title",
  "date": "YYYY-MM-DD",
  "description": "Brief description of what this document is",
  "equipment": {
    "manufacturer": "Brand name",
    "model": "Model number",
    "serial_number": "Serial number",
    "capacity": "Size/capacity if applicable"
  },
  "financial": {
    "vendor": "Store or company name",
    "amount": 123.45,
    "currency": "USD",
    "invoice_number": "Invoice/order number"
  },
  "service": {
    "service_type": "installation|repair|maintenance|inspection",
    "provider": "Company name",
    "work_performed": "Description of work"
  },
  "warranty": {
    "warranty_type": "manufacturer|extended|labor",
    "coverage": "What's covered",
    "start_date": "YYYY-MM-DD",
    "end_date": "YYYY-MM-DD",
    "provider": "Warranty provider",
    "policy_number": "Policy/warranty number"
  },
  "suggested_category": "HVAC|Plumbing|Electrical|Appliances|Roofing|Exterior|Interior|Landscaping|Security|Other",
  "raw_text": "Key text content for searchability",
  "notes": "Any additional relevant observations"
}

Only include fields that you can extract from the document. Omit fields that aren't present or can't be determined.`

interface ExtractInput {
  documentId: string
  userId: string
}

export const extractDocument = createServerFn({ method: 'POST' })
  .inputValidator((d: ExtractInput) => d)
  .handler(async ({ data }) => {
    const env = getServerEnv()

    if (!env.CLAUDE_API_KEY) {
      throw new Error('CLAUDE_API_KEY not configured')
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
      // Get signed URL for the file
      const supabaseServiceKey = env.SUPABASE_SERVICE_KEY || env.SUPABASE_KEY
      const supabase = createClient(env.SUPABASE_URL, supabaseServiceKey)

      // Download the file
      const { data: fileData, error: downloadError } = await supabase.storage
        .from('documents')
        .download(document.storagePath)

      if (downloadError || !fileData) {
        throw new Error(`Failed to download file: ${downloadError?.message}`)
      }

      // Convert to base64
      const arrayBuffer = await fileData.arrayBuffer()
      const base64Data = Buffer.from(arrayBuffer).toString('base64')

      // Determine media type for Claude
      let mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp' = 'image/jpeg'
      if (document.contentType === 'image/png') mediaType = 'image/png'
      else if (document.contentType === 'image/gif') mediaType = 'image/gif'
      else if (document.contentType === 'image/webp') mediaType = 'image/webp'

      logger.info('Calling Claude API for extraction', { documentId: document.id })

      // Call Claude API
      const anthropic = new Anthropic({ apiKey: env.CLAUDE_API_KEY })

      const message = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 4096,
        system: SYSTEM_PROMPT,
        messages: [
          {
            role: 'user',
            content: [
              {
                type: 'image',
                source: {
                  type: 'base64',
                  media_type: mediaType,
                  data: base64Data,
                },
              },
              {
                type: 'text',
                text: USER_PROMPT,
              },
            ],
          },
        ],
      })

      // Extract the text response
      const textContent = message.content.find((c) => c.type === 'text')
      if (!textContent || textContent.type !== 'text') {
        throw new Error('No text response from Claude')
      }

      // Parse JSON from response (handle markdown code blocks)
      let jsonStr = textContent.text
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
