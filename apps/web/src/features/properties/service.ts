import type { PrismaClient, Property as PrismaProperty } from '@generated/prisma/client'
import { Prisma } from '@generated/prisma/client'
import type { Logger } from '@/lib/console-logger'
import { generateIngestToken } from '@/lib/ingest-token'
import { buildPaginatedResult, type PaginatedResult, type PaginationParams } from '@/lib/pagination'
import type {
  CreatePropertyInput,
  Property,
  PropertyWithCounts,
  UpdatePropertyInput,
} from './types'

export interface PropertyServiceDeps {
  db: PrismaClient
  logger: Logger
}

export class PropertyService {
  private db: PrismaClient
  private logger: Logger

  constructor(deps: PropertyServiceDeps) {
    this.db = deps.db
    this.logger = deps.logger
  }

  /**
   * Prisma `where` clause that finds properties accessible to a user:
   * either owned by them or shared via an active membership.
   */
  private accessibleWhere(userId: string) {
    return {
      OR: [{ userId }, { members: { some: { userId, status: 'active' } } }] as [
        { userId: string },
        { members: { some: { userId: string; status: string } } },
      ],
    }
  }

  async findAllForUser(userId: string): Promise<Property[]> {
    this.logger.debug('Finding all properties for user', { userId })
    const records = await this.db.property.findMany({
      where: this.accessibleWhere(userId),
      orderBy: { createdAt: 'desc' },
    })
    return records.map((r) => this.toDomain(r))
  }

  async findAllForUserWithCounts(userId: string): Promise<PropertyWithCounts[]> {
    this.logger.debug('Finding all properties with counts for user', { userId })
    const records = await this.db.property.findMany({
      where: this.accessibleWhere(userId),
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { items: true, spaces: true },
        },
      },
    })
    return records.map((r) => ({
      ...this.toDomain(r),
      _count: { items: r._count.items, spaces: r._count.spaces },
    }))
  }

  async findPaginatedForUser(
    userId: string,
    pagination: PaginationParams,
  ): Promise<PaginatedResult<PropertyWithCounts>> {
    const { page, limit } = pagination
    const skip = (page - 1) * limit
    const include = { _count: { select: { items: true, spaces: true } } } as const
    const where = this.accessibleWhere(userId)
    const [records, total] = await Promise.all([
      this.db.property.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include,
      }),
      this.db.property.count({ where }),
    ])
    return buildPaginatedResult(
      records.map((r) => ({
        ...this.toDomain(r),
        _count: { items: r._count.items, spaces: r._count.spaces },
      })),
      total,
      page,
      limit,
    )
  }

  async findById(id: string, userId: string): Promise<Property | null> {
    this.logger.debug('Finding property by id', { id, userId })
    const record = await this.db.property.findFirst({
      where: { id, ...this.accessibleWhere(userId) },
    })
    return record ? this.toDomain(record) : null
  }

  /** Returns true if user can write to this property (owner or active editor). */
  async canWrite(id: string, userId: string): Promise<boolean> {
    const record = await this.db.property.findFirst({
      where: {
        id,
        OR: [
          { userId },
          { members: { some: { userId, status: 'active', role: { in: ['owner', 'editor'] } } } },
        ],
      },
      select: { id: true },
    })
    return record !== null
  }

  /** Returns true if user is the property owner. */
  async isOwner(id: string, userId: string): Promise<boolean> {
    const record = await this.db.property.findFirst({
      where: { id, userId },
      select: { id: true },
    })
    return record !== null
  }

  async create(userId: string, input: CreatePropertyInput): Promise<Property> {
    this.logger.info('Creating property', { userId, name: input.name })

    // Generate ingest token from formatted address or name
    const ingestToken = generateIngestToken(input.formattedAddress ?? null, input.name)

    const record = await this.db.property.create({
      data: {
        userId,
        name: input.name,
        // Address fields
        streetAddress: input.streetAddress ?? null,
        city: input.city ?? null,
        state: input.state ?? null,
        postalCode: input.postalCode ?? null,
        country: input.country ?? null,
        county: input.county ?? null,
        neighborhood: input.neighborhood ?? null,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
        timezone: input.timezone ?? null,
        plusCode: input.plusCode ?? null,
        googlePlaceId: input.googlePlaceId ?? null,
        formattedAddress: input.formattedAddress ?? null,
        googlePlaceData: (input.googlePlaceData as Prisma.InputJsonValue) ?? Prisma.DbNull,
        // Other fields
        yearBuilt: input.yearBuilt ?? null,
        squareFeet: input.squareFeet ?? null,
        lotSquareFeet: input.lotSquareFeet ?? null,
        bedrooms: input.bedrooms ?? null,
        bathrooms: input.bathrooms ?? null,
        stories: input.stories ?? null,
        propertyType: input.propertyType ?? null,
        purchaseDate: input.purchaseDate ?? null,
        purchasePrice: input.purchasePrice ?? null,
        estimatedValue: input.estimatedValue ?? null,
        lookupData: (input.lookupData as Prisma.InputJsonValue) ?? Prisma.DbNull,
        ingestToken,
        createdById: userId,
        updatedById: userId,
      },
    })
    return this.toDomain(record)
  }

  async update(id: string, userId: string, input: UpdatePropertyInput): Promise<Property> {
    this.logger.info('Updating property', { id, userId })
    const allowed = await this.canWrite(id, userId)
    if (!allowed) throw new Error('Access denied')
    const record = await this.db.property.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        // Address fields
        ...(input.streetAddress !== undefined && { streetAddress: input.streetAddress ?? null }),
        ...(input.city !== undefined && { city: input.city ?? null }),
        ...(input.state !== undefined && { state: input.state ?? null }),
        ...(input.postalCode !== undefined && { postalCode: input.postalCode ?? null }),
        ...(input.country !== undefined && { country: input.country ?? null }),
        ...(input.county !== undefined && { county: input.county ?? null }),
        ...(input.neighborhood !== undefined && { neighborhood: input.neighborhood ?? null }),
        ...(input.latitude !== undefined && { latitude: input.latitude ?? null }),
        ...(input.longitude !== undefined && { longitude: input.longitude ?? null }),
        ...(input.timezone !== undefined && { timezone: input.timezone ?? null }),
        ...(input.plusCode !== undefined && { plusCode: input.plusCode ?? null }),
        ...(input.googlePlaceId !== undefined && { googlePlaceId: input.googlePlaceId ?? null }),
        ...(input.formattedAddress !== undefined && {
          formattedAddress: input.formattedAddress ?? null,
        }),
        ...(input.googlePlaceData !== undefined && {
          googlePlaceData: (input.googlePlaceData as Prisma.InputJsonValue) ?? Prisma.DbNull,
        }),
        // Other fields
        ...(input.yearBuilt !== undefined && { yearBuilt: input.yearBuilt ?? null }),
        ...(input.squareFeet !== undefined && { squareFeet: input.squareFeet ?? null }),
        ...(input.lotSquareFeet !== undefined && { lotSquareFeet: input.lotSquareFeet ?? null }),
        ...(input.bedrooms !== undefined && { bedrooms: input.bedrooms ?? null }),
        ...(input.bathrooms !== undefined && { bathrooms: input.bathrooms ?? null }),
        ...(input.stories !== undefined && { stories: input.stories ?? null }),
        ...(input.propertyType !== undefined && { propertyType: input.propertyType ?? null }),
        ...(input.purchaseDate !== undefined && { purchaseDate: input.purchaseDate ?? null }),
        ...(input.purchasePrice !== undefined && { purchasePrice: input.purchasePrice ?? null }),
        ...(input.estimatedValue !== undefined && { estimatedValue: input.estimatedValue ?? null }),
        ...(input.lookupData !== undefined && {
          lookupData: (input.lookupData as Prisma.InputJsonValue) ?? Prisma.DbNull,
        }),
        updatedById: userId,
      },
    })
    return this.toDomain(record)
  }

  async delete(id: string, userId: string): Promise<void> {
    this.logger.info('Deleting property', { id, userId })
    const owned = await this.isOwner(id, userId)
    if (!owned) throw new Error('Access denied: only the owner can delete a property')
    await this.db.property.delete({
      where: { id },
    })
  }

  async findByIngestToken(token: string): Promise<Property | null> {
    this.logger.debug('Finding property by ingest token', { token })
    const record = await this.db.property.findUnique({
      where: { ingestToken: token },
    })
    return record ? this.toDomain(record) : null
  }

  private toDomain(record: PrismaProperty): Property {
    return {
      id: record.id,
      userId: record.userId,
      name: record.name,
      // Address fields
      streetAddress: record.streetAddress,
      city: record.city,
      state: record.state,
      postalCode: record.postalCode,
      country: record.country,
      county: record.county,
      neighborhood: record.neighborhood,
      latitude: record.latitude,
      longitude: record.longitude,
      timezone: record.timezone,
      plusCode: record.plusCode,
      googlePlaceId: record.googlePlaceId,
      formattedAddress: record.formattedAddress,
      googlePlaceData: record.googlePlaceData,
      // Other fields
      yearBuilt: record.yearBuilt,
      squareFeet: record.squareFeet,
      lotSquareFeet: record.lotSquareFeet,
      bedrooms: record.bedrooms,
      bathrooms: record.bathrooms ? Number(record.bathrooms) : null,
      stories: record.stories,
      propertyType: record.propertyType,
      purchaseDate: record.purchaseDate,
      purchasePrice: record.purchasePrice ? Number(record.purchasePrice) : null,
      estimatedValue: record.estimatedValue ? Number(record.estimatedValue) : null,
      lookupData: record.lookupData,
      ingestToken: record.ingestToken,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    }
  }
}
