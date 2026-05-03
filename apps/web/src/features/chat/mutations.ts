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
    mutationFn: (input: { input: CreateConversationInput }) =>
      createConversation({ data: { input: input.input } }),
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
    mutationFn: (input: { id: string; propertyId: string; title: string }) =>
      updateConversationTitle({ data: { id: input.id, title: input.title } }),
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
    mutationFn: (input: { id: string; propertyId: string }) =>
      deleteConversation({ data: { id: input.id } }),
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
    mutationFn: (input: { conversationId: string; input: CreateMessageInput }) =>
      createMessage({ data: { input: input.input } }),
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
      message: string
    }) => sendChatMessage({ data: { conversationId: input.conversationId, propertyId: input.propertyId, message: input.message } }),
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
      message: string
    }) => sendItemChatMessage({ data: { conversationId: input.conversationId, propertyId: input.propertyId, itemId: input.itemId, message: input.message } }),
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
