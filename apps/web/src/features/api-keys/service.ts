import { createHash, randomBytes } from 'node:crypto'
import type { ApiKey as PrismaApiKey, PrismaClient } from '@generated/prisma/client'
import type { Logger } from '@/lib/console-logger'
import type { ApiKey, ApiKeyWithSecret, CreateApiKeyInput, ValidatedApiKey } from './types'

const API_KEY_PREFIX = 'hd_'
const API_KEY_BYTES = 32

export interface ApiKeyServiceDeps {
  db: PrismaClient
  logger: Logger
}

export class ApiKeyService {
  private db: PrismaClient
  private logger: Logger

  constructor(deps: ApiKeyServiceDeps) {
    this.db = deps.db
    this.logger = deps.logger
  }

  /**
   * Generate a new API key for a user.
   * Returns the plain-text key only once - it cannot be retrieved later.
   */
  async create(userId: string, input: CreateApiKeyInput): Promise<ApiKeyWithSecret> {
    this.logger.info('Creating API key', { userId, name: input.name })

    const secret = this.generateKey()
    const keyHash = this.hashKey(secret)

    const record = await this.db.apiKey.create({
      data: {
        userId,
        name: input.name,
        keyHash,
      },
    })

    return {
      ...this.toDomain(record),
      secret,
    }
  }

  /**
   * Validate an API key and return the associated user info.
   * Updates lastUsedAt on successful validation.
   */
  async validate(key: string): Promise<ValidatedApiKey | null> {
    if (!key.startsWith(API_KEY_PREFIX)) {
      this.logger.debug('Invalid API key format')
      return null
    }

    const keyHash = this.hashKey(key)

    const record = await this.db.apiKey.findUnique({
      where: { keyHash },
    })

    if (!record) {
      this.logger.debug('API key not found')
      return null
    }

    // Update last used timestamp asynchronously
    this.db.apiKey
      .update({
        where: { id: record.id },
        data: { lastUsedAt: new Date() },
      })
      .catch((err) => {
        this.logger.error('Failed to update lastUsedAt', { error: err })
      })

    this.logger.debug('API key validated', { keyId: record.id, userId: record.userId })

    return {
      id: record.id,
      userId: record.userId,
      name: record.name,
    }
  }

  /**
   * List all API keys for a user (without secrets).
   */
  async findAllForUser(userId: string): Promise<ApiKey[]> {
    this.logger.debug('Finding all API keys for user', { userId })

    const records = await this.db.apiKey.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    })

    return records.map((r) => this.toDomain(r))
  }

  /**
   * Get a single API key by ID.
   */
  async findById(id: string): Promise<ApiKey | null> {
    this.logger.debug('Finding API key by id', { id })

    const record = await this.db.apiKey.findUnique({
      where: { id },
    })

    return record ? this.toDomain(record) : null
  }

  /**
   * Delete an API key.
   */
  async delete(id: string, userId: string): Promise<void> {
    this.logger.info('Deleting API key', { id, userId })

    await this.db.apiKey.delete({
      where: { id, userId },
    })
  }

  private generateKey(): string {
    const bytes = randomBytes(API_KEY_BYTES)
    return API_KEY_PREFIX + bytes.toString('base64url')
  }

  private hashKey(key: string): string {
    return createHash('sha256').update(key).digest('hex')
  }

  private toDomain(record: PrismaApiKey): ApiKey {
    return {
      id: record.id,
      userId: record.userId,
      name: record.name,
      lastUsedAt: record.lastUsedAt,
      createdAt: record.createdAt,
    }
  }
}
