import type {
  PrismaClient,
  Conversation as PrismaConversation,
  Message as PrismaMessage,
} from '@generated/prisma/client'
import type { Logger } from '@/lib/logger'
import type {
  Conversation,
  ConversationWithMessages,
  ConversationWithLastMessage,
  CreateConversationInput,
  CreateMessageInput,
  Message,
} from './types'

export interface ChatServiceDeps {
  db: PrismaClient
  logger: Logger
}

export class ChatService {
  private db: PrismaClient
  private logger: Logger

  constructor(deps: ChatServiceDeps) {
    this.db = deps.db
    this.logger = deps.logger
  }

  async findConversationsForProperty(propertyId: string): Promise<ConversationWithLastMessage[]> {
    this.logger.debug('Finding conversations for property', { propertyId })
    const records = await this.db.conversation.findMany({
      where: { propertyId },
      orderBy: { updatedAt: 'desc' },
      include: {
        messages: {
          orderBy: { createdAt: 'desc' },
          take: 1,
        },
        _count: { select: { messages: true } },
      },
    })
    return records.map((r) => this.toConversationWithLastMessage(r))
  }

  async findConversationById(id: string): Promise<ConversationWithMessages | null> {
    this.logger.debug('Finding conversation by id', { id })
    const record = await this.db.conversation.findUnique({
      where: { id },
      include: {
        messages: {
          orderBy: { createdAt: 'asc' },
        },
      },
    })
    return record ? this.toConversationWithMessages(record) : null
  }

  async createConversation(
    userId: string,
    input: CreateConversationInput,
  ): Promise<Conversation> {
    this.logger.info('Creating conversation', { userId, propertyId: input.propertyId })
    const record = await this.db.conversation.create({
      data: {
        propertyId: input.propertyId,
        title: input.title ?? null,
        createdById: userId,
      },
    })
    return this.toConversation(record)
  }

  async updateConversationTitle(id: string, title: string): Promise<Conversation> {
    this.logger.info('Updating conversation title', { id, title })
    const record = await this.db.conversation.update({
      where: { id },
      data: { title },
    })
    return this.toConversation(record)
  }

  async deleteConversation(id: string): Promise<void> {
    this.logger.info('Deleting conversation', { id })
    await this.db.conversation.delete({ where: { id } })
  }

  async createMessage(input: CreateMessageInput): Promise<Message> {
    this.logger.debug('Creating message', {
      conversationId: input.conversationId,
      role: input.role,
    })

    // Create message and update conversation timestamp
    const [record] = await this.db.$transaction([
      this.db.message.create({
        data: {
          conversationId: input.conversationId,
          role: input.role,
          content: input.content,
        },
      }),
      this.db.conversation.update({
        where: { id: input.conversationId },
        data: { updatedAt: new Date() },
      }),
    ])

    return this.toMessage(record)
  }

  async getMessagesForConversation(conversationId: string): Promise<Message[]> {
    this.logger.debug('Getting messages for conversation', { conversationId })
    const records = await this.db.message.findMany({
      where: { conversationId },
      orderBy: { createdAt: 'asc' },
    })
    return records.map((r) => this.toMessage(r))
  }

  private toConversation(record: PrismaConversation): Conversation {
    return {
      id: record.id,
      propertyId: record.propertyId,
      title: record.title,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }
  }

  private toMessage(record: PrismaMessage): Message {
    return {
      id: record.id,
      conversationId: record.conversationId,
      role: record.role,
      content: record.content,
      createdAt: record.createdAt,
    }
  }

  private toConversationWithMessages(
    record: PrismaConversation & { messages: PrismaMessage[] },
  ): ConversationWithMessages {
    return {
      ...this.toConversation(record),
      messages: record.messages.map((m) => this.toMessage(m)),
    }
  }

  private toConversationWithLastMessage(
    record: PrismaConversation & {
      messages: PrismaMessage[]
      _count?: { messages: number }
    },
  ): ConversationWithLastMessage {
    return {
      ...this.toConversation(record),
      lastMessage: record.messages[0] ? this.toMessage(record.messages[0]) : null,
      _count: record._count,
    }
  }
}
