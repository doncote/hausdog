import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock environment and logger before any imports
vi.mock('@/lib/env', () => ({
  getServerEnv: () => ({ ANTHROPIC_API_KEY: 'test-key' }),
}))

vi.mock('@/lib/console-logger', () => ({
  consoleLogger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}))

// Mock the Anthropic client
const mockCreate = vi.fn()
vi.mock('@anthropic-ai/sdk', () => ({
  default: vi.fn().mockImplementation(() => ({
    messages: { create: mockCreate },
  })),
}))

import { chatWithClaude, resolveWithClaude, suggestMaintenanceWithClaude } from './claude'
import type { GeminiExtractionResult } from './gemini'

const ITEM_ID = 'f47ac10b-58cc-4372-a567-0e02b2c3d479'

const sampleExtractedData: GeminiExtractionResult = {
  documentType: 'receipt',
  confidence: 0.9,
  rawText: 'Sample receipt text',
  extracted: {
    manufacturer: 'Carrier',
    model: '24ACC636A003',
    serialNumber: null,
    productName: 'Air Conditioner',
    date: '2024-01-15',
    price: 3500,
    vendor: 'HVAC Plus',
    warrantyExpires: null,
    specs: {},
  },
  suggestedItemName: 'Carrier Air Conditioner',
  suggestedDescription: 'Central AC unit',
  suggestedCategory: 'hvac',
}

const inventory = [
  { id: ITEM_ID, name: 'Furnace', manufacturer: 'Carrier', model: 'XYZ', category: 'hvac' },
]

function makeTextResponse(text: string) {
  return {
    content: [{ type: 'text', text }],
  }
}

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── resolveWithClaude ─────────────────────────────────────────────────────

describe('resolveWithClaude', () => {
  it('parses valid JSON resolution response', async () => {
    const resolution = {
      action: 'NEW_ITEM',
      matchedItemId: null,
      confidence: 0.85,
      reasoning: 'No matching item found',
      suggestedEventType: 'installation',
    }
    mockCreate.mockResolvedValue(makeTextResponse(JSON.stringify(resolution)))

    const result = await resolveWithClaude(sampleExtractedData, inventory)

    expect(result.action).toBe('NEW_ITEM')
    expect(result.confidence).toBe(0.85)
    expect(result.matchedItemId).toBeNull()
  })

  it('strips markdown code block before parsing', async () => {
    const resolution = {
      action: 'ATTACH_TO_ITEM',
      matchedItemId: ITEM_ID,
      confidence: 0.9,
      reasoning: 'Matches existing furnace',
      suggestedEventType: null,
    }
    const wrapped = `\`\`\`json\n${JSON.stringify(resolution)}\n\`\`\``
    mockCreate.mockResolvedValue(makeTextResponse(wrapped))

    const result = await resolveWithClaude(sampleExtractedData, inventory)

    expect(result.action).toBe('ATTACH_TO_ITEM')
    expect(result.matchedItemId).toBe(ITEM_ID)
  })

  it('throws descriptive error when response is not valid JSON', async () => {
    mockCreate.mockResolvedValue(makeTextResponse('Sorry, I cannot process this.'))

    await expect(resolveWithClaude(sampleExtractedData, inventory)).rejects.toThrow(
      /Failed to parse Claude resolution response as JSON/,
    )
  })

  it('throws when Claude returns no text content', async () => {
    mockCreate.mockResolvedValue({ content: [] })

    await expect(resolveWithClaude(sampleExtractedData, inventory)).rejects.toThrow(
      'No text response from Claude',
    )
  })
})

// ─── suggestMaintenanceWithClaude ──────────────────────────────────────────

describe('suggestMaintenanceWithClaude', () => {
  const item = {
    name: 'HVAC System',
    category: 'hvac',
    manufacturer: 'Carrier',
    model: '24ACC',
    acquiredDate: new Date('2020-01-01'),
    notes: null,
  }

  it('parses valid JSON array of suggestions', async () => {
    const suggestions = [
      { name: 'Replace air filter', description: 'Change every 3 months', intervalMonths: 3 },
      { name: 'Annual tune-up', description: 'Professional service', intervalMonths: 12 },
    ]
    mockCreate.mockResolvedValue(makeTextResponse(JSON.stringify(suggestions)))

    const result = await suggestMaintenanceWithClaude(item)

    expect(result).toHaveLength(2)
    expect(result[0].name).toBe('Replace air filter')
    expect(result[0].intervalMonths).toBe(3)
  })

  it('strips markdown code block before parsing', async () => {
    const suggestions = [
      { name: 'Clean coils', description: 'Annual cleaning', intervalMonths: 12 },
    ]
    const wrapped = `\`\`\`json\n${JSON.stringify(suggestions)}\n\`\`\``
    mockCreate.mockResolvedValue(makeTextResponse(wrapped))

    const result = await suggestMaintenanceWithClaude(item)

    expect(result[0].name).toBe('Clean coils')
  })

  it('limits results to 5 suggestions', async () => {
    const suggestions = Array.from({ length: 8 }, (_, i) => ({
      name: `Task ${i + 1}`,
      description: 'desc',
      intervalMonths: 6,
    }))
    mockCreate.mockResolvedValue(makeTextResponse(JSON.stringify(suggestions)))

    const result = await suggestMaintenanceWithClaude(item)

    expect(result).toHaveLength(5)
  })

  it('throws descriptive error when response is not valid JSON', async () => {
    mockCreate.mockResolvedValue(makeTextResponse('This item requires no maintenance.'))

    await expect(suggestMaintenanceWithClaude(item)).rejects.toThrow(
      /Failed to parse Claude maintenance suggestions as JSON/,
    )
  })

  it('returns empty array when parsed result is not an array', async () => {
    mockCreate.mockResolvedValue(makeTextResponse('{}'))

    const result = await suggestMaintenanceWithClaude(item)

    expect(result).toEqual([])
  })

  it('throws when Claude returns no text content', async () => {
    mockCreate.mockResolvedValue({ content: [] })

    await expect(suggestMaintenanceWithClaude(item)).rejects.toThrow('No text response from Claude')
  })
})

// ─── chatWithClaude ────────────────────────────────────────────────────────

describe('chatWithClaude', () => {
  const property = {
    name: 'My Home',
    address: '123 Main St',
    yearBuilt: 2005,
    propertyType: 'single_family',
  }

  const messages = [{ role: 'user' as const, content: 'When should I replace my HVAC filter?' }]

  const relevantItems = [
    {
      id: 'item-1',
      name: 'HVAC System',
      category: 'hvac',
      manufacturer: 'Carrier',
      model: 'XYZ',
      serialNumber: null,
      acquiredDate: new Date('2020-01-01'),
      notes: null,
    },
  ]

  it('returns text response from Claude', async () => {
    mockCreate.mockResolvedValue(makeTextResponse('You should replace it every 3 months.'))

    const result = await chatWithClaude(messages, property, relevantItems)

    expect(result).toBe('You should replace it every 3 months.')
  })

  it('calls the API with user messages', async () => {
    mockCreate.mockResolvedValue(makeTextResponse('Response text'))

    await chatWithClaude(messages, property, relevantItems)

    expect(mockCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: [{ role: 'user', content: 'When should I replace my HVAC filter?' }],
      }),
    )
  })

  it('includes property name in system prompt', async () => {
    mockCreate.mockResolvedValue(makeTextResponse('ok'))

    await chatWithClaude(messages, property, relevantItems)

    const call = mockCreate.mock.calls[0][0]
    expect(call.system).toContain('My Home')
  })

  it('throws when Claude returns no text content', async () => {
    mockCreate.mockResolvedValue({ content: [] })

    await expect(chatWithClaude(messages, property, relevantItems)).rejects.toThrow(
      'No text response from Claude',
    )
  })

  it('works with no relevant items', async () => {
    mockCreate.mockResolvedValue(makeTextResponse('General advice here.'))

    const result = await chatWithClaude(messages, property, [])

    expect(result).toBe('General advice here.')
  })
})
