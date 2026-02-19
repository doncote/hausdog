import { schedules } from '@trigger.dev/sdk/v3'
import { PrismaClient } from '@generated/prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

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
  cron: '0 9 * * *',
  run: async (payload) => {
    console.log('Checking maintenance reminders for', payload.timestamp)
    const prisma = createPrismaClient()

    try {
      const today = new Date()
      today.setHours(0, 0, 0, 0)

      const dueTasks = await prisma.maintenanceTask.findMany({
        where: {
          status: 'active',
          nextDueDate: { lte: today },
        },
        include: {
          property: {
            select: {
              name: true,
              userId: true,
            },
          },
          item: {
            select: {
              name: true,
            },
          },
        },
      })

      console.log(`Found ${dueTasks.length} overdue/due maintenance tasks`)

      const tasksByUser = new Map<string, typeof dueTasks>()
      for (const task of dueTasks) {
        const userId = task.property.userId
        if (!tasksByUser.has(userId)) {
          tasksByUser.set(userId, [])
        }
        tasksByUser.get(userId)!.push(task)
      }

      return {
        checkedAt: payload.timestamp,
        tasksFound: dueTasks.length,
        usersAffected: tasksByUser.size,
      }
    } finally {
      await prisma.$disconnect()
    }
  },
})
