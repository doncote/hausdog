import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/console-logger', () => ({
  consoleLogger: { debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}))

const mockSend = vi.fn()
vi.mock('resend', () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: mockSend },
  })),
}))

import { consoleLogger as logger } from '@/lib/console-logger'
import { sendPropertyInviteEmail } from './transactional'

const PARAMS = {
  to: 'invitee@example.com',
  inviterEmail: 'owner@example.com',
  propertyName: 'My Home',
  role: 'viewer',
  acceptUrl: 'https://app.hausdog.app/dashboard',
}

describe('sendPropertyInviteEmail', () => {
  const originalEnv = process.env.RESEND_API_KEY

  beforeEach(() => {
    vi.clearAllMocks()
    process.env.RESEND_API_KEY = 'test-key'
  })

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.RESEND_API_KEY
    } else {
      process.env.RESEND_API_KEY = originalEnv
    }
  })

  it('sends email with correct to and subject', async () => {
    mockSend.mockResolvedValue({ data: { id: 'email-id' }, error: null })

    await sendPropertyInviteEmail(PARAMS)

    expect(mockSend).toHaveBeenCalledOnce()
    const call = mockSend.mock.calls[0][0]
    expect(call.to).toBe('invitee@example.com')
    expect(call.subject).toContain('owner@example.com')
    expect(call.subject).toContain('My Home')
  })

  it('includes property name and inviter email in body', async () => {
    mockSend.mockResolvedValue({ data: { id: 'email-id' }, error: null })

    await sendPropertyInviteEmail(PARAMS)

    const call = mockSend.mock.calls[0][0]
    expect(call.html).toContain('owner@example.com')
    expect(call.html).toContain('My Home')
    expect(call.text).toContain('owner@example.com')
    expect(call.text).toContain('My Home')
  })

  it('includes acceptUrl in body', async () => {
    mockSend.mockResolvedValue({ data: { id: 'email-id' }, error: null })

    await sendPropertyInviteEmail(PARAMS)

    const call = mockSend.mock.calls[0][0]
    expect(call.html).toContain('https://app.hausdog.app/dashboard')
    expect(call.text).toContain('https://app.hausdog.app/dashboard')
  })

  it('skips send and warns when RESEND_API_KEY is not set', async () => {
    delete process.env.RESEND_API_KEY

    await sendPropertyInviteEmail(PARAMS)

    expect(mockSend).not.toHaveBeenCalled()
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('RESEND_API_KEY'))
  })

  it('warns but does not throw when Resend returns an error', async () => {
    mockSend.mockResolvedValue({ data: null, error: { message: 'rate limited' } })

    await expect(sendPropertyInviteEmail(PARAMS)).resolves.toBeUndefined()
    expect(logger.warn).toHaveBeenCalledWith(expect.stringContaining('Failed'), expect.any(Object))
  })
})
