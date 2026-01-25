import type { PrismaClient, Space as PrismaSpace } from '@generated/prisma/client'
import type { Logger } from '@/lib/logger'
import type { CreateSpaceInput, Space, SpaceWithCounts, UpdateSpaceInput } from './types'

export interface SpaceServiceDeps {
  db: PrismaClient
  logger: Logger
}

export class SpaceService {
  private db: PrismaClient
  private logger: Logger

  constructor(deps: SpaceServiceDeps) {
    this.db = deps.db
    this.logger = deps.logger
  }

  async findAllForProperty(propertyId: string): Promise<SpaceWithCounts[]> {
    this.logger.debug('Finding all spaces for property', { propertyId })
    const records = await this.db.space.findMany({
      where: { propertyId },
      orderBy: { name: 'asc' },
      include: {
        _count: { select: { items: true } },
      },
    })
    return records.map((r) => this.toDomainWithCounts(r))
  }

  async findById(id: string): Promise<Space | null> {
    this.logger.debug('Finding space by id', { id })
    const record = await this.db.space.findUnique({
      where: { id },
    })
    return record ? this.toDomain(record) : null
  }

  async create(userId: string, input: CreateSpaceInput): Promise<Space> {
    this.logger.info('Creating space', { userId, name: input.name, propertyId: input.propertyId })
    const record = await this.db.space.create({
      data: {
        propertyId: input.propertyId,
        name: input.name,
        createdById: userId,
        updatedById: userId,
      },
    })
    return this.toDomain(record)
  }

  async update(id: string, userId: string, input: UpdateSpaceInput): Promise<Space> {
    this.logger.info('Updating space', { id, userId })
    const record = await this.db.space.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        updatedById: userId,
      },
    })
    return this.toDomain(record)
  }

  async delete(id: string): Promise<void> {
    this.logger.info('Deleting space', { id })
    await this.db.space.delete({ where: { id } })
  }

  private toDomain(record: PrismaSpace): Space {
    return {
      id: record.id,
      propertyId: record.propertyId,
      name: record.name,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }
  }

  private toDomainWithCounts(
    record: PrismaSpace & {
      _count?: { items: number }
    },
  ): SpaceWithCounts {
    return {
      ...this.toDomain(record),
      _count: record._count,
    }
  }
}
