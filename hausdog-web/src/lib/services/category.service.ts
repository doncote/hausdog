import type { categories as PrismaCategory, PrismaClient } from '@generated/prisma/client'
import type { Category } from '../domain/category'
import type { Logger } from '../logger'

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

  async findAll(): Promise<Category[]> {
    this.logger.debug('Finding all categories')
    const records = await this.db.categories.findMany({
      orderBy: { sort_order: 'asc' },
    })
    return records.map(this.toDomain)
  }

  async findById(id: string): Promise<Category | null> {
    this.logger.debug('Finding category by id', { id })
    const record = await this.db.categories.findUnique({
      where: { id },
    })
    return record ? this.toDomain(record) : null
  }

  async findByName(name: string): Promise<Category | null> {
    this.logger.debug('Finding category by name', { name })
    const record = await this.db.categories.findUnique({
      where: { name },
    })
    return record ? this.toDomain(record) : null
  }

  private toDomain(record: PrismaCategory): Category {
    return {
      id: record.id,
      name: record.name,
      icon: record.icon,
      sortOrder: record.sort_order,
    }
  }
}
