import type { PrismaClient, Category as PrismaCategory } from '@generated/prisma/client'
import type { Logger } from '@/lib/console-logger'
import type { Category, CreateCategoryInput, UpdateCategoryInput } from './types'

export interface CategoryServiceDeps {
  db: PrismaClient
  logger: Logger
}

export class CategoryService {
  private db: PrismaClient
  private logger: Logger

  constructor(deps: CategoryServiceDeps) {
    this.db = deps.db
    this.logger = deps.logger
  }

  async findAllForUser(userId: string): Promise<Category[]> {
    this.logger.debug('Finding all categories for user', { userId })
    const records = await this.db.category.findMany({
      where: {
        OR: [{ isSystem: true }, { userId }],
      },
      orderBy: [{ isSystem: 'desc' }, { name: 'asc' }],
    })
    return records.map((r) => this.toDomain(r))
  }

  async findById(id: string): Promise<Category | null> {
    this.logger.debug('Finding category by id', { id })
    const record = await this.db.category.findUnique({ where: { id } })
    return record ? this.toDomain(record) : null
  }

  async create(userId: string, input: CreateCategoryInput): Promise<Category> {
    this.logger.info('Creating category', { userId, slug: input.slug })
    const record = await this.db.category.create({
      data: {
        slug: input.slug,
        name: input.name,
        icon: input.icon ?? null,
        isSystem: false,
        userId,
      },
    })
    return this.toDomain(record)
  }

  async update(id: string, input: UpdateCategoryInput): Promise<Category> {
    this.logger.info('Updating category', { id })
    const record = await this.db.category.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.icon !== undefined && { icon: input.icon ?? null }),
      },
    })
    return this.toDomain(record)
  }

  async delete(id: string): Promise<void> {
    this.logger.info('Deleting category', { id })
    await this.db.category.delete({ where: { id } })
  }

  async isSlugTaken(slug: string, userId: string): Promise<boolean> {
    const count = await this.db.category.count({
      where: {
        slug,
        OR: [{ isSystem: true }, { userId }],
      },
    })
    return count > 0
  }

  async isCategoryInUse(slug: string): Promise<boolean> {
    const count = await this.db.item.count({ where: { category: slug } })
    return count > 0
  }

  private toDomain(record: PrismaCategory): Category {
    return {
      id: record.id,
      slug: record.slug,
      name: record.name,
      icon: record.icon,
      isSystem: record.isSystem,
      userId: record.userId,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }
  }
}
