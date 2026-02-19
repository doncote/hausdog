import { task } from '@trigger.dev/sdk/v3'
import { PrismaClient } from '@generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import Anthropic from '@anthropic-ai/sdk'

interface SuggestMaintenancePayload {
  itemId: string
  userId: string
}

function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required')
  }
  const adapter = new PrismaPg({ connectionString })
  return new PrismaClient({ adapter })
}

const MAINTENANCE_SYSTEM_PROMPT = `You are a home maintenance expert. Given details about a home appliance, system, or component, suggest common recurring maintenance tasks with recommended intervals.

Rules:
- Only suggest maintenance that is standard and widely recommended
- Prefer manufacturer-recommended intervals when the brand/model is known
- Keep suggestions practical for a homeowner (not overly technical)
- Maximum 5 suggestions per item
- If the item type doesn't have meaningful recurring maintenance, return an empty array

Return JSON only (no markdown):
[
  {
    "name": "Short task name (e.g. Replace air filter)",
    "description": "Brief guidance on how to do this or what to look for",
    "intervalMonths": 3
  }
]`

export const suggestMaintenanceTask = task({
  id: 'suggest-maintenance',
  retry: {
    maxAttempts: 3,
    minTimeoutInMs: 1000,
    maxTimeoutInMs: 10000,
  },
  run: async (payload: SuggestMaintenancePayload) => {
    const { itemId, userId } = payload
    const prisma = createPrismaClient()

    try {
      const item = await prisma.item.findUnique({
        where: { id: itemId },
        select: {
          id: true,
          propertyId: true,
          name: true,
          category: true,
          manufacturer: true,
          model: true,
          acquiredDate: true,
          notes: true,
        },
      })

      if (!item) throw new Error(`Item not found: ${itemId}`)

      const existingTasks = await prisma.maintenanceTask.findMany({
        where: { itemId, status: { not: 'dismissed' } },
        select: { name: true },
      })
      const existingNames = new Set(existingTasks.map((t) => t.name.toLowerCase()))

      const recentEvents = await prisma.event.findMany({
        where: { itemId, type: 'maintenance' },
        orderBy: { date: 'desc' },
        take: 10,
        select: { type: true, date: true, description: true },
      })

      const apiKey = process.env.ANTHROPIC_API_KEY
      if (!apiKey) throw new Error('ANTHROPIC_API_KEY not configured')

      const anthropic = new Anthropic({ apiKey })

      const userPrompt = `ITEM DETAILS:
Name: ${item.name}
Category: ${item.category}
${item.manufacturer ? `Manufacturer: ${item.manufacturer}` : ''}
${item.model ? `Model: ${item.model}` : ''}
${item.acquiredDate ? `Acquired: ${item.acquiredDate.toISOString().split('T')[0]}` : ''}
${item.notes ? `Notes: ${item.notes}` : ''}

${recentEvents.length > 0 ? `RECENT MAINTENANCE HISTORY:\n${recentEvents.map((e) => `- ${e.description || e.type} on ${e.date.toISOString().split('T')[0]}`).join('\n')}` : ''}

Suggest recurring maintenance tasks for this item.`

      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 1024,
        system: MAINTENANCE_SYSTEM_PROMPT,
        messages: [{ role: 'user', content: userPrompt }],
      })

      const textContent = response.content.find((c) => c.type === 'text')
      if (!textContent || textContent.type !== 'text') throw new Error('No text response from Claude')

      let jsonStr = textContent.text
      const jsonMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
      if (jsonMatch) jsonStr = jsonMatch[1]

      const suggestions = (
        JSON.parse(jsonStr.trim()) as Array<{ name: string; description: string; intervalMonths: number }>
      ).slice(0, 5)

      const lastEventDates = new Map<string, Date>()
      for (const event of recentEvents) {
        const key = (event.description || '').toLowerCase()
        if (!lastEventDates.has(key)) lastEventDates.set(key, event.date)
      }

      const created: string[] = []
      for (const suggestion of suggestions) {
        if (existingNames.has(suggestion.name.toLowerCase())) continue

        // If we know when this was last done, schedule from that date.
        // Otherwise due now — we don't know the item's maintenance history.
        const lastDone = lastEventDates.get(suggestion.name.toLowerCase())
        const nextDueDate = lastDone
          ? new Date(lastDone.getTime() + suggestion.intervalMonths * 30 * 24 * 60 * 60 * 1000)
          : new Date()

        await prisma.maintenanceTask.create({
          data: {
            propertyId: item.propertyId,
            itemId,
            name: suggestion.name,
            description: suggestion.description,
            intervalMonths: suggestion.intervalMonths,
            nextDueDate,
            source: 'ai_suggested',
            status: 'active',
            createdById: userId,
            updatedById: userId,
          },
        })
        created.push(suggestion.name)
      }

      return {
        itemId,
        suggestionsReceived: suggestions.length,
        tasksCreated: created.length,
        taskNames: created,
      }
    } finally {
      await prisma.$disconnect()
    }
  },
})
