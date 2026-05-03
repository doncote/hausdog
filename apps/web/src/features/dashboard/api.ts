import { createServerFn } from '@tanstack/react-start'
import { PropertyService } from '@/features/properties/service'
import { consoleLogger as logger } from '@/lib/console-logger'
import { prisma } from '@/lib/db/client'
import { getSafeSession } from '@/lib/supabase'

export interface DashboardStats {
  propertyCount: number
  itemCount: number
  pendingReviewCount: number
  documentCount: number
  recentItems: Array<{
    id: string
    name: string
    category: string
    propertyName: string
    createdAt: Date
  }>
  upcomingMaintenance: Array<{
    id: string
    name: string
    nextDueDate: Date
    itemName: string | null
    propertyName: string
  }>
  overdueCount: number
}

const getPropertyService = () => new PropertyService({ db: prisma, logger })

export const fetchDashboardStats = createServerFn({ method: 'GET' })
  .inputValidator((d: Record<string, never>) => d)
  .handler(async (): Promise<DashboardStats> => {
    const { user } = await getSafeSession()
    if (!user) throw new Error('Unauthorized')
    const properties = await getPropertyService().findAllForUser(user.id)

    const propertyIds = properties.map((p) => p.id)

    if (propertyIds.length === 0) {
      return {
        propertyCount: 0,
        itemCount: 0,
        pendingReviewCount: 0,
        documentCount: 0,
        recentItems: [],
        upcomingMaintenance: [],
        overdueCount: 0,
      }
    }

    // Run counts in parallel
    const [
      itemCount,
      pendingReviewCount,
      documentCount,
      recentItems,
      maintenanceTasks,
      overdueCount,
    ] = await Promise.all([
      prisma.item.count({
        where: { propertyId: { in: propertyIds } },
      }),
      prisma.document.count({
        where: {
          propertyId: { in: propertyIds },
          status: 'ready_for_review',
        },
      }),
      prisma.document.count({
        where: { propertyId: { in: propertyIds } },
      }),
      prisma.item.findMany({
        where: { propertyId: { in: propertyIds } },
        orderBy: { createdAt: 'desc' },
        take: 5,
        include: {
          property: { select: { name: true } },
        },
      }),
      prisma.maintenanceTask.findMany({
        where: {
          propertyId: { in: propertyIds },
          status: 'active',
        },
        orderBy: { nextDueDate: 'asc' },
        take: 10,
        include: {
          property: { select: { name: true } },
          item: { select: { name: true } },
        },
      }),
      prisma.maintenanceTask.count({
        where: {
          propertyId: { in: propertyIds },
          status: 'active',
          nextDueDate: { lt: new Date() },
        },
      }),
    ])

    return {
      propertyCount: properties.length,
      itemCount,
      pendingReviewCount,
      documentCount,
      recentItems: recentItems.map((item) => ({
        id: item.id,
        name: item.name,
        category: item.category,
        propertyName: item.property.name,
        createdAt: item.createdAt,
      })),
      upcomingMaintenance: maintenanceTasks.map((t) => ({
        id: t.id,
        name: t.name,
        nextDueDate: t.nextDueDate,
        itemName: t.item?.name ?? null,
        propertyName: t.property.name,
      })),
      overdueCount,
    }
  })
