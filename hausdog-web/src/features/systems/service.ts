import type { PrismaClient, systems as PrismaSystem, categories as PrismaCategory } from '@generated/prisma/client'
import type {
  CreateSystemInput,
  System,
  SystemWithCategory,
  SystemWithCounts,
  UpdateSystemInput,
} from '@hausdog/domain/systems'
import type { Category } from '@hausdog/domain/categories'
import type { Logger } from '@/lib/logger'

export interface SystemServiceDeps {
  db: PrismaClient
  logger: Logger
}

type PrismaSystemWithCategory = PrismaSystem & {
  categories: PrismaCategory
}

type PrismaSystemWithCounts = PrismaSystem & {
  categories: PrismaCategory
  _count: {
    components: number
    documents: number
  }
}

export class SystemService {
  private db: PrismaClient
  private logger: Logger

  constructor(deps: SystemServiceDeps) {
    this.db = deps.db
    this.logger = deps.logger
  }

  async findAllForProperty(propertyId: string, userId: string): Promise<SystemWithCounts[]> {
    this.logger.debug('Finding all systems for property', { propertyId, userId })

    // Verify property ownership
    const property = await this.db.properties.findFirst({
      where: { id: propertyId, user_id: userId },
      select: { id: true },
    })
    if (!property) {
      throw new Error('Property not found')
    }

    const records = await this.db.systems.findMany({
      where: { property_id: propertyId },
      orderBy: [{ categories: { sort_order: 'asc' } }, { name: 'asc' }],
      include: {
        categories: true,
        _count: {
          select: { components: true, documents: true },
        },
      },
    })

    return records.map((r) => this.toDomainWithCounts(r))
  }

  async findById(id: string, userId: string): Promise<SystemWithCategory | null> {
    this.logger.debug('Finding system by id', { id, userId })

    const record = await this.db.systems.findFirst({
      where: {
        id,
        properties: { user_id: userId },
      },
      include: { categories: true },
    })

    return record ? this.toDomainWithCategory(record) : null
  }

  async create(userId: string, input: CreateSystemInput): Promise<System> {
    this.logger.info('Creating system', { userId, propertyId: input.propertyId, name: input.name })

    // Verify property ownership
    const property = await this.db.properties.findFirst({
      where: { id: input.propertyId, user_id: userId },
      select: { id: true },
    })
    if (!property) {
      throw new Error('Property not found')
    }

    const record = await this.db.systems.create({
      data: {
        property_id: input.propertyId,
        category_id: input.categoryId,
        name: input.name,
        manufacturer: input.manufacturer ?? null,
        model: input.model ?? null,
        serial_number: input.serialNumber ?? null,
        install_date: input.installDate ?? null,
        warranty_expires: input.warrantyExpires ?? null,
        notes: input.notes ?? null,
      },
    })

    return this.toDomain(record)
  }

  async update(id: string, userId: string, input: UpdateSystemInput): Promise<System> {
    this.logger.info('Updating system', { id, userId })

    // Verify ownership via property
    const existing = await this.db.systems.findFirst({
      where: {
        id,
        properties: { user_id: userId },
      },
    })
    if (!existing) {
      throw new Error('System not found')
    }

    const record = await this.db.systems.update({
      where: { id },
      data: {
        ...(input.categoryId !== undefined && { category_id: input.categoryId }),
        ...(input.name !== undefined && { name: input.name }),
        ...(input.manufacturer !== undefined && { manufacturer: input.manufacturer ?? null }),
        ...(input.model !== undefined && { model: input.model ?? null }),
        ...(input.serialNumber !== undefined && { serial_number: input.serialNumber ?? null }),
        ...(input.installDate !== undefined && { install_date: input.installDate ?? null }),
        ...(input.warrantyExpires !== undefined && { warranty_expires: input.warrantyExpires ?? null }),
        ...(input.notes !== undefined && { notes: input.notes ?? null }),
        updated_at: new Date(),
      },
    })

    return this.toDomain(record)
  }

  async delete(id: string, userId: string): Promise<void> {
    this.logger.info('Deleting system', { id, userId })

    // Verify ownership via property
    const existing = await this.db.systems.findFirst({
      where: {
        id,
        properties: { user_id: userId },
      },
    })
    if (!existing) {
      throw new Error('System not found')
    }

    await this.db.systems.delete({ where: { id } })
  }

  private toDomain(record: PrismaSystem): System {
    return {
      id: record.id,
      propertyId: record.property_id,
      categoryId: record.category_id,
      name: record.name,
      manufacturer: record.manufacturer,
      model: record.model,
      serialNumber: record.serial_number,
      installDate: record.install_date,
      warrantyExpires: record.warranty_expires,
      notes: record.notes,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    }
  }

  private categoryToDomain(record: PrismaCategory): Category {
    return {
      id: record.id,
      name: record.name,
      icon: record.icon,
      sortOrder: record.sort_order,
    }
  }

  private toDomainWithCategory(record: PrismaSystemWithCategory): SystemWithCategory {
    return {
      ...this.toDomain(record),
      category: this.categoryToDomain(record.categories),
    }
  }

  private toDomainWithCounts(record: PrismaSystemWithCounts): SystemWithCounts {
    return {
      ...this.toDomain(record),
      category: this.categoryToDomain(record.categories),
      _count: {
        components: record._count.components,
        documents: record._count.documents,
      },
    }
  }
}
