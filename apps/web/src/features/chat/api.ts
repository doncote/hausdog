import { createServerFn } from '@tanstack/react-start'
import { EventService } from '@/features/events/service'
import { ItemService } from '@/features/items/service'
import { PropertyService } from '@/features/properties/service'
import { prisma } from '@/lib/db/client'
import { chatWithClaude } from '@/lib/llm'
import { logger } from '@/lib/logger'
import { ChatService } from './service'
import type { CreateConversationInput, CreateMessageInput } from './types'

const getChatService = () => new ChatService({ db: prisma, logger })
const getPropertyService = () => new PropertyService({ db: prisma, logger })
const getItemService = () => new ItemService({ db: prisma, logger })
const getEventService = () => new EventService({ db: prisma, logger })

export const fetchConversationsForProperty = createServerFn({ method: 'GET' })
  .inputValidator((d: { propertyId: string }) => d)
  .handler(async ({ data }) => {
    const service = getChatService()
    return service.findConversationsForProperty(data.propertyId)
  })

export const fetchConversation = createServerFn({ method: 'GET' })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const service = getChatService()
    return service.findConversationById(data.id)
  })

export const fetchMessagesForConversation = createServerFn({ method: 'GET' })
  .inputValidator((d: { conversationId: string }) => d)
  .handler(async ({ data }) => {
    const service = getChatService()
    return service.getMessagesForConversation(data.conversationId)
  })

export const createConversation = createServerFn({ method: 'POST' })
  .inputValidator((d: { userId: string; input: CreateConversationInput }) => d)
  .handler(async ({ data }) => {
    const service = getChatService()
    return service.createConversation(data.userId, data.input)
  })

export const updateConversationTitle = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string; title: string }) => d)
  .handler(async ({ data }) => {
    const service = getChatService()
    return service.updateConversationTitle(data.id, data.title)
  })

export const deleteConversation = createServerFn({ method: 'POST' })
  .inputValidator((d: { id: string }) => d)
  .handler(async ({ data }) => {
    const service = getChatService()
    await service.deleteConversation(data.id)
    return { success: true }
  })

export const createMessage = createServerFn({ method: 'POST' })
  .inputValidator((d: { input: CreateMessageInput }) => d)
  .handler(async ({ data }) => {
    const service = getChatService()
    return service.createMessage(data.input)
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
    const chatService = getChatService()
    const propertyService = getPropertyService()
    const itemService = getItemService()
    const eventService = getEventService()

    // Save user message
    const userMessage = await chatService.createMessage({
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
    const messages = await chatService.getMessagesForConversation(data.conversationId)

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

    // Get recent events for relevant items
    const itemsWithEvents = await Promise.all(
      relevantItems.map(async (item) => {
        const events = await eventService.findAllForItem(item.id)
        return {
          ...item,
          recentEvents: events.slice(0, 5).map((e) => ({
            type: e.type,
            date: e.date,
            description: e.description,
          })),
        }
      }),
    )

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
    const assistantMessage = await chatService.createMessage({
      conversationId: data.conversationId,
      role: 'assistant',
      content: assistantResponse,
    })

    // Update conversation title if this is the first exchange
    if (messages.length <= 1) {
      const title = data.message.slice(0, 50) + (data.message.length > 50 ? '...' : '')
      await chatService.updateConversationTitle(data.conversationId, title)
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
    const chatService = getChatService()
    const propertyService = getPropertyService()
    const itemService = getItemService()
    const eventService = getEventService()

    // Save user message
    const userMessage = await chatService.createMessage({
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
    const messages = await chatService.getMessagesForConversation(data.conversationId)

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

    // Get events for the focal item
    const focalEvents = await eventService.findAllForItem(data.itemId)

    // Build context items array with lineage info
    const contextItems = [
      // Ancestors (from root to parent)
      ...(await Promise.all(
        ancestors.map(async (item, idx) => {
          const events = await eventService.findAllForItem(item.id)
          return {
            ...item,
            lineageRole: 'ancestor' as const,
            lineageDepth: idx,
            recentEvents: events.slice(0, 3).map((e) => ({
              type: e.type,
              date: e.date,
              description: e.description,
            })),
          }
        }),
      )),
      // Focal item
      {
        ...focalItem,
        lineageRole: 'focal' as const,
        lineageDepth: ancestors.length,
        recentEvents: focalEvents.slice(0, 10).map((e) => ({
          type: e.type,
          date: e.date,
          description: e.description,
        })),
      },
      // Children
      ...(await Promise.all(
        children.map(async (item) => {
          const events = await eventService.findAllForItem(item.id)
          return {
            ...item,
            lineageRole: 'child' as const,
            lineageDepth: ancestors.length + 1,
            recentEvents: events.slice(0, 3).map((e) => ({
              type: e.type,
              date: e.date,
              description: e.description,
            })),
          }
        }),
      )),
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
    const assistantMessage = await chatService.createMessage({
      conversationId: data.conversationId,
      role: 'assistant',
      content: assistantResponse,
    })

    // Update conversation title if this is the first exchange
    if (messages.length <= 1) {
      const title = `${focalItem.name}: ${data.message.slice(0, 30)}${data.message.length > 30 ? '...' : ''}`
      await chatService.updateConversationTitle(data.conversationId, title)
    }

    return {
      userMessage,
      assistantMessage,
    }
  })
