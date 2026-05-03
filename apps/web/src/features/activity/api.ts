import { createServerFn } from '@tanstack/react-start'
import { PropertyService } from '@/features/properties/service'
import { consoleLogger as logger } from '@/lib/console-logger'
import { prisma } from '@/lib/db/client'
import { getSafeSession } from '@/lib/supabase'
import { ActivityService } from './service'

const getActivityService = () => new ActivityService(prisma)
const getPropertyService = () => new PropertyService({ db: prisma, logger })

export const fetchActivityFeed = createServerFn({ method: 'GET' })
  .inputValidator((d: { propertyId: string; limit?: number }) => d)
  .handler(async ({ data }) => {
    const { user } = await getSafeSession()
    if (!user) throw new Error('Unauthorized')
    const property = await getPropertyService().findById(data.propertyId, user.id)
    if (!property) throw new Error('Property not found or access denied')
    return getActivityService().findRecent(data.propertyId, data.limit ?? 50)
  })
