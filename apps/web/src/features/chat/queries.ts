import { queryOptions, useQuery } from '@tanstack/react-query'
import {
  fetchConversation,
  fetchConversationsForProperty,
  fetchMessagesForConversation,
} from './api'

export const chatKeys = {
  all: ['chat'] as const,
  conversations: () => [...chatKeys.all, 'conversations'] as const,
  conversationsByProperty: (propertyId: string) =>
    [...chatKeys.conversations(), 'property', propertyId] as const,
  conversation: (id: string) => [...chatKeys.conversations(), 'detail', id] as const,
  messages: (conversationId: string) => [...chatKeys.all, 'messages', conversationId] as const,
}

export const conversationsForPropertyQueryOptions = (propertyId: string) =>
  queryOptions({
    queryKey: chatKeys.conversationsByProperty(propertyId),
    queryFn: () => fetchConversationsForProperty({ data: { propertyId } }),
  })

export const conversationQueryOptions = (id: string) =>
  queryOptions({
    queryKey: chatKeys.conversation(id),
    queryFn: () => fetchConversation({ data: { id } }),
  })

export const messagesQueryOptions = (conversationId: string) =>
  queryOptions({
    queryKey: chatKeys.messages(conversationId),
    queryFn: () => fetchMessagesForConversation({ data: { conversationId } }),
  })

export function useConversationsForProperty(propertyId: string | undefined) {
  return useQuery({
    ...conversationsForPropertyQueryOptions(propertyId ?? ''),
    enabled: !!propertyId,
  })
}

export function useConversation(id: string | undefined) {
  return useQuery({
    ...conversationQueryOptions(id ?? ''),
    enabled: !!id,
  })
}

export function useMessages(conversationId: string | undefined) {
  return useQuery({
    ...messagesQueryOptions(conversationId ?? ''),
    enabled: !!conversationId,
  })
}
