import { useMutation, useQueryClient } from '@tanstack/react-query'
import {
  createConversation,
  createMessage,
  deleteConversation,
  sendChatMessage,
  sendItemChatMessage,
  updateConversationTitle,
} from './api'
import { chatKeys } from './queries'
import type { CreateConversationInput, CreateMessageInput } from './types'

export function useCreateConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { userId: string; input: CreateConversationInput }) =>
      createConversation({ data: input }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: chatKeys.conversationsByProperty(variables.input.propertyId),
      })
    },
  })
}

export function useUpdateConversationTitle() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { id: string; userId: string; propertyId: string; title: string }) =>
      updateConversationTitle({ data: { id: input.id, userId: input.userId, title: input.title } }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: chatKeys.conversationsByProperty(variables.propertyId),
      })
      queryClient.invalidateQueries({
        queryKey: chatKeys.conversation(variables.id),
      })
    },
  })
}

export function useDeleteConversation() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { id: string; userId: string; propertyId: string }) =>
      deleteConversation({ data: { id: input.id, userId: input.userId } }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: chatKeys.conversationsByProperty(variables.propertyId),
      })
      queryClient.removeQueries({
        queryKey: chatKeys.conversation(variables.id),
      })
      queryClient.removeQueries({
        queryKey: chatKeys.messages(variables.id),
      })
    },
  })
}

export function useCreateMessage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: { conversationId: string; userId: string; input: CreateMessageInput }) =>
      createMessage({ data: { userId: input.userId, input: input.input } }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: chatKeys.messages(variables.conversationId),
      })
      queryClient.invalidateQueries({
        queryKey: chatKeys.conversation(variables.conversationId),
      })
    },
  })
}

export function useSendChatMessage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: {
      conversationId: string
      propertyId: string
      userId: string
      message: string
    }) => sendChatMessage({ data: input }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: chatKeys.messages(variables.conversationId),
      })
      queryClient.invalidateQueries({
        queryKey: chatKeys.conversation(variables.conversationId),
      })
      queryClient.invalidateQueries({
        queryKey: chatKeys.conversationsByProperty(variables.propertyId),
      })
    },
  })
}

export function useSendItemChatMessage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: {
      conversationId: string
      propertyId: string
      itemId: string
      userId: string
      message: string
    }) => sendItemChatMessage({ data: input }),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: chatKeys.messages(variables.conversationId),
      })
      queryClient.invalidateQueries({
        queryKey: chatKeys.conversation(variables.conversationId),
      })
      queryClient.invalidateQueries({
        queryKey: chatKeys.conversationsByProperty(variables.propertyId),
      })
    },
  })
}
