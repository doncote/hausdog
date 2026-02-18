import Anthropic from '@anthropic-ai/sdk'
import { getServerEnv } from '@/lib/env'
import { consoleLogger as logger } from '@/lib/console-logger'
import type { GeminiExtractionResult } from './gemini'

let anthropicClient: Anthropic | null = null

function getAnthropicClient(): Anthropic {
  if (!anthropicClient) {
    const env = getServerEnv()
    if (!env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY not configured')
    }
    anthropicClient = new Anthropic({
      apiKey: env.ANTHROPIC_API_KEY,
    })
  }
  return anthropicClient
}

// --- Resolution ---

export interface InventoryItem {
  id: string
  name: string
  manufacturer: string | null
  model: string | null
  category: string
}

export interface ResolutionResult {
  action: 'NEW_ITEM' | 'ATTACH_TO_ITEM' | 'CHILD_OF_ITEM'
  matchedItemId: string | null
  confidence: number
  reasoning: string
  suggestedEventType: string | null
}

const RESOLUTION_SYSTEM_PROMPT = `You are helping organize a home inventory. Given extraction data from a document and the user's existing inventory, determine how to handle this document.

Actions:
1. NEW_ITEM - This document is for equipment not currently in the inventory. Create a new item.
2. ATTACH_TO_ITEM - This document relates to an existing item (e.g., receipt, manual, warranty photo for something already tracked).
3. CHILD_OF_ITEM - This document is for a component of an existing item (e.g., a filter for a furnace, a bulb for a fixture).

Consider manufacturer, model, serial number, and product name matches. Be conservative - only match to existing items when confident.

Return JSON only (no markdown):
{
  "action": "NEW_ITEM|ATTACH_TO_ITEM|CHILD_OF_ITEM",
  "matchedItemId": "uuid or null",
  "confidence": 0.0-1.0,
  "reasoning": "brief explanation of your decision",
  "suggestedEventType": "installation|maintenance|repair|inspection|replacement|observation or null"
}`

export async function resolveWithClaude(
  extractedData: GeminiExtractionResult,
  inventory: InventoryItem[],
): Promise<ResolutionResult> {
  const client = getAnthropicClient()

  const userPrompt = `EXISTING INVENTORY:
${JSON.stringify(inventory, null, 2)}

EXTRACTED FROM NEW DOCUMENT:
${JSON.stringify(extractedData, null, 2)}

Determine how to handle this document.`

  logger.info('Calling Claude for resolution', {
    inventoryCount: inventory.length,
    documentType: extractedData.documentType,
  })

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1024,
    system: RESOLUTION_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: userPrompt }],
  })

  const textContent = response.content.find((c) => c.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude')
  }

  // Parse JSON from response
  let jsonStr = textContent.text
  const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (jsonMatch) {
    jsonStr = jsonMatch[1]
  }

  const result = JSON.parse(jsonStr.trim()) as ResolutionResult

  logger.info('Claude resolution complete', {
    action: result.action,
    confidence: result.confidence,
    matchedItemId: result.matchedItemId,
  })

  return result
}

// --- Chat ---

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

export interface PropertyContext {
  name: string
  address: string | null
  yearBuilt: number | null
  propertyType: string | null
}

export interface ItemContext {
  id: string
  name: string
  category: string
  manufacturer: string | null
  model: string | null
  serialNumber: string | null
  acquiredDate: Date | null
  notes: string | null
  recentEvents?: Array<{
    type: string
    date: Date
    description: string | null
  }>
}

function buildChatSystemPrompt(property: PropertyContext, relevantItems: ItemContext[]): string {
  const itemsContext = relevantItems
    .map((item) => {
      let text = `- ${item.name} (${item.category})`
      if (item.manufacturer) text += ` - ${item.manufacturer}`
      if (item.model) text += ` ${item.model}`
      if (item.acquiredDate) {
        text += `, acquired ${item.acquiredDate.toISOString().split('T')[0]}`
      }
      if (item.recentEvents && item.recentEvents.length > 0) {
        const eventsText = item.recentEvents
          .slice(0, 3)
          .map((e) => `${e.type} on ${e.date.toISOString().split('T')[0]}`)
          .join(', ')
        text += `\n  Recent: ${eventsText}`
      }
      return text
    })
    .join('\n')

  return `You are a helpful home maintenance assistant. You have access to this homeowner's property information and equipment history.

Property: ${property.name}
${property.address ? `Address: ${property.address}` : ''}
${property.yearBuilt ? `Year Built: ${property.yearBuilt}` : ''}
${property.propertyType ? `Type: ${property.propertyType}` : ''}

${relevantItems.length > 0 ? `Relevant Equipment:\n${itemsContext}` : 'No specific equipment context available.'}

Be practical and helpful. Suggest DIY solutions when appropriate, recommend professionals when safety or complexity warrants it. Reference specific equipment details when relevant. Keep responses concise but thorough.`
}

export async function chatWithClaude(
  messages: ChatMessage[],
  property: PropertyContext,
  relevantItems: ItemContext[],
): Promise<string> {
  const client = getAnthropicClient()

  const systemPrompt = buildChatSystemPrompt(property, relevantItems)

  logger.info('Calling Claude for chat', {
    messageCount: messages.length,
    relevantItemCount: relevantItems.length,
  })

  const response = await client.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 2048,
    system: systemPrompt,
    messages: messages.map((m) => ({
      role: m.role,
      content: m.content,
    })),
  })

  const textContent = response.content.find((c) => c.type === 'text')
  if (!textContent || textContent.type !== 'text') {
    throw new Error('No text response from Claude')
  }

  logger.info('Claude chat response received', {
    responseLength: textContent.text.length,
  })

  return textContent.text
}
