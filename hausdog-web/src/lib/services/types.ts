import type { PrismaClient } from '@generated/prisma/client'
import type { Logger } from '../logger'

export interface ServiceDeps {
  db: PrismaClient
  logger: Logger
}
