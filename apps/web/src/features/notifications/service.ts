import { prisma as db } from '@/lib/db'
import { getMessaging } from '@/lib/firebase-admin'

export interface DeviceToken {
  id: string
  userId: string
  token: string
  platform: 'web'
  createdAt: Date
  updatedAt: Date
}

export async function registerDeviceToken(
  userId: string,
  token: string,
  platform: 'web',
): Promise<DeviceToken> {
  const result = await db.deviceToken.upsert({
    where: {
      userId_token: { userId, token },
    },
    update: {
      updatedAt: new Date(),
    },
    create: {
      userId,
      token,
      platform,
    },
  })

  return {
    id: result.id,
    userId: result.userId,
    token: result.token,
    platform: result.platform as 'web',
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
  }
}

export async function removeDeviceToken(userId: string, token: string): Promise<void> {
  await db.deviceToken.deleteMany({
    where: { userId, token },
  })
}

export async function getDeviceTokens(userId: string): Promise<string[]> {
  const tokens = await db.deviceToken.findMany({
    where: { userId },
    select: { token: true },
  })

  return tokens.map((t) => t.token)
}

export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>,
): Promise<{ successCount: number; failureCount: number }> {
  const tokens = await getDeviceTokens(userId)

  if (tokens.length === 0) {
    return { successCount: 0, failureCount: 0 }
  }

  const messaging = getMessaging()

  const response = await messaging.sendEachForMulticast({
    tokens,
    notification: {
      title,
      body,
    },
    data,
  })

  // Remove invalid tokens
  const invalidTokens: string[] = []
  response.responses.forEach((resp, idx) => {
    if (!resp.success && resp.error?.code === 'messaging/registration-token-not-registered') {
      invalidTokens.push(tokens[idx])
    }
  })

  if (invalidTokens.length > 0) {
    await db.deviceToken.deleteMany({
      where: {
        userId,
        token: { in: invalidTokens },
      },
    })
  }

  return {
    successCount: response.successCount,
    failureCount: response.failureCount,
  }
}
