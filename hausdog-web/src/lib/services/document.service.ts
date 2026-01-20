import type { PrismaClient, documents as PrismaDocument } from '@generated/prisma/client'
import type { SupabaseClient } from '@supabase/supabase-js'
import type {
  CreateDocumentInput,
  Document,
  ExtractedData,
  UpdateDocumentInput,
} from '../domain/document'
import type { Logger } from '../logger'

export interface DocumentServiceDeps {
  db: PrismaClient
  logger: Logger
  storage?: SupabaseClient // Optional for storage operations
}

export class DocumentService {
  private db: PrismaClient
  private logger: Logger
  private storage?: SupabaseClient

  constructor(deps: DocumentServiceDeps) {
    this.db = deps.db
    this.logger = deps.logger
    this.storage = deps.storage
  }

  async findAllForUser(
    userId: string,
    options?: { status?: string; limit?: number; offset?: number },
  ): Promise<Document[]> {
    this.logger.debug('Finding all documents for user', { userId, options })
    const records = await this.db.documents.findMany({
      where: {
        user_id: userId,
        ...(options?.status && { processing_status: options.status }),
      },
      orderBy: { created_at: 'desc' },
      take: options?.limit,
      skip: options?.offset,
    })
    return records.map(this.toDomain)
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
    const record = await this.db.documents.create({
      data: {
        user_id: userId,
        filename: input.filename,
        storage_path: input.storagePath,
        content_type: input.contentType,
        size_bytes: BigInt(input.sizeBytes),
        property_id: input.propertyId ?? null,
        system_id: input.systemId ?? null,
        component_id: input.componentId ?? null,
        processing_status: 'pending',
      },
    })
    return this.toDomain(record)
  }

  async update(id: string, userId: string, input: UpdateDocumentInput): Promise<Document> {
    this.logger.info('Updating document', { id, userId })
    const record = await this.db.documents.update({
      where: { id },
      data: {
        ...(input.propertyId !== undefined && { property_id: input.propertyId }),
        ...(input.systemId !== undefined && { system_id: input.systemId }),
        ...(input.componentId !== undefined && { component_id: input.componentId }),
        updated_at: new Date(),
      },
    })
    return this.toDomain(record)
  }

  async updateProcessingStatus(
    id: string,
    status: string,
    extractedData?: ExtractedData,
  ): Promise<Document> {
    this.logger.info('Updating document processing status', { id, status })
    const record = await this.db.documents.update({
      where: { id },
      data: {
        processing_status: status,
        ...(extractedData && { extracted_data: extractedData as any }),
        ...(status === 'complete' && { processed_at: new Date() }),
        updated_at: new Date(),
      },
    })
    return this.toDomain(record)
  }

  async delete(id: string, userId: string): Promise<void> {
    this.logger.info('Deleting document', { id, userId })
    const doc = await this.db.documents.findFirst({
      where: { id, user_id: userId },
    })

    if (doc && this.storage) {
      // Delete from storage
      await this.storage.storage.from('documents').remove([doc.storage_path])
    }

    await this.db.documents.delete({
      where: { id },
    })
  }

  async getSignedUrl(storagePath: string, expiresIn = 3600): Promise<string | null> {
    if (!this.storage) {
      this.logger.warn('Storage client not configured')
      return null
    }

    const { data, error } = await this.storage.storage
      .from('documents')
      .createSignedUrl(storagePath, expiresIn)

    if (error) {
      this.logger.error('Failed to create signed URL', { error: error.message })
      return null
    }

    return data.signedUrl
  }

  async countByStatus(userId: string): Promise<Record<string, number>> {
    this.logger.debug('Counting documents by status', { userId })
    const results = await this.db.documents.groupBy({
      by: ['processing_status'],
      where: { user_id: userId },
      _count: true,
    })

    return results.reduce(
      (acc, r) => {
        acc[r.processing_status] = r._count
        return acc
      },
      {} as Record<string, number>,
    )
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
      processingStatus: record.processing_status as any,
      retryCount: record.retry_count,
      processedAt: record.processed_at,
      createdAt: record.created_at,
      updatedAt: record.updated_at,
    }
  }
}
