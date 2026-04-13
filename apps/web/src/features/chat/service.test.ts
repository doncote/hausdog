import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { ChatServiceDeps } from './service'
import { ChatService } from './service'

const mockLogger = {
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
}

function makePrismaConversation(overrides: Record<string, unknown> = {}) {
  return {
    id: 'conv-1',
    propertyId: 'prop-1',
    title: 'My Conversation',
    createdById: 'user-1',
    createdAt: new Date('2024-01-01'),
    updatedAt: new Date('2024-01-01'),
    ...overrides,
  }
}

function makePrismaMessage(overrides: Record<string, unknown> = {}) {
  return {
    id: 'msg-1',
    conversationId: 'conv-1',
    role: 'user',
    content: 'Hello',
    createdAt: new Date('2024-01-01'),
    ...overrides,
  }
}

function makeService(dbOverrides: Record<string, unknown> = {}) {
  const mockDb = {
    conversation: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    message: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
    ...dbOverrides,
  }
  const deps = { db: mockDb, logger: mockLogger } as unknown as ChatServiceDeps

  return { service: new ChatService(deps), mockDb }
}

describe('ChatService', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('findConversationsForProperty', () => {
    it('orders by updatedAt desc', async () => {
      const { service, mockDb } = makeService()
      mockDb.conversation.findMany.mockResolvedValue([])

      await service.findConversationsForProperty('prop-1')

      const call = mockDb.conversation.findMany.mock.calls[0][0]
      expect(call.where.propertyId).toBe('prop-1')
      expect(call.orderBy).toEqual({ updatedAt: 'desc' })
    })

    it('includes last message (take: 1 desc) and message count', async () => {
      const { service, mockDb } = makeService()
      mockDb.conversation.findMany.mockResolvedValue([])

      await service.findConversationsForProperty('prop-1')

      const call = mockDb.conversation.findMany.mock.calls[0][0]
      expect(call.include.messages.take).toBe(1)
      expect(call.include.messages.orderBy).toEqual({ createdAt: 'desc' })
      expect(call.include._count.select).toHaveProperty('messages')
    })

    it('maps lastMessage from first message in array', async () => {
      const { service, mockDb } = makeService()
      const conv = {
        ...makePrismaConversation(),
        messages: [makePrismaMessage({ content: 'Latest message' })],
        _count: { messages: 3 },
      }
      mockDb.conversation.findMany.mockResolvedValue([conv])

      const result = await service.findConversationsForProperty('prop-1')

      expect(result[0]?.lastMessage?.content).toBe('Latest message')
      expect(result[0]?._count?.messages).toBe(3)
    })

    it('returns null lastMessage when no messages exist', async () => {
      const { service, mockDb } = makeService()
      const conv = {
        ...makePrismaConversation(),
        messages: [],
        _count: { messages: 0 },
      }
      mockDb.conversation.findMany.mockResolvedValue([conv])

      const result = await service.findConversationsForProperty('prop-1')

      expect(result[0]?.lastMessage).toBeNull()
    })
  })

  describe('findConversationById', () => {
    it('returns null when not found', async () => {
      const { service, mockDb } = makeService()
      mockDb.conversation.findUnique.mockResolvedValue(null)

      const result = await service.findConversationById('nonexistent')
      expect(result).toBeNull()
    })

    it('returns conversation with messages ordered asc', async () => {
      const { service, mockDb } = makeService()
      const conv = {
        ...makePrismaConversation(),
        messages: [
          makePrismaMessage({ id: 'msg-1', content: 'First' }),
          makePrismaMessage({ id: 'msg-2', content: 'Second' }),
        ],
      }
      mockDb.conversation.findUnique.mockResolvedValue(conv)

      const result = await service.findConversationById('conv-1')

      const call = mockDb.conversation.findUnique.mock.calls[0][0]
      expect(call.include.messages.orderBy).toEqual({ createdAt: 'asc' })
      expect(result?.messages).toHaveLength(2)
      expect(result?.messages[0]?.content).toBe('First')
    })
  })

  describe('createConversation', () => {
    it('sets createdById and propertyId', async () => {
      const { service, mockDb } = makeService()
      mockDb.conversation.create.mockResolvedValue(makePrismaConversation())

      await service.createConversation('user-1', { propertyId: 'prop-1' })

      const call = mockDb.conversation.create.mock.calls[0][0]
      expect(call.data.createdById).toBe('user-1')
      expect(call.data.propertyId).toBe('prop-1')
    })

    it('sets title to null when not provided', async () => {
      const { service, mockDb } = makeService()
      mockDb.conversation.create.mockResolvedValue(makePrismaConversation({ title: null }))

      await service.createConversation('user-1', { propertyId: 'prop-1' })

      const call = mockDb.conversation.create.mock.calls[0][0]
      expect(call.data.title).toBeNull()
    })

    it('passes title when provided', async () => {
      const { service, mockDb } = makeService()
      mockDb.conversation.create.mockResolvedValue(makePrismaConversation({ title: 'About HVAC' }))

      await service.createConversation('user-1', { propertyId: 'prop-1', title: 'About HVAC' })

      const call = mockDb.conversation.create.mock.calls[0][0]
      expect(call.data.title).toBe('About HVAC')
    })
  })

  describe('updateConversationTitle', () => {
    it('updates title field', async () => {
      const { service, mockDb } = makeService()
      mockDb.conversation.update.mockResolvedValue(makePrismaConversation({ title: 'New Title' }))

      await service.updateConversationTitle('conv-1', 'New Title')

      expect(mockDb.conversation.update).toHaveBeenCalledWith({
        where: { id: 'conv-1' },
        data: { title: 'New Title' },
      })
    })
  })

  describe('deleteConversation', () => {
    it('calls db delete with correct id', async () => {
      const { service, mockDb } = makeService()
      mockDb.conversation.delete.mockResolvedValue(undefined)

      await service.deleteConversation('conv-1')

      expect(mockDb.conversation.delete).toHaveBeenCalledWith({ where: { id: 'conv-1' } })
    })
  })

  describe('createMessage', () => {
    it('uses a transaction to create message and update conversation', async () => {
      const { service, mockDb } = makeService()
      const msg = makePrismaMessage()
      mockDb.message.create.mockResolvedValue(msg)
      mockDb.conversation.update.mockResolvedValue(makePrismaConversation())
      mockDb.$transaction.mockImplementation(async (promises: Promise<unknown>[]) =>
        Promise.all(promises),
      )

      const result = await service.createMessage({
        conversationId: 'conv-1',
        role: 'user',
        content: 'Hello',
      })

      expect(mockDb.$transaction).toHaveBeenCalledOnce()
      expect(result.content).toBe('Hello')
    })

    it('creates message with correct fields', async () => {
      const { service, mockDb } = makeService()
      mockDb.message.create.mockResolvedValue(
        makePrismaMessage({ role: 'assistant', content: 'Hi' }),
      )
      mockDb.conversation.update.mockResolvedValue(makePrismaConversation())
      mockDb.$transaction.mockImplementation(async (promises: Promise<unknown>[]) =>
        Promise.all(promises),
      )

      await service.createMessage({
        conversationId: 'conv-1',
        role: 'assistant',
        content: 'Hi',
      })

      const createCall = mockDb.message.create.mock.calls[0][0]
      expect(createCall.data.conversationId).toBe('conv-1')
      expect(createCall.data.role).toBe('assistant')
      expect(createCall.data.content).toBe('Hi')
    })

    it('updates conversation updatedAt in same transaction', async () => {
      const { service, mockDb } = makeService()
      mockDb.message.create.mockResolvedValue(makePrismaMessage())
      mockDb.conversation.update.mockResolvedValue(makePrismaConversation())
      mockDb.$transaction.mockImplementation(async (promises: Promise<unknown>[]) =>
        Promise.all(promises),
      )

      await service.createMessage({ conversationId: 'conv-1', role: 'user', content: 'Hi' })

      const updateCall = mockDb.conversation.update.mock.calls[0][0]
      expect(updateCall.where.id).toBe('conv-1')
      expect(updateCall.data.updatedAt).toBeInstanceOf(Date)
    })
  })

  describe('getMessagesForConversation', () => {
    it('returns messages ordered by createdAt asc', async () => {
      const { service, mockDb } = makeService()
      mockDb.message.findMany.mockResolvedValue([
        makePrismaMessage({ id: 'msg-1' }),
        makePrismaMessage({ id: 'msg-2' }),
      ])

      const result = await service.getMessagesForConversation('conv-1')

      const call = mockDb.message.findMany.mock.calls[0][0]
      expect(call.where.conversationId).toBe('conv-1')
      expect(call.orderBy).toEqual({ createdAt: 'asc' })
      expect(result).toHaveLength(2)
    })
  })
})
