import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { getCurrentPropertyFromCookie, setCurrentPropertyCookie } from './current-property'

const COOKIE_NAME = 'hausdog_current_property'

function clearCookies() {
  document.cookie.split(';').forEach((c) => {
    const name = c.trim().split('=')[0]
    document.cookie = `${name}=; path=/; max-age=0`
  })
}

describe('getCurrentPropertyFromCookie', () => {
  beforeEach(() => clearCookies())
  afterEach(() => clearCookies())

  it('returns null when cookie is absent', () => {
    expect(getCurrentPropertyFromCookie()).toBeNull()
  })

  it('returns parsed property when cookie is set', () => {
    const property = { id: 'prop-1', name: 'My Home' }
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(property))}; path=/`

    const result = getCurrentPropertyFromCookie()
    expect(result).toEqual(property)
  })

  it('returns null when cookie value is malformed JSON', () => {
    document.cookie = `${COOKIE_NAME}=not-valid-json; path=/`
    expect(getCurrentPropertyFromCookie()).toBeNull()
  })

  it('returns null when cookie value is empty', () => {
    document.cookie = `${COOKIE_NAME}=; path=/`
    expect(getCurrentPropertyFromCookie()).toBeNull()
  })

  it('handles special characters in property name', () => {
    const property = { id: 'prop-2', name: "O'Brien & Sons" }
    document.cookie = `${COOKIE_NAME}=${encodeURIComponent(JSON.stringify(property))}; path=/`

    const result = getCurrentPropertyFromCookie()
    expect(result?.name).toBe("O'Brien & Sons")
  })
})

describe('setCurrentPropertyCookie', () => {
  beforeEach(() => clearCookies())
  afterEach(() => clearCookies())

  it('writes property to cookie', () => {
    const property = { id: 'prop-1', name: 'My Home' }
    setCurrentPropertyCookie(property)

    const result = getCurrentPropertyFromCookie()
    expect(result).toEqual(property)
  })

  it('clears cookie when called with null', () => {
    setCurrentPropertyCookie({ id: 'prop-1', name: 'My Home' })
    setCurrentPropertyCookie(null)

    expect(getCurrentPropertyFromCookie()).toBeNull()
  })

  it('overwrites existing cookie with new property', () => {
    setCurrentPropertyCookie({ id: 'prop-1', name: 'Old Home' })
    setCurrentPropertyCookie({ id: 'prop-2', name: 'New Home' })

    const result = getCurrentPropertyFromCookie()
    expect(result?.id).toBe('prop-2')
    expect(result?.name).toBe('New Home')
  })
})
