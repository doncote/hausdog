import type { PrismaClient, Document as PrismaDocument } from '@generated/prisma/client'
import type { Logger } from '@/lib/logger'
import type {
  CreateDocumentInput,
  Document,
  DocumentWithRelations,
  UpdateDocumentInput,
} from './types'

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

  async findAllForProperty(propertyId: string): Promise<DocumentWithRelations[]> {
    this.logger.debug('Finding all documents for property', { propertyId })
    const records = await this.db.document.findMany({
      where: { propertyId },
      orderBy: { createdAt: 'desc' },
      include: {
        property: { select: { id: true, name: true } },
        item: { select: { id: true, name: true } },
        event: { select: { id: true, type: true, date: true } },
      },
    })
    return records.map((r) => this.toDomainWithRelations(r))
  }

  async findPendingReview(propertyId: string): Promise<DocumentWithRelations[]> {
    this.logger.debug('Finding documents pending review', { propertyId })
    const records = await this.db.document.findMany({
      where: {
        propertyId,
        status: 'ready_for_review',
      },
      orderBy: { createdAt: 'desc' },
      include: {
        property: { select: { id: true, name: true } },
        item: { select: { id: true, name: true } },
        event: { select: { id: true, type: true, date: true } },
      },
    })
    return records.map((r) => this.toDomainWithRelations(r))
  }

  async findById(id: string): Promise<DocumentWithRelations | null> {
    this.logger.debug('Finding document by id', { id })
    const record = await this.db.document.findUnique({
      where: { id },
      include: {
        property: { select: { id: true, name: true } },
        item: { select: { id: true, name: true } },
        event: { select: { id: true, type: true, date: true } },
      },
    })
    return record ? this.toDomainWithRelations(record) : null
  }

  async findByStatus(propertyId: string, status: string): Promise<DocumentWithRelations[]> {
    this.logger.debug('Finding documents by status', { propertyId, status })
    const records = await this.db.document.findMany({
      where: { propertyId, status },
      orderBy: { createdAt: 'desc' },
      include: {
        property: { select: { id: true, name: true } },
        item: { select: { id: true, name: true } },
        event: { select: { id: true, type: true, date: true } },
      },
    })
    return records.map((r) => this.toDomainWithRelations(r))
  }

  async create(userId: string, input: CreateDocumentInput): Promise<Document> {
    this.logger.info('Creating document', {
      userId,
      propertyId: input.propertyId,
      fileName: input.fileName,
      source: input.source || 'upload',
    })
    const record = await this.db.document.create({
      data: {
        propertyId: input.propertyId,
        itemId: input.itemId ?? null,
        eventId: input.eventId ?? null,
        type: input.type,
        fileName: input.fileName,
        storagePath: input.storagePath,
        contentType: input.contentType,
        sizeBytes: BigInt(input.sizeBytes),
        status: 'pending',
        source: input.source ?? 'upload',
        sourceEmail: input.sourceEmail ?? null,
        createdById: userId,
      },
    })
    return this.toDomain(record)
  }

  async createFromEmailBody(
    userId: string,
    propertyId: string,
    emailBody: string,
    sourceEmail: string,
    subject: string,
  ): Promise<Document> {
    this.logger.info('Creating document from email body', {
      userId,
      propertyId,
      sourceEmail,
      subject,
    })

    const fileName = `email-${Date.now()}.txt`

    const record = await this.db.document.create({
      data: {
        propertyId,
        type: 'email',
        fileName,
        storagePath: '',
        contentType: 'text/plain',
        sizeBytes: BigInt(emailBody.length),
        status: 'processing',
        extractedText: emailBody,
        source: 'email',
        sourceEmail,
        createdById: userId,
      },
    })
    return this.toDomain(record)
  }

  async update(id: string, input: UpdateDocumentInput): Promise<Document> {
    this.logger.info('Updating document', { id })
    const record = await this.db.document.update({
      where: { id },
      data: {
        ...(input.itemId !== undefined && { itemId: input.itemId }),
        ...(input.eventId !== undefined && { eventId: input.eventId }),
        ...(input.type !== undefined && { type: input.type }),
        ...(input.status !== undefined && { status: input.status }),
        ...(input.extractedText !== undefined && { extractedText: input.extractedText }),
        ...(input.extractedData !== undefined && { extractedData: input.extractedData }),
        ...(input.resolveData !== undefined && { resolveData: input.resolveData }),
        ...(input.documentDate !== undefined && { documentDate: input.documentDate }),
      },
    })
    return this.toDomain(record)
  }

  async updateStatus(id: string, status: string): Promise<Document> {
    this.logger.info('Updating document status', { id, status })
    const record = await this.db.document.update({
      where: { id },
      data: { status },
    })
    return this.toDomain(record)
  }

  async delete(id: string): Promise<void> {
    this.logger.info('Deleting document', { id })
    await this.db.document.delete({ where: { id } })
  }

  private toDomain(record: PrismaDocument): Document {
    return {
      id: record.id,
      propertyId: record.propertyId,
      itemId: record.itemId,
      eventId: record.eventId,
      type: record.type,
      fileName: record.fileName,
      storagePath: record.storagePath,
      contentType: record.contentType,
      sizeBytes: Number(record.sizeBytes),
      status: record.status,
      extractedText: record.extractedText,
      extractedData: record.extractedData,
      resolveData: record.resolveData,
      documentDate: record.documentDate,
      source: record.source,
      sourceEmail: record.sourceEmail,
      createdAt: record.createdAt,
    }
  }

  private toDomainWithRelations(
    record: PrismaDocument & {
      property?: { id: string; name: string }
      item?: { id: string; name: string } | null
      event?: { id: string; type: string; date: Date } | null
    },
  ): DocumentWithRelations {
    return {
      ...this.toDomain(record),
      property: record.property,
      item: record.item,
      event: record.event,
    }
  }
}
