import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const VALID_ENV: Record<string, string> = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_KEY: 'eyJsomekey',
  SUPABASE_SERVICE_KEY: 'eyJservicekey',
  DATABASE_URL: 'postgresql://user:pass@localhost/db',
  GEMINI_API_KEY: 'gemini-key',
  ANTHROPIC_API_KEY: 'anthropic-key',
  TRIGGER_API_KEY: 'trigger-key',
  TRIGGER_API_URL: 'https://api.trigger.dev',
  RESEND_API_KEY: 'resend-key',
  RESEND_WEBHOOK_SECRET: 'webhook-secret',
  INGEST_EMAIL_DOMAIN: 'ingest.hausdog.com',
  GOOGLE_PLACES_API_KEY: 'google-key',
  PORT: '3000',
  PUBLIC_URL: 'https://app.hausdog.com',
  NODE_ENV: 'test',
}

let savedEnv: NodeJS.ProcessEnv

beforeEach(() => {
  vi.resetModules()
  savedEnv = { ...process.env }
})

afterEach(() => {
  process.env = savedEnv
})

describe('getServerEnv', () => {
  it('throws when required env vars are missing', async () => {
    process.env = {}
    const { getServerEnv } = await import('./env')
    expect(() => getServerEnv()).toThrow('Invalid server environment variables')
  })

  it('throws when SUPABASE_URL is not a valid URL', async () => {
    process.env = { ...VALID_ENV, SUPABASE_URL: 'not-a-url' }
    const { getServerEnv } = await import('./env')
    expect(() => getServerEnv()).toThrow('Invalid server environment variables')
  })

  it('throws when PORT is absent', async () => {
    const { PORT: _port, ...withoutPort } = VALID_ENV
    process.env = withoutPort
    const { getServerEnv } = await import('./env')
    expect(() => getServerEnv()).toThrow()
  })

  it('returns parsed env when all required vars are present', async () => {
    process.env = { ...VALID_ENV }
    const { getServerEnv } = await import('./env')
    const env = getServerEnv()
    expect(env.SUPABASE_URL).toBe(VALID_ENV.SUPABASE_URL)
    expect(env.PORT).toBe(3000)
    expect(env.NODE_ENV).toBe('test')
  })

  it('returns cached result on subsequent calls', async () => {
    process.env = { ...VALID_ENV }
    const { getServerEnv } = await import('./env')
    const first = getServerEnv()
    process.env = {} // wipe env — second call should still return cached result
    const second = getServerEnv()
    expect(second).toBe(first)
  })

  it('accepts optional LATTICE_API_URL and LATTICE_API_KEY', async () => {
    process.env = {
      ...VALID_ENV,
      LATTICE_API_URL: 'https://lattice.example.com',
      LATTICE_API_KEY: 'lattice-key',
    }
    const { getServerEnv } = await import('./env')
    const env = getServerEnv()
    expect(env.LATTICE_API_URL).toBe('https://lattice.example.com')
    expect(env.LATTICE_API_KEY).toBe('lattice-key')
  })

  it('allows LATTICE_API_URL and LATTICE_API_KEY to be absent', async () => {
    process.env = { ...VALID_ENV }
    const { getServerEnv } = await import('./env')
    const env = getServerEnv()
    expect(env.LATTICE_API_URL).toBeUndefined()
    expect(env.LATTICE_API_KEY).toBeUndefined()
  })
})

describe('getBaseUrl', () => {
  it('returns PUBLIC_URL from env', async () => {
    process.env = { ...VALID_ENV }
    const { getBaseUrl } = await import('./env')
    expect(getBaseUrl()).toBe('https://app.hausdog.com')
  })
})
