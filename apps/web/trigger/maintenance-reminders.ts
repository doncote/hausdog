import { schedules } from '@trigger.dev/sdk/v3'
import { PrismaClient } from '@generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { sendPushNotification } from '@/features/notifications'

// Create a Prisma client for the task
function createPrismaClient() {
  const connectionString = process.env.DATABASE_URL
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is required')
  }
  const adapter = new PrismaPg({ connectionString })
  return new PrismaClient({ adapter })
}

export const checkMaintenanceReminders = schedules.task({
  id: 'check-maintenance-reminders',
  cron: '0 9 * * *', // Daily at 9am UTC
  run: async (payload) => {
    console.log('Checking maintenance reminders for', payload.timestamp)
    const prisma = createPrismaClient()

    try {
      // TODO: Implement when maintenance schedules feature is added
      // This will query items with nextMaintenanceDate due today
      // and send push notifications to their owners
      //
      // Example implementation:
      // const today = new Date()
      // today.setHours(0, 0, 0, 0)
      // const tomorrow = new Date(today)
      // tomorrow.setDate(tomorrow.getDate() + 1)
      //
      // const dueItems = await prisma.item.findMany({
      //   where: {
      //     nextMaintenanceDate: {
      //       gte: today,
      //       lt: tomorrow,
      //     },
      //   },
      //   include: {
      //     property: {
      //       select: {
      //         name: true,
      //         userId: true,
      //       },
      //     },
      //   },
      // })

      // For now, just log that the task ran
      console.log('Maintenance reminders task completed (no-op until maintenance schedules feature is implemented)')

      return {
        checkedAt: payload.timestamp,
        itemsFound: 0,
        usersNotified: 0,
      }
    } finally {
      await prisma.$disconnect()
    }
  },
})
