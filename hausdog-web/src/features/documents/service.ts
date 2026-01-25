import type { PrismaClient, documents as PrismaDocument } from '@generated/prisma/client'
import type { Document, CreateDocumentInput, ExtractedData } from '@hausdog/domain/documents'
import type { Logger } from '@/lib/logger'

export interface DocumentServiceDeps {
  db: PrismaClient
  logger: Logger
}

export class DocumentService {
  private db: PrismaClient
  private logger: Logger

  constructor(deps: DocumentServiceDeps) {
    this.db = deps.db
    this.logger = deps.logger
  }

  async findAllForUser(userId: string): Promise<Document[]> {
    this.logger.debug('Finding all documents for user', { userId })

    const records = await this.db.documents.findMany({
      where: { user_id: userId },
      orderBy: { created_at: 'desc' },
    })

    return records.map((r) => this.toDomain(r))
  }

  async findAllForProperty(propertyId: string, userId: string): Promise<Document[]> {
    this.logger.debug('Finding documents for property', { propertyId, userId })

    // Verify property ownership
    const property = await this.db.properties.findFirst({
      where: { id: propertyId, user_id: userId },
      select: { id: true },
    })
    if (!property) {
      throw new Error('Property not found')
    }

    const records = await this.db.documents.findMany({
      where: { property_id: propertyId },
      orderBy: { created_at: 'desc' },
    })

    return records.map((r) => this.toDomain(r))
  }

  async findAllForSystem(systemId: string, userId: string): Promise<Document[]> {
    this.logger.debug('Finding documents for system', { systemId, userId })

    // Verify system ownership via property
    const system = await this.db.systems.findFirst({
      where: { id: systemId, properties: { user_id: userId } },
      select: { id: true },
    })
    if (!system) {
      throw new Error('System not found')
    }

    const records = await this.db.documents.findMany({
      where: { system_id: systemId },
      orderBy: { created_at: 'desc' },
    })

    return records.map((r) => this.toDomain(r))
  }

  async findById(id: string, userId: string): Promise<Document | null> {
    this.logger.debug('Finding document by id', { id, userId })

    const record = await this.db.documents.findFirst({
      where: { id, user_id: userId },
    })

    return record ? this.toDomain(record) : null
  }

  async create(userId: string, input: CreateDocumentInput): Promise<Document> {
    this.logger.info('Creating document', { userId, filename: input.filename })

    // Verify ownership if linking to property/system/component
    if (input.propertyId) {
      const property = await this.db.properties.findFirst({
        where: { id: input.propertyId, user_id: userId },
        select: { id: true },
      })
      if (!property) throw new Error('Property not found')
    }

    if (input.systemId) {
      const system = await this.db.systems.findFirst({
        where: { id: input.systemId, properties: { user_id: userId } },
        select: { id: true },
      })
      if (!system) throw new Error('System not found')
    }

    if (input.componentId) {
      const component = await this.db.components.findFirst({
        where: { id: input.componentId, systems: { properties: { user_id: userId } } },
        select: { id: true },
      })
      if (!component) throw new Error('Component not found')
    }

    const record = await this.db.documents.create({
      data: {
        user_id: userId,
        property_id: input.propertyId ?? null,
        system_id: input.systemId ?? null,
        component_id: input.componentId ?? null,
        filename: input.filename,
        storage_path: input.storagePath,
        content_type: input.contentType,
        size_bytes: BigInt(input.sizeBytes),
        processing_status: 'pending',
        retry_count: 0,
      },
    })

    return this.toDomain(record)
  }

  async updateExtractedData(id: string, userId: string, extractedData: ExtractedData): Promise<Document> {
    this.logger.info('Updating document extracted data', { id, userId })

    const existing = await this.db.documents.findFirst({
      where: { id, user_id: userId },
    })
    if (!existing) {
      throw new Error('Document not found')
    }

    const record = await this.db.documents.update({
      where: { id },
      data: {
        extracted_data: extractedData as object,
        processing_status: 'complete',
        processed_at: new Date(),
        updated_at: new Date(),
      },
    })

    return this.toDomain(record)
  }

  async updateStatus(id: string, userId: string, status: string, retryCount?: number): Promise<Document> {
    this.logger.info('Updating document status', { id, userId, status })

    const existing = await this.db.documents.findFirst({
      where: { id, user_id: userId },
    })
    if (!existing) {
      throw new Error('Document not found')
    }

    const record = await this.db.documents.update({
      where: { id },
      data: {
        processing_status: status,
        ...(retryCount !== undefined && { retry_count: retryCount }),
        updated_at: new Date(),
      },
    })

    return this.toDomain(record)
  }

  async delete(id: string, userId: string): Promise<void> {
    this.logger.info('Deleting document', { id, userId })

    const existing = await this.db.documents.findFirst({
      where: { id, user_id: userId },
    })
    if (!existing) {
      throw new Error('Document not found')
    }

    await this.db.documents.delete({ where: { id } })
  }

  private toDomain(record: PrismaDocument): Document {
    return {
      id: record.id,
      userId: record.user_id,
      propertyId: record.property_id,
      systemId: record.system_id,
      componentId: record.component_id,
      filename: record.filename,
      storagePath: record.storage_path,
      contentType: record.content_type,
      sizeBytes: Number(record.size_bytes),
      extractedData: record.extracted_data as ExtractedData | null,
      processingStatus: record.processing_status as 'pending' | 'processing' | 'complete' | 'failed',
      retryCount: record.retry_count,
      processedAt: record.processed_at,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    }
  }
}
