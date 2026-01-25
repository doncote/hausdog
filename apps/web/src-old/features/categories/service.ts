import type { PrismaClient, categories as PrismaCategory } from '@generated/prisma/client'
import type { Category } from '@hausdog/domain/categories'
import type { Logger } from '@/lib/logger'

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
    return records.map((r) => this.toDomain(r))
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
