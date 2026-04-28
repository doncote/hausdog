import { describe, expect, it, vi } from 'vitest'

vi.mock('@tanstack/react-router', () => ({
  redirect: vi.fn((opts: { to: string }) => {
    const err = new Error(`Redirect to ${opts.to}`)
    ;(err as Error & { isRedirect?: boolean; to?: string }).isRedirect = true
    ;(err as Error & { isRedirect?: boolean; to?: string }).to = opts.to
    return err
  }),
}))

import { requireAuthFromContext } from './auth'

function makeUser(id = 'user-1') {
  return { id, email: `${id}@example.com` } as Parameters<typeof requireAuthFromContext>[0]['user']
}

describe('requireAuthFromContext', () => {
  it('returns user when authenticated', () => {
    const user = makeUser()
    const result = requireAuthFromContext({ user })
    expect(result).toBe(user)
  })

  it('throws redirect to /login when user is null', () => {
    expect(() => requireAuthFromContext({ user: null })).toThrowError(/Redirect to \/login/)
  })

  it('redirect error has isRedirect flag', () => {
    let thrown: unknown
    try {
      requireAuthFromContext({ user: null })
    } catch (e) {
      thrown = e
    }
    expect((thrown as { isRedirect?: boolean }).isRedirect).toBe(true)
  })

  it('redirect targets /login', () => {
    let thrown: unknown
    try {
      requireAuthFromContext({ user: null })
    } catch (e) {
      thrown = e
    }
    expect((thrown as { to?: string }).to).toBe('/login')
  })
})
