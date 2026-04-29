import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockMessaging = { sendEachForMulticast: vi.fn() }
const mockApp = { messaging: vi.fn(() => mockMessaging) }
const mockInitializeApp = vi.fn(() => mockApp)
const mockCert = vi.fn(() => ({ credential: true }))

vi.mock('firebase-admin', () => ({
  default: {
    initializeApp: mockInitializeApp,
    credential: { cert: mockCert },
  },
}))

let savedKey: string | undefined

beforeEach(() => {
  vi.resetModules()
  savedKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY
})

afterEach(() => {
  if (savedKey !== undefined) {
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY = savedKey
  } else {
    delete process.env.FIREBASE_SERVICE_ACCOUNT_KEY
  }
  vi.clearAllMocks()
})

describe('getFirebaseAdmin', () => {
  it('throws when FIREBASE_SERVICE_ACCOUNT_KEY is not set', async () => {
    delete process.env.FIREBASE_SERVICE_ACCOUNT_KEY
    const { getFirebaseAdmin } = await import('./firebase-admin')
    expect(() => getFirebaseAdmin()).toThrow(
      'FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set',
    )
  })

  it('initializes firebase app with parsed service account', async () => {
    const serviceAccount = { project_id: 'test-project', type: 'service_account' }
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY = JSON.stringify(serviceAccount)
    const { getFirebaseAdmin } = await import('./firebase-admin')

    getFirebaseAdmin()

    expect(mockCert).toHaveBeenCalledWith(serviceAccount)
    expect(mockInitializeApp).toHaveBeenCalledWith({
      credential: { credential: true },
    })
  })

  it('returns cached app on second call without reinitializing', async () => {
    const serviceAccount = { project_id: 'test-project', type: 'service_account' }
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY = JSON.stringify(serviceAccount)
    const { getFirebaseAdmin } = await import('./firebase-admin')

    getFirebaseAdmin()
    getFirebaseAdmin()

    expect(mockInitializeApp).toHaveBeenCalledTimes(1)
  })
})

describe('getMessaging', () => {
  it('returns messaging from firebase app', async () => {
    const serviceAccount = { project_id: 'test-project', type: 'service_account' }
    process.env.FIREBASE_SERVICE_ACCOUNT_KEY = JSON.stringify(serviceAccount)
    const { getMessaging } = await import('./firebase-admin')

    const result = getMessaging()

    expect(result).toBe(mockMessaging)
  })
})
