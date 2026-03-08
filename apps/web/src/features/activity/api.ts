import { createServerFn } from '@tanstack/react-start'
import { PropertyService } from '@/features/properties/service'
import { consoleLogger as logger } from '@/lib/console-logger'
import { prisma } from '@/lib/db/client'
import { ActivityService } from './service'

const getActivityService = () => new ActivityService(prisma)
const getPropertyService = () => new PropertyService({ db: prisma, logger })

export const fetchActivityFeed = createServerFn({ method: 'GET' })
  .inputValidator((d: { propertyId: string; userId: string; limit?: number }) => d)
  .handler(async ({ data }) => {
    const property = await getPropertyService().findById(data.propertyId, data.userId)
    if (!property) throw new Error('Property not found or access denied')
    return getActivityService().findRecent(data.propertyId, data.limit ?? 50)
  })
