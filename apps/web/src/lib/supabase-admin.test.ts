import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mockGetUserById = vi.fn()
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn().mockImplementation(() => ({
    auth: { admin: { getUserById: mockGetUserById } },
  })),
}))

import { getUserEmail } from './supabase-admin'

describe('getUserEmail', () => {
  const origUrl = process.env.SUPABASE_URL
  const origKey = process.env.SUPABASE_SERVICE_KEY

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.SUPABASE_URL = 'https://test.supabase.co'
    process.env.SUPABASE_SERVICE_KEY = 'test-service-key'
  })

  afterEach(() => {
    if (origUrl === undefined) delete process.env.SUPABASE_URL
    else process.env.SUPABASE_URL = origUrl
    if (origKey === undefined) delete process.env.SUPABASE_SERVICE_KEY
    else process.env.SUPABASE_SERVICE_KEY = origKey
  })

  it('returns null when SUPABASE_URL is missing', async () => {
    delete process.env.SUPABASE_URL
    const result = await getUserEmail('user-1')
    expect(result).toBeNull()
    expect(mockGetUserById).not.toHaveBeenCalled()
  })

  it('returns null when SUPABASE_SERVICE_KEY is missing', async () => {
    delete process.env.SUPABASE_SERVICE_KEY
    const result = await getUserEmail('user-1')
    expect(result).toBeNull()
    expect(mockGetUserById).not.toHaveBeenCalled()
  })

  it('returns email when user is found', async () => {
    mockGetUserById.mockResolvedValue({ data: { user: { email: 'owner@example.com' } } })
    const result = await getUserEmail('user-abc')
    expect(result).toBe('owner@example.com')
    expect(mockGetUserById).toHaveBeenCalledWith('user-abc')
  })

  it('returns null when user has no email', async () => {
    mockGetUserById.mockResolvedValue({ data: { user: { email: undefined } } })
    const result = await getUserEmail('user-abc')
    expect(result).toBeNull()
  })

  it('returns null when user is not found', async () => {
    mockGetUserById.mockResolvedValue({ data: { user: null } })
    const result = await getUserEmail('user-abc')
    expect(result).toBeNull()
  })
})
