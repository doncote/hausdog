import type {
  categories as PrismaCategory,
  PrismaClient,
  systems as PrismaSystem,
} from '@generated/prisma/client'
import type { Category } from '../domain/category'
import type {
  CreateSystemInput,
  System,
  SystemWithCategory,
  SystemWithComponents,
  UpdateSystemInput,
} from '../domain/system'
import type { Logger } from '../logger'

export interface SystemServiceDeps {
  db: PrismaClient
  logger: Logger
}

export class SystemService {
  private db: PrismaClient
  private logger: Logger

  constructor(deps: SystemServiceDeps) {
    this.db = deps.db
    this.logger = deps.logger
  }

  async findAllForProperty(propertyId: string): Promise<SystemWithCategory[]> {
    this.logger.debug('Finding all systems for property', { propertyId })
    const records = await this.db.systems.findMany({
      where: { property_id: propertyId },
      include: { categories: true },
      orderBy: { created_at: 'desc' },
    })
    return records.map((r) => ({
      ...this.toDomain(r),
      category: r.categories ? this.categoryToDomain(r.categories) : undefined,
    }))
  }

  async findAllForPropertyWithCounts(propertyId: string): Promise<SystemWithComponents[]> {
    this.logger.debug('Finding all systems with counts for property', { propertyId })
    const records = await this.db.systems.findMany({
      where: { property_id: propertyId },
      include: {
        categories: true,
        _count: {
          select: { components: true, documents: true },
        },
      },
      orderBy: [{ categories: { sort_order: 'asc' } }, { name: 'asc' }],
    })
    return records.map((r) => ({
      ...this.toDomain(r),
      category: r.categories ? this.categoryToDomain(r.categories) : undefined,
      _count: { components: r._count.components, documents: r._count.documents },
    }))
  }

  async findById(id: string): Promise<SystemWithCategory | null> {
    this.logger.debug('Finding system by id', { id })
    const record = await this.db.systems.findUnique({
      where: { id },
      include: { categories: true },
    })
    if (!record) return null
    return {
      ...this.toDomain(record),
      category: record.categories ? this.categoryToDomain(record.categories) : undefined,
    }
  }

  async create(input: CreateSystemInput): Promise<System> {
    this.logger.info('Creating system', { propertyId: input.propertyId, name: input.name })
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

  async update(id: string, input: UpdateSystemInput): Promise<System> {
    this.logger.info('Updating system', { id })
    const record = await this.db.systems.update({
      where: { id },
      data: {
        ...(input.categoryId !== undefined && { category_id: input.categoryId }),
        ...(input.name !== undefined && { name: input.name }),
        ...(input.manufacturer !== undefined && { manufacturer: input.manufacturer ?? null }),
        ...(input.model !== undefined && { model: input.model ?? null }),
        ...(input.serialNumber !== undefined && { serial_number: input.serialNumber ?? null }),
        ...(input.installDate !== undefined && { install_date: input.installDate ?? null }),
        ...(input.warrantyExpires !== undefined && {
          warranty_expires: input.warrantyExpires ?? null,
        }),
        ...(input.notes !== undefined && { notes: input.notes ?? null }),
        updated_at: new Date(),
      },
    })
    return this.toDomain(record)
  }

  async delete(id: string): Promise<void> {
    this.logger.info('Deleting system', { id })
    await this.db.systems.delete({
      where: { id },
    })
  }

  private toDomain(record: PrismaSystem): System {
    return {
      id: record.id,
      propertyId: record.property_id,
      categoryId: record.category_id,
      name: record.name,
      manufacturer: record.manufacturer ?? undefined,
      model: record.model ?? undefined,
      serialNumber: record.serial_number ?? undefined,
      installDate: record.install_date ?? undefined,
      warrantyExpires: record.warranty_expires ?? undefined,
      notes: record.notes ?? undefined,
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
}
