import type { PrismaClient } from '@generated/prisma/client'
import type {
  ActivityAction,
  ActivityEntityType,
  ActivityEvent,
  RecordActivityInput,
} from './types'

export class ActivityService {
  constructor(private db: PrismaClient) {}

  async record(input: RecordActivityInput): Promise<void> {
    await this.db.propertyActivity.create({
      data: {
        propertyId: input.propertyId,
        userId: input.userId,
        action: input.action,
        entityType: input.entityType,
        entityId: input.entityId,
        entityName: input.entityName ?? null,
        metadata: input.metadata ?? undefined,
      },
    })
  }

  async findRecent(propertyId: string, limit = 50): Promise<ActivityEvent[]> {
    const records = await this.db.propertyActivity.findMany({
      where: { propertyId },
      orderBy: { createdAt: 'desc' },
      take: limit,
    })
    return records.map((r) => ({
      id: r.id,
      propertyId: r.propertyId,
      userId: r.userId,
      action: r.action as ActivityAction,
      entityType: r.entityType as ActivityEntityType,
      entityId: r.entityId,
      entityName: r.entityName,
      metadata: r.metadata as Record<string, unknown> | null,
      createdAt: r.createdAt,
    }))
  }
}
