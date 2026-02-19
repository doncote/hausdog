import type { PrismaClient, Item as PrismaItem } from '@generated/prisma/client'
import type { Logger } from '@/lib/console-logger'
import type { CreateItemInput, Item, ItemWithRelations, UpdateItemInput } from './types'

export interface ItemServiceDeps {
  db: PrismaClient
  logger: Logger
}

export class ItemService {
  private db: PrismaClient
  private logger: Logger

  constructor(deps: ItemServiceDeps) {
    this.db = deps.db
    this.logger = deps.logger
  }

  async findAllForProperty(propertyId: string): Promise<ItemWithRelations[]> {
    this.logger.debug('Finding all items for property', { propertyId })
    const records = await this.db.item.findMany({
      where: { propertyId },
      orderBy: { createdAt: 'desc' },
      include: {
        space: { select: { id: true, name: true } },
        parent: { select: { id: true, name: true } },
        _count: { select: { events: true, documents: true, children: true } },
      },
    })
    return records.map((r) => this.toDomainWithRelations(r))
  }

  async findRootItemsForProperty(propertyId: string): Promise<ItemWithRelations[]> {
    this.logger.debug('Finding root items for property', { propertyId })
    const records = await this.db.item.findMany({
      where: { propertyId, parentId: null },
      orderBy: { createdAt: 'desc' },
      include: {
        space: { select: { id: true, name: true } },
        _count: { select: { events: true, documents: true, children: true } },
      },
    })
    return records.map((r) => this.toDomainWithRelations(r))
  }

  async findAllForSpace(spaceId: string): Promise<ItemWithRelations[]> {
    this.logger.debug('Finding all items for space', { spaceId })
    const records = await this.db.item.findMany({
      where: { spaceId },
      orderBy: { createdAt: 'desc' },
      include: {
        space: { select: { id: true, name: true } },
        parent: { select: { id: true, name: true } },
        _count: { select: { events: true, documents: true, children: true } },
      },
    })
    return records.map((r) => this.toDomainWithRelations(r))
  }

  async findById(id: string): Promise<ItemWithRelations | null> {
    this.logger.debug('Finding item by id', { id })
    const record = await this.db.item.findUnique({
      where: { id },
      include: {
        space: { select: { id: true, name: true } },
        parent: { select: { id: true, name: true } },
        children: true,
        _count: { select: { events: true, documents: true, children: true } },
      },
    })
    return record ? this.toDomainWithRelations(record) : null
  }

  async findChildrenForItem(itemId: string): Promise<ItemWithRelations[]> {
    this.logger.debug('Finding children for item', { itemId })
    const records = await this.db.item.findMany({
      where: { parentId: itemId },
      orderBy: { name: 'asc' },
      include: {
        space: { select: { id: true, name: true } },
        parent: { select: { id: true, name: true } },
        _count: { select: { events: true, documents: true, children: true } },
      },
    })
    return records.map((r) => this.toDomainWithRelations(r))
  }

  async create(userId: string, input: CreateItemInput): Promise<Item> {
    this.logger.info('Creating item', { userId, name: input.name, propertyId: input.propertyId })
    const record = await this.db.item.create({
      data: {
        propertyId: input.propertyId,
        spaceId: input.spaceId ?? null,
        parentId: input.parentId ?? null,
        name: input.name,
        description: input.description ?? null,
        category: input.category,
        manufacturer: input.manufacturer ?? null,
        model: input.model ?? null,
        serialNumber: input.serialNumber ?? null,
        acquiredDate: input.acquiredDate ?? null,
        warrantyExpires: input.warrantyExpires ?? null,
        purchasePrice: input.purchasePrice ?? null,
        notes: input.notes ?? null,
        createdById: userId,
        updatedById: userId,
      },
    })
    return this.toDomain(record)
  }

  async update(id: string, userId: string, input: UpdateItemInput): Promise<Item> {
    this.logger.info('Updating item', { id, userId })
    const record = await this.db.item.update({
      where: { id },
      data: {
        ...(input.spaceId !== undefined && { spaceId: input.spaceId ?? null }),
        ...(input.parentId !== undefined && { parentId: input.parentId ?? null }),
        ...(input.name !== undefined && { name: input.name }),
        ...(input.description !== undefined && { description: input.description ?? null }),
        ...(input.category !== undefined && { category: input.category }),
        ...(input.manufacturer !== undefined && { manufacturer: input.manufacturer ?? null }),
        ...(input.model !== undefined && { model: input.model ?? null }),
        ...(input.serialNumber !== undefined && { serialNumber: input.serialNumber ?? null }),
        ...(input.acquiredDate !== undefined && { acquiredDate: input.acquiredDate ?? null }),
        ...(input.warrantyExpires !== undefined && {
          warrantyExpires: input.warrantyExpires ?? null,
        }),
        ...(input.purchasePrice !== undefined && { purchasePrice: input.purchasePrice ?? null }),
        ...(input.notes !== undefined && { notes: input.notes ?? null }),
        updatedById: userId,
      },
    })
    return this.toDomain(record)
  }

  async delete(id: string): Promise<void> {
    this.logger.info('Deleting item', { id })
    await this.db.item.delete({ where: { id } })
  }

  private toDomain(record: PrismaItem): Item {
    return {
      id: record.id,
      propertyId: record.propertyId,
      spaceId: record.spaceId,
      parentId: record.parentId,
      name: record.name,
      description: record.description,
      category: record.category,
      manufacturer: record.manufacturer,
      model: record.model,
      serialNumber: record.serialNumber,
      acquiredDate: record.acquiredDate,
      warrantyExpires: record.warrantyExpires,
      purchasePrice: record.purchasePrice ? Number(record.purchasePrice) : null,
      notes: record.notes,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }
  }

  private toDomainWithRelations(
    record: PrismaItem & {
      space?: { id: string; name: string } | null
      parent?: { id: string; name: string } | null
      children?: PrismaItem[]
      _count?: { events: number; documents: number; children: number }
    },
  ): ItemWithRelations {
    return {
      ...this.toDomain(record),
      space: record.space,
      parent: record.parent,
      children: record.children?.map((c) => this.toDomain(c)),
      _count: record._count,
    }
  }
}
