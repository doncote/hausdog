import type { PrismaClient, properties as PrismaProperty } from '@generated/prisma/client'
import type {
  CreatePropertyInput,
  Property,
  PropertyWithCounts,
  UpdatePropertyInput,
} from '@hausdog/domain/properties'
import type { Logger } from '@/lib/logger'

export interface PropertyServiceDeps {
  db: PrismaClient
  logger: Logger
}

export class PropertyService {
  private db: PrismaClient
  private logger: Logger

  constructor(deps: PropertyServiceDeps) {
    this.db = deps.db
    this.logger = deps.logger
  }

  async findAllForUser(userId: string): Promise<Property[]> {
    this.logger.debug('Finding all properties for user', { userId })
    const records = await this.db.properties.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    })
    return records.map(this.toDomain)
  }

  async findAllForUserWithCounts(userId: string): Promise<PropertyWithCounts[]> {
    this.logger.debug('Finding all properties with counts for user', { userId })
    const records = await this.db.properties.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
      include: {
        _count: {
          select: { systems: true },
        },
      },
    })
    return records.map((r) => ({
      ...this.toDomain(r),
      _count: { systems: r._count.systems },
    }))
  }

  async findById(id: string, userId: string): Promise<Property | null> {
    this.logger.debug('Finding property by id', { id, userId })
    const record = await this.db.properties.findFirst({
      where: { id, user_id: userId },
    })
    return record ? this.toDomain(record) : null
  }

  async create(userId: string, input: CreatePropertyInput): Promise<Property> {
    this.logger.info('Creating property', { userId, name: input.name })
    const record = await this.db.properties.create({
      data: {
        user_id: userId,
        name: input.name,
        address: input.address ?? null,
      },
    })
    return this.toDomain(record)
  }

  async update(id: string, userId: string, input: UpdatePropertyInput): Promise<Property> {
    this.logger.info('Updating property', { id, userId })
    const record = await this.db.properties.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.address !== undefined && { address: input.address ?? null }),
        updated_at: new Date(),
      },
    })
    return this.toDomain(record)
  }

  async delete(id: string, userId: string): Promise<void> {
    this.logger.info('Deleting property', { id, userId })
    await this.db.properties.delete({
      where: { id },
    })
  }

  private toDomain(record: PrismaProperty): Property {
    return {
      id: record.id,
      userId: record.user_id,
      name: record.name,
      address: record.address,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    }
  }
}
