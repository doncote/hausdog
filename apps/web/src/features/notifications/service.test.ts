import { beforeEach, describe, expect, it, vi } from 'vitest'

// Mock prisma module
vi.mock('@/lib/db', () => ({
  prisma: {
    deviceToken: {
      upsert: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
    },
  },
}))

// Mock firebase-admin messaging
const mockSendEachForMulticast = vi.fn()
vi.mock('@/lib/firebase-admin', () => ({
  getMessaging: () => ({
    sendEachForMulticast: mockSendEachForMulticast,
  }),
}))

import { prisma as db } from '@/lib/db'
import {
  getDeviceTokens,
  registerDeviceToken,
  removeDeviceToken,
  sendPushNotification,
} from './service'

const mockDb = db as {
  deviceToken: {
    upsert: ReturnType<typeof vi.fn>
    deleteMany: ReturnType<typeof vi.fn>
    findMany: ReturnType<typeof vi.fn>
  }
}

const NOW = new Date('2024-01-01T00:00:00Z')

beforeEach(() => {
  vi.clearAllMocks()
})

// ─── registerDeviceToken ───────────────────────────────────────────────────

describe('registerDeviceToken', () => {
  it('upserts with userId+token composite key', async () => {
    const dbRecord = {
      id: 'tok-1',
      userId: 'user-1',
      token: 'fcm-token-abc',
      platform: 'web',
      createdAt: NOW,
      updatedAt: NOW,
    }
    mockDb.deviceToken.upsert.mockResolvedValue(dbRecord)

    await registerDeviceToken('user-1', 'fcm-token-abc', 'web')

    expect(mockDb.deviceToken.upsert).toHaveBeenCalledWith({
      where: { userId_token: { userId: 'user-1', token: 'fcm-token-abc' } },
      update: expect.objectContaining({ updatedAt: expect.any(Date) }),
      create: { userId: 'user-1', token: 'fcm-token-abc', platform: 'web' },
    })
  })

  it('returns mapped DeviceToken domain object', async () => {
    const dbRecord = {
      id: 'tok-1',
      userId: 'user-1',
      token: 'fcm-token-abc',
      platform: 'web',
      createdAt: NOW,
      updatedAt: NOW,
    }
    mockDb.deviceToken.upsert.mockResolvedValue(dbRecord)

    const result = await registerDeviceToken('user-1', 'fcm-token-abc', 'web')

    expect(result).toEqual({
      id: 'tok-1',
      userId: 'user-1',
      token: 'fcm-token-abc',
      platform: 'web',
      createdAt: NOW,
      updatedAt: NOW,
    })
  })
})

// ─── removeDeviceToken ─────────────────────────────────────────────────────

describe('removeDeviceToken', () => {
  it('deletes by userId and token', async () => {
    mockDb.deviceToken.deleteMany.mockResolvedValue({ count: 1 })

    await removeDeviceToken('user-1', 'fcm-token-abc')

    expect(mockDb.deviceToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', token: 'fcm-token-abc' },
    })
  })

  it('does not throw when token does not exist', async () => {
    mockDb.deviceToken.deleteMany.mockResolvedValue({ count: 0 })

    await expect(removeDeviceToken('user-1', 'nonexistent')).resolves.toBeUndefined()
  })
})

// ─── getDeviceTokens ───────────────────────────────────────────────────────

describe('getDeviceTokens', () => {
  it('returns array of token strings for the user', async () => {
    mockDb.deviceToken.findMany.mockResolvedValue([
      { token: 'tok-a' },
      { token: 'tok-b' },
      { token: 'tok-c' },
    ])

    const tokens = await getDeviceTokens('user-1')

    expect(tokens).toEqual(['tok-a', 'tok-b', 'tok-c'])
    expect(mockDb.deviceToken.findMany).toHaveBeenCalledWith({
      where: { userId: 'user-1' },
      select: { token: true },
    })
  })

  it('returns empty array when user has no tokens', async () => {
    mockDb.deviceToken.findMany.mockResolvedValue([])

    const tokens = await getDeviceTokens('user-1')

    expect(tokens).toEqual([])
  })
})

// ─── sendPushNotification ──────────────────────────────────────────────────

describe('sendPushNotification', () => {
  it('returns zero counts immediately when user has no device tokens', async () => {
    mockDb.deviceToken.findMany.mockResolvedValue([])

    const result = await sendPushNotification('user-1', 'Hello', 'World')

    expect(result).toEqual({ successCount: 0, failureCount: 0 })
    expect(mockSendEachForMulticast).not.toHaveBeenCalled()
  })

  it('sends multicast to all user tokens', async () => {
    mockDb.deviceToken.findMany.mockResolvedValue([{ token: 'tok-a' }, { token: 'tok-b' }])
    mockSendEachForMulticast.mockResolvedValue({
      successCount: 2,
      failureCount: 0,
      responses: [{ success: true }, { success: true }],
    })

    await sendPushNotification('user-1', 'Title', 'Body')

    expect(mockSendEachForMulticast).toHaveBeenCalledWith({
      tokens: ['tok-a', 'tok-b'],
      notification: { title: 'Title', body: 'Body' },
      data: undefined,
    })
  })

  it('forwards optional data payload to multicast', async () => {
    mockDb.deviceToken.findMany.mockResolvedValue([{ token: 'tok-a' }])
    mockSendEachForMulticast.mockResolvedValue({
      successCount: 1,
      failureCount: 0,
      responses: [{ success: true }],
    })

    await sendPushNotification('user-1', 'Title', 'Body', { eventId: 'evt-1' })

    expect(mockSendEachForMulticast).toHaveBeenCalledWith(
      expect.objectContaining({ data: { eventId: 'evt-1' } }),
    )
  })

  it('returns successCount and failureCount from FCM response', async () => {
    mockDb.deviceToken.findMany.mockResolvedValue([{ token: 'tok-a' }, { token: 'tok-b' }])
    mockSendEachForMulticast.mockResolvedValue({
      successCount: 1,
      failureCount: 1,
      responses: [{ success: true }, { success: false, error: { code: 'messaging/unknown' } }],
    })

    const result = await sendPushNotification('user-1', 'Title', 'Body')

    expect(result).toEqual({ successCount: 1, failureCount: 1 })
  })

  it('removes tokens that are no longer registered', async () => {
    mockDb.deviceToken.findMany.mockResolvedValue([{ token: 'tok-a' }, { token: 'tok-b' }])
    mockSendEachForMulticast.mockResolvedValue({
      successCount: 1,
      failureCount: 1,
      responses: [
        { success: true },
        {
          success: false,
          error: { code: 'messaging/registration-token-not-registered' },
        },
      ],
    })
    mockDb.deviceToken.deleteMany.mockResolvedValue({ count: 1 })

    await sendPushNotification('user-1', 'Title', 'Body')

    expect(mockDb.deviceToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', token: { in: ['tok-b'] } },
    })
  })

  it('does not call deleteMany when all tokens are valid', async () => {
    mockDb.deviceToken.findMany.mockResolvedValue([{ token: 'tok-a' }])
    mockSendEachForMulticast.mockResolvedValue({
      successCount: 1,
      failureCount: 0,
      responses: [{ success: true }],
    })

    await sendPushNotification('user-1', 'Title', 'Body')

    expect(mockDb.deviceToken.deleteMany).not.toHaveBeenCalled()
  })

  it('only removes tokens with the not-registered error code, not other failures', async () => {
    mockDb.deviceToken.findMany.mockResolvedValue([
      { token: 'tok-a' },
      { token: 'tok-b' },
      { token: 'tok-c' },
    ])
    mockSendEachForMulticast.mockResolvedValue({
      successCount: 1,
      failureCount: 2,
      responses: [
        { success: true },
        { success: false, error: { code: 'messaging/internal-error' } },
        { success: false, error: { code: 'messaging/registration-token-not-registered' } },
      ],
    })
    mockDb.deviceToken.deleteMany.mockResolvedValue({ count: 1 })

    await sendPushNotification('user-1', 'Title', 'Body')

    // Only tok-c (index 2) should be removed — tok-b has a different error code
    expect(mockDb.deviceToken.deleteMany).toHaveBeenCalledWith({
      where: { userId: 'user-1', token: { in: ['tok-c'] } },
    })
  })
})
