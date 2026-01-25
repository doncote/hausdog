import type { PrismaClient, Event as PrismaEvent } from '@generated/prisma/client'
import type { Logger } from '@/lib/logger'
import type { CreateEventInput, Event, EventWithRelations, UpdateEventInput } from './types'

export interface EventServiceDeps {
  db: PrismaClient
  logger: Logger
}

export class EventService {
  private db: PrismaClient
  private logger: Logger

  constructor(deps: EventServiceDeps) {
    this.db = deps.db
    this.logger = deps.logger
  }

  async findAllForItem(itemId: string): Promise<EventWithRelations[]> {
    this.logger.debug('Finding all events for item', { itemId })
    const records = await this.db.event.findMany({
      where: { itemId },
      orderBy: { date: 'desc' },
      include: {
        item: { select: { id: true, name: true } },
        _count: { select: { documents: true } },
      },
    })
    return records.map((r) => this.toDomainWithRelations(r))
  }

  async findById(id: string): Promise<EventWithRelations | null> {
    this.logger.debug('Finding event by id', { id })
    const record = await this.db.event.findUnique({
      where: { id },
      include: {
        item: { select: { id: true, name: true } },
        _count: { select: { documents: true } },
      },
    })
    return record ? this.toDomainWithRelations(record) : null
  }

  async create(userId: string, input: CreateEventInput): Promise<Event> {
    this.logger.info('Creating event', { userId, itemId: input.itemId, type: input.type })
    const record = await this.db.event.create({
      data: {
        itemId: input.itemId,
        type: input.type,
        date: input.date,
        description: input.description ?? null,
        cost: input.cost ?? null,
        performedBy: input.performedBy ?? null,
        createdById: userId,
        updatedById: userId,
      },
    })
    return this.toDomain(record)
  }

  async update(id: string, userId: string, input: UpdateEventInput): Promise<Event> {
    this.logger.info('Updating event', { id, userId })
    const record = await this.db.event.update({
      where: { id },
      data: {
        ...(input.type !== undefined && { type: input.type }),
        ...(input.date !== undefined && { date: input.date }),
        ...(input.description !== undefined && { description: input.description ?? null }),
        ...(input.cost !== undefined && { cost: input.cost ?? null }),
        ...(input.performedBy !== undefined && { performedBy: input.performedBy ?? null }),
        updatedById: userId,
      },
    })
    return this.toDomain(record)
  }

  async delete(id: string): Promise<void> {
    this.logger.info('Deleting event', { id })
    await this.db.event.delete({ where: { id } })
  }

  private toDomain(record: PrismaEvent): Event {
    return {
      id: record.id,
      itemId: record.itemId,
      type: record.type,
      date: record.date,
      description: record.description,
      cost: record.cost ? Number(record.cost) : null,
      performedBy: record.performedBy,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }
  }

  private toDomainWithRelations(
    record: PrismaEvent & {
      item?: { id: string; name: string }
      _count?: { documents: number }
    },
  ): EventWithRelations {
    return {
      ...this.toDomain(record),
      item: record.item,
      _count: record._count,
    }
  }
}
