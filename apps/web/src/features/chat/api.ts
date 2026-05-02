import { createServerFn } from '@tanstack/react-start'
import { EventService } from '@/features/events/service'
import { ItemService } from '@/features/items/service'
import { PropertyService } from '@/features/properties/service'
import { consoleLogger as logger } from '@/lib/console-logger'
import { prisma } from '@/lib/db/client'
import { getSafeSession } from '@/lib/supabase'
import { ChatService } from './service'
import type { CreateConversationInput, CreateMessageInput } from './types'

const chat = new ChatService({ db: prisma, logger })
const propertyService = new PropertyService({ db: prisma, logger })
const itemService = new ItemService({ db: prisma, logger })
const eventService = new EventService({ db: prisma, logger })

export const fetchConversationsForProperty = createServerFn({ method: 'GET' })
  .inputValidator((d: { propertyId: string }) => d)
  .handler(async ({ data }) => {
    const { user } = await getSafeSession()
    if (!user) throw new Error('Unauthorized')
    const property = await propertyService.findById(data.propertyId, user.id)
    if (!property) throw new Error('Property not found or access denied')
    return chat.findConversationsForProperty(data.propertyId)
  })

export const fetchConversation = createServerFn({ method: 'GET' })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const { user } = await getSafeSession()
    if (!user) throw new Error('Unauthorized')
    const conversation = await chat.findConversationById(data.id)
    if (!conversation) return null
    const property = await propertyService.findById(conversation.propertyId, user.id)
    if (!property) throw new Error('Property not found or access denied')
    return conversation
  })

export const fetchMessagesForConversation = createServerFn({ method: 'GET' })
  .inputValidator((d: { conversationId: string }) => d)
  .handler(async ({ data }) => {
    const { user } = await getSafeSession()
    if (!user) throw new Error('Unauthorized')
    const conversation = await prisma.conversation.findUnique({
      where: { id: data.conversationId },
      select: { propertyId: true },
    })
    if (!conversation) throw new Error('Conversation not found')
    const property = await propertyService.findById(conversation.propertyId, user.id)
    if (!property) throw new Error('Property not found or access denied')
    return chat.getMessagesForConversation(data.conversationId)
  })

export const createConversation = createServerFn({ method: 'POST' })
  .inputValidator((d: { userId: string; input: CreateConversationInput }) => d)
  .handler(async ({ data }) => {
    const property = await propertyService.findById(data.input.propertyId, data.userId)
    if (!property) throw new Error('Property not found or access denied')
    return chat.createConversation(data.userId, data.input)
  })

export const updateConversationTitle = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string; userId: string; title: string }) => d)
  .handler(async ({ data }) => {
    const existing = await prisma.conversation.findUnique({
      where: { id: data.id },
      select: { propertyId: true },
    })
    if (!existing) throw new Error('Conversation not found')
    const property = await propertyService.findById(existing.propertyId, data.userId)
    if (!property) throw new Error('Property not found or access denied')
    return chat.updateConversationTitle(data.id, data.title)
  })

export const deleteConversation = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string; userId: string }) => d)
  .handler(async ({ data }) => {
    const existing = await prisma.conversation.findUnique({
      where: { id: data.id },
      select: { propertyId: true },
    })
    if (!existing) throw new Error('Conversation not found')
    const property = await propertyService.findById(existing.propertyId, data.userId)
    if (!property) throw new Error('Property not found or access denied')
    await chat.deleteConversation(data.id)
    return { success: true }
  })

export const createMessage = createServerFn({ method: 'POST' })
  .inputValidator((d: { userId: string; input: CreateMessageInput }) => d)
  .handler(async ({ data }) => {
    const conversation = await prisma.conversation.findUnique({
      where: { id: data.input.conversationId },
      select: { propertyId: true },
    })
    if (!conversation) throw new Error('Conversation not found')
    const property = await propertyService.findById(conversation.propertyId, data.userId)
    if (!property) throw new Error('Property not found or access denied')
    return chat.createMessage(data.input)
  })

interface SendMessageInput {
  conversationId: string
  propertyId: string
  userId: string
  message: string
}

interface SendItemMessageInput {
  conversationId: string
  propertyId: string
  itemId: string
  userId: string
  message: string
}

/**
 * Send a message to the chat and get an AI response.
 * This handles the full flow: save user message, get context, call Claude, save response.
 */
export const sendChatMessage = createServerFn({ method: 'POST' })
  .inputValidator((d: SendMessageInput) => d)
  .handler(async ({ data }) => {
    const { chatWithClaude } = await import('@/lib/llm')

    // Save user message
    const userMessage = await chat.createMessage({
      conversationId: data.conversationId,
      role: 'user',
      content: data.message,
    })

    // Get property context
    const property = await propertyService.findById(data.propertyId, data.userId)
    if (!property) {
      throw new Error('Property not found')
    }

    // Get conversation history
    const messages = await chat.getMessagesForConversation(data.conversationId)

    // Search for relevant items based on the user's message
    // Simple keyword-based relevance for now
    const allItems = await itemService.findAllForProperty(data.propertyId)
    const searchTerms = data.message.toLowerCase().split(/\s+/)
    const relevantItems = allItems
      .filter((item) => {
        const itemText = [item.name, item.manufacturer, item.model, item.category, item.notes]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
        return searchTerms.some((term) => itemText.includes(term))
      })
      .slice(0, 10) // Limit to 10 most relevant items

    // Get recent events for relevant items (batched to avoid N+1)
    const eventsMap = await eventService.findAllForItems(relevantItems.map((i) => i.id))
    const itemsWithEvents = relevantItems.map((item) => ({
      ...item,
      recentEvents: (eventsMap.get(item.id) ?? []).slice(0, 5).map((e) => ({
        type: e.type,
        date: e.date,
        description: e.description,
      })),
    }))

    // Build chat messages for Claude
    const chatMessages = messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

    // Call Claude
    const assistantResponse = await chatWithClaude(
      chatMessages,
      {
        name: property.name,
        address: property.formattedAddress,
        yearBuilt: property.yearBuilt,
        propertyType: property.propertyType,
      },
      itemsWithEvents,
    )

    // Save assistant message
    const assistantMessage = await chat.createMessage({
      conversationId: data.conversationId,
      role: 'assistant',
      content: assistantResponse,
    })

    // Update conversation title if this is the first exchange
    if (messages.length <= 1) {
      const title = data.message.slice(0, 50) + (data.message.length > 50 ? '...' : '')
      await chat.updateConversationTitle(data.conversationId, title)
    }

    return {
      userMessage,
      assistantMessage,
    }
  })

/**
 * Send a message to the chat with item-specific context.
 * Includes full lineage: property → space → parent items → current item → child items
 */
export const sendItemChatMessage = createServerFn({ method: 'POST' })
  .inputValidator((d: SendItemMessageInput) => d)
  .handler(async ({ data }) => {
    const { chatWithClaude } = await import('@/lib/llm')

    // Save user message
    const userMessage = await chat.createMessage({
      conversationId: data.conversationId,
      role: 'user',
      content: data.message,
    })

    // Get property context
    const property = await propertyService.findById(data.propertyId, data.userId)
    if (!property) {
      throw new Error('Property not found')
    }

    // Get the focal item with full details
    const focalItem = await itemService.findById(data.itemId)
    if (!focalItem) {
      throw new Error('Item not found')
    }

    // Get conversation history
    const messages = await chat.getMessagesForConversation(data.conversationId)

    // Build item lineage (ancestors)
    const ancestors: (typeof focalItem)[] = []
    let currentParentId = focalItem.parentId
    while (currentParentId) {
      const parent = await itemService.findById(currentParentId)
      if (!parent) break
      ancestors.unshift(parent) // Add at beginning to maintain order
      currentParentId = parent.parentId
    }

    // Get children of the focal item
    const children = await itemService.findChildrenForItem(data.itemId)

    // Batch fetch events for all context items (focal + ancestors + children)
    const allContextItemIds = [
      data.itemId,
      ...ancestors.map((i) => i.id),
      ...children.map((i) => i.id),
    ]
    const eventsMap = await eventService.findAllForItems(allContextItemIds)

    // Build context items array with lineage info
    const contextItems = [
      // Ancestors (from root to parent)
      ...ancestors.map((item, idx) => ({
        ...item,
        lineageRole: 'ancestor' as const,
        lineageDepth: idx,
        recentEvents: (eventsMap.get(item.id) ?? []).slice(0, 3).map((e) => ({
          type: e.type,
          date: e.date,
          description: e.description,
        })),
      })),
      // Focal item
      {
        ...focalItem,
        lineageRole: 'focal' as const,
        lineageDepth: ancestors.length,
        recentEvents: (eventsMap.get(data.itemId) ?? []).slice(0, 10).map((e) => ({
          type: e.type,
          date: e.date,
          description: e.description,
        })),
      },
      // Children
      ...children.map((item) => ({
        ...item,
        lineageRole: 'child' as const,
        lineageDepth: ancestors.length + 1,
        recentEvents: (eventsMap.get(item.id) ?? []).slice(0, 3).map((e) => ({
          type: e.type,
          date: e.date,
          description: e.description,
        })),
      })),
    ]

    // Build chat messages for Claude
    const chatMessages = messages.map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    }))

    // Call Claude with enhanced context
    const assistantResponse = await chatWithClaude(
      chatMessages,
      {
        name: property.name,
        address: property.formattedAddress,
        yearBuilt: property.yearBuilt,
        propertyType: property.propertyType,
      },
      contextItems,
    )

    // Save assistant message
    const assistantMessage = await chat.createMessage({
      conversationId: data.conversationId,
      role: 'assistant',
      content: assistantResponse,
    })

    // Update conversation title if this is the first exchange
    if (messages.length <= 1) {
      const title = `${focalItem.name}: ${data.message.slice(0, 30)}${data.message.length > 30 ? '...' : ''}`
      await chat.updateConversationTitle(data.conversationId, title)
    }

    return {
      userMessage,
      assistantMessage,
    }
  })
