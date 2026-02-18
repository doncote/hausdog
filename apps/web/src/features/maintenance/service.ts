import type { PrismaClient, MaintenanceTask as PrismaMaintenanceTask } from '@generated/prisma/client'
import type { Logger } from '@/lib/console-logger'
import type {
  CompleteMaintenanceTaskInput,
  CreateMaintenanceTaskInput,
  MaintenanceTask,
  MaintenanceTaskWithRelations,
  UpdateMaintenanceTaskInput,
} from './types'

export interface MaintenanceServiceDeps {
  db: PrismaClient
  logger: Logger
}

export interface AISuggestion {
  name: string
  description?: string
  intervalMonths: number
}

export class MaintenanceService {
  private db: PrismaClient
  private logger: Logger

  constructor(deps: MaintenanceServiceDeps) {
    this.db = deps.db
    this.logger = deps.logger
  }

  async findAllForProperty(propertyId: string): Promise<MaintenanceTaskWithRelations[]> {
    this.logger.debug('Finding all maintenance tasks for property', { propertyId })
    const records = await this.db.maintenanceTask.findMany({
      where: { propertyId, status: { not: 'dismissed' } },
      orderBy: { nextDueDate: 'asc' },
      include: {
        property: { select: { id: true, name: true } },
        item: { select: { id: true, name: true } },
      },
    })
    return records.map((r) => this.toDomainWithRelations(r))
  }

  async findAllForItem(itemId: string): Promise<MaintenanceTaskWithRelations[]> {
    this.logger.debug('Finding all maintenance tasks for item', { itemId })
    const records = await this.db.maintenanceTask.findMany({
      where: { itemId, status: { not: 'dismissed' } },
      orderBy: { nextDueDate: 'asc' },
      include: {
        property: { select: { id: true, name: true } },
        item: { select: { id: true, name: true } },
      },
    })
    return records.map((r) => this.toDomainWithRelations(r))
  }

  async findUpcoming(
    propertyIds: string[],
    options?: { limit?: number },
  ): Promise<MaintenanceTaskWithRelations[]> {
    const limit = options?.limit ?? 20
    this.logger.debug('Finding upcoming maintenance tasks', { propertyIds, limit })
    const records = await this.db.maintenanceTask.findMany({
      where: {
        propertyId: { in: propertyIds },
        status: 'active',
      },
      orderBy: { nextDueDate: 'asc' },
      take: limit,
      include: {
        property: { select: { id: true, name: true } },
        item: { select: { id: true, name: true } },
      },
    })
    return records.map((r) => this.toDomainWithRelations(r))
  }

  async findById(id: string): Promise<MaintenanceTaskWithRelations | null> {
    this.logger.debug('Finding maintenance task by id', { id })
    const record = await this.db.maintenanceTask.findUnique({
      where: { id },
      include: {
        property: { select: { id: true, name: true } },
        item: { select: { id: true, name: true } },
      },
    })
    return record ? this.toDomainWithRelations(record) : null
  }

  async create(userId: string, input: CreateMaintenanceTaskInput): Promise<MaintenanceTask> {
    this.logger.info('Creating maintenance task', { userId, propertyId: input.propertyId })
    const record = await this.db.maintenanceTask.create({
      data: {
        propertyId: input.propertyId,
        itemId: input.itemId ?? null,
        name: input.name,
        description: input.description ?? null,
        intervalMonths: input.intervalMonths,
        nextDueDate: input.nextDueDate,
        source: 'user_created',
        status: 'active',
        createdById: userId,
        updatedById: userId,
      },
    })
    return this.toDomain(record)
  }

  async createFromAI(
    userId: string,
    propertyId: string,
    itemId: string | null,
    suggestions: AISuggestion[],
    lastEventDates?: Record<string, Date>,
  ): Promise<MaintenanceTask[]> {
    this.logger.info('Creating maintenance tasks from AI suggestions', {
      userId,
      propertyId,
      itemId,
      count: suggestions.length,
    })

    // Fetch existing task names for deduplication
    const existing = await this.db.maintenanceTask.findMany({
      where: {
        propertyId,
        ...(itemId ? { itemId } : {}),
        status: { not: 'dismissed' },
      },
      select: { name: true },
    })
    const existingNames = new Set(existing.map((t) => t.name.toLowerCase()))

    const created: MaintenanceTask[] = []
    for (const suggestion of suggestions) {
      if (existingNames.has(suggestion.name.toLowerCase())) {
        this.logger.debug('Skipping duplicate maintenance suggestion', { name: suggestion.name })
        continue
      }

      const baseDate = lastEventDates?.[suggestion.name] ?? new Date()
      const nextDueDate = new Date(baseDate)
      nextDueDate.setMonth(nextDueDate.getMonth() + suggestion.intervalMonths)

      const record = await this.db.maintenanceTask.create({
        data: {
          propertyId,
          itemId,
          name: suggestion.name,
          description: suggestion.description ?? null,
          intervalMonths: suggestion.intervalMonths,
          nextDueDate,
          source: 'ai_suggested',
          status: 'active',
          createdById: userId,
          updatedById: userId,
        },
      })
      created.push(this.toDomain(record))
    }

    return created
  }

  async update(
    id: string,
    userId: string,
    input: UpdateMaintenanceTaskInput,
  ): Promise<MaintenanceTask> {
    this.logger.info('Updating maintenance task', { id, userId })
    const record = await this.db.maintenanceTask.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description ?? null }),
        ...(input.intervalMonths !== undefined && { intervalMonths: input.intervalMonths }),
        ...(input.nextDueDate !== undefined && { nextDueDate: input.nextDueDate }),
        ...(input.status !== undefined && { status: input.status }),
        updatedById: userId,
      },
    })
    return this.toDomain(record)
  }

  async complete(
    id: string,
    userId: string,
    input: CompleteMaintenanceTaskInput,
  ): Promise<MaintenanceTask> {
    this.logger.info('Completing maintenance task', { id, userId })

    const task = await this.db.maintenanceTask.findUniqueOrThrow({ where: { id } })

    // Calculate next due date: completion date + intervalMonths
    const nextDueDate = new Date(input.date)
    nextDueDate.setMonth(nextDueDate.getMonth() + task.intervalMonths)

    // If the task has an item, create an Event record
    if (task.itemId) {
      await this.db.event.create({
        data: {
          itemId: task.itemId,
          type: 'maintenance',
          date: input.date,
          description: input.description ?? task.name,
          cost: input.cost ?? null,
          performedBy: input.performedBy ?? null,
          createdById: userId,
          updatedById: userId,
        },
      })
    }

    const record = await this.db.maintenanceTask.update({
      where: { id },
      data: {
        lastCompletedAt: input.date,
        nextDueDate,
        updatedById: userId,
      },
    })

    return this.toDomain(record)
  }

  async snooze(id: string, userId: string): Promise<MaintenanceTask> {
    this.logger.info('Snoozing maintenance task', { id, userId })

    const task = await this.db.maintenanceTask.findUniqueOrThrow({ where: { id } })

    const nextDueDate = new Date(task.nextDueDate)
    nextDueDate.setMonth(nextDueDate.getMonth() + task.intervalMonths)

    const record = await this.db.maintenanceTask.update({
      where: { id },
      data: {
        nextDueDate,
        updatedById: userId,
      },
    })

    return this.toDomain(record)
  }

  async delete(id: string): Promise<void> {
    this.logger.info('Deleting maintenance task', { id })
    await this.db.maintenanceTask.delete({ where: { id } })
  }

  private toDomain(record: PrismaMaintenanceTask): MaintenanceTask {
    return {
      id: record.id,
      propertyId: record.propertyId,
      itemId: record.itemId,
      name: record.name,
      description: record.description,
      intervalMonths: record.intervalMonths,
      nextDueDate: record.nextDueDate,
      lastCompletedAt: record.lastCompletedAt,
      source: record.source,
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }
  }

  private toDomainWithRelations(
    record: PrismaMaintenanceTask & {
      property?: { id: string; name: string }
      item?: { id: string; name: string } | null
    },
  ): MaintenanceTaskWithRelations {
    return {
      ...this.toDomain(record),
      property: record.property,
      item: record.item ?? undefined,
    }
  }
}
