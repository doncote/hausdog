import type { PrismaClient, components as PrismaComponent } from '@generated/prisma/client'
import type { Component, CreateComponentInput, UpdateComponentInput } from '../domain/component'
import type { Logger } from '../logger'

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

  async findAllForSystem(systemId: string): Promise<Component[]> {
    this.logger.debug('Finding all components for system', { systemId })
    const records = await this.db.components.findMany({
      where: { system_id: systemId },
      orderBy: { created_at: 'desc' },
    })
    return records.map(this.toDomain)
  }

  async findById(id: string): Promise<Component | null> {
    this.logger.debug('Finding component by id', { id })
    const record = await this.db.components.findUnique({
      where: { id },
    })
    return record ? this.toDomain(record) : null
  }

  async create(input: CreateComponentInput): Promise<Component> {
    this.logger.info('Creating component', { systemId: input.systemId, name: input.name })
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

  async update(id: string, input: UpdateComponentInput): Promise<Component> {
    this.logger.info('Updating component', { id })
    const record = await this.db.components.update({
      where: { id },
      data: {
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
    this.logger.info('Deleting component', { id })
    await this.db.components.delete({
      where: { id },
    })
  }

  private toDomain(record: PrismaComponent): Component {
    return {
      id: record.id,
      systemId: record.system_id,
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
}
