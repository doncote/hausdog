import type { PrismaClient, components as PrismaComponent } from '@generated/prisma/client'
import type {
  Component,
  CreateComponentInput,
  UpdateComponentInput,
} from '@hausdog/domain/components'
import type { Logger } from '@/lib/logger'

export interface ComponentServiceDeps {
  db: PrismaClient
  logger: Logger
}

export class ComponentService {
  private db: PrismaClient
  private logger: Logger

  constructor(deps: ComponentServiceDeps) {
    this.db = deps.db
    this.logger = deps.logger
  }

  async findAllForSystem(systemId: string, userId: string): Promise<Component[]> {
    this.logger.debug('Finding all components for system', { systemId, userId })

    // Verify system ownership via property
    const system = await this.db.systems.findFirst({
      where: { id: systemId, properties: { user_id: userId } },
      select: { id: true },
    })
    if (!system) {
      throw new Error('System not found')
    }

    const records = await this.db.components.findMany({
      where: { system_id: systemId },
      orderBy: { name: 'asc' },
    })

    return records.map((r) => this.toDomain(r))
  }

  async findById(id: string, userId: string): Promise<Component | null> {
    this.logger.debug('Finding component by id', { id, userId })

    const record = await this.db.components.findFirst({
      where: {
        id,
        systems: { properties: { user_id: userId } },
      },
    })

    return record ? this.toDomain(record) : null
  }

  async create(userId: string, input: CreateComponentInput): Promise<Component> {
    this.logger.info('Creating component', { userId, systemId: input.systemId, name: input.name })

    // Verify system ownership via property
    const system = await this.db.systems.findFirst({
      where: { id: input.systemId, properties: { user_id: userId } },
      select: { id: true },
    })
    if (!system) {
      throw new Error('System not found')
    }

    const record = await this.db.components.create({
      data: {
        system_id: input.systemId,
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

  async update(id: string, userId: string, input: UpdateComponentInput): Promise<Component> {
    this.logger.info('Updating component', { id, userId })

    // Verify ownership via system -> property
    const existing = await this.db.components.findFirst({
      where: {
        id,
        systems: { properties: { user_id: userId } },
      },
    })
    if (!existing) {
      throw new Error('Component not found')
    }

    const record = await this.db.components.update({
      where: { id },
      data: {
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
    this.logger.info('Deleting component', { id, userId })

    // Verify ownership via system -> property
    const existing = await this.db.components.findFirst({
      where: {
        id,
        systems: { properties: { user_id: userId } },
      },
    })
    if (!existing) {
      throw new Error('Component not found')
    }

    await this.db.components.delete({ where: { id } })
  }

  private toDomain(record: PrismaComponent): Component {
    return {
      id: record.id,
      systemId: record.system_id,
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
}
