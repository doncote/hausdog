import type { PrismaClient, Property as PrismaProperty } from '@generated/prisma/client'
import type { Logger } from '@/lib/logger'
import type { CreatePropertyInput, Property, PropertyWithCounts, UpdatePropertyInput } from './types'

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
    const records = await this.db.property.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })
    return records.map((r) => this.toDomain(r))
  }

  async findAllForUserWithCounts(userId: string): Promise<PropertyWithCounts[]> {
    this.logger.debug('Finding all properties with counts for user', { userId })
    const records = await this.db.property.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { items: true, spaces: true },
        },
      },
    })
    return records.map((r) => ({
      ...this.toDomain(r),
      _count: { items: r._count.items, spaces: r._count.spaces },
    }))
  }

  async findById(id: string, userId: string): Promise<Property | null> {
    this.logger.debug('Finding property by id', { id, userId })
    const record = await this.db.property.findFirst({
      where: { id, userId },
    })
    return record ? this.toDomain(record) : null
  }

  async create(userId: string, input: CreatePropertyInput): Promise<Property> {
    this.logger.info('Creating property', { userId, name: input.name })
    const record = await this.db.property.create({
      data: {
        userId,
        name: input.name,
        address: input.address ?? null,
        yearBuilt: input.yearBuilt ?? null,
        squareFeet: input.squareFeet ?? null,
        propertyType: input.propertyType ?? null,
        purchaseDate: input.purchaseDate ?? null,
        createdById: userId,
        updatedById: userId,
      },
    })
    return this.toDomain(record)
  }

  async update(id: string, userId: string, input: UpdatePropertyInput): Promise<Property> {
    this.logger.info('Updating property', { id, userId })
    const record = await this.db.property.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.address !== undefined && { address: input.address ?? null }),
        ...(input.yearBuilt !== undefined && { yearBuilt: input.yearBuilt ?? null }),
        ...(input.squareFeet !== undefined && { squareFeet: input.squareFeet ?? null }),
        ...(input.propertyType !== undefined && { propertyType: input.propertyType ?? null }),
        ...(input.purchaseDate !== undefined && { purchaseDate: input.purchaseDate ?? null }),
        updatedById: userId,
      },
    })
    return this.toDomain(record)
  }

  async delete(id: string, userId: string): Promise<void> {
    this.logger.info('Deleting property', { id, userId })
    await this.db.property.delete({
      where: { id },
    })
  }

  private toDomain(record: PrismaProperty): Property {
    return {
      id: record.id,
      userId: record.userId,
      name: record.name,
      address: record.address,
      yearBuilt: record.yearBuilt,
      squareFeet: record.squareFeet,
      propertyType: record.propertyType,
      purchaseDate: record.purchaseDate,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }
  }
}
