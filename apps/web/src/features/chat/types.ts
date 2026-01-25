import { z } from 'zod'

export const MessageRole = {
  USER: 'user',
  ASSISTANT: 'assistant',
  SYSTEM: 'system',
} as const

export type MessageRoleValue = (typeof MessageRole)[keyof typeof MessageRole]

export const CreateConversationSchema = z.object({
  propertyId: z.string().uuid(),
  title: z.string().optional(),
})

export const CreateMessageSchema = z.object({
  conversationId: z.string().uuid(),
  role: z.string(),
  content: z.string().min(1),
})

export type CreateConversationInput = z.infer<typeof CreateConversationSchema>
export type CreateMessageInput = z.infer<typeof CreateMessageSchema>

export interface Message {
  id: string
  conversationId: string
  role: string
  content: string
  createdAt: Date
}

export interface Conversation {
  id: string
  propertyId: string
  title: string | null
  createdAt: Date
  updatedAt: Date
}

export interface ConversationWithMessages extends Conversation {
  messages: Message[]
}

export interface ConversationWithLastMessage extends Conversation {
  lastMessage?: Message | null
  _count?: {
    messages: number
  }
}

export interface ChatContext {
  propertyId: string
  propertyName: string
  items: Array<{
    id: string
    name: string
    category: string
    manufacturer?: string | null
    model?: string | null
  }>
  recentEvents: Array<{
    id: string
    type: string
    date: Date
    itemName: string
    description?: string | null
  }>
}
