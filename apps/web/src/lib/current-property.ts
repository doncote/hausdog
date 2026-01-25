import { createServerFn } from '@tanstack/react-start'
import { getCookie, setCookie } from '@tanstack/react-start/server'

const CURRENT_PROPERTY_COOKIE = 'hausdog_current_property'

export interface CurrentProperty {
  id: string
  name: string
}

/**
 * Get the current property from cookie (server-side)
 */
export const getCurrentProperty = createServerFn({ method: 'GET' }).handler(
  async (): Promise<CurrentProperty | null> => {
    const cookieValue = getCookie(CURRENT_PROPERTY_COOKIE)
    if (!cookieValue) return null

    try {
      return JSON.parse(cookieValue) as CurrentProperty
    } catch {
      return null
    }
  },
)

/**
 * Set the current property in cookie (server-side)
 */
export const setCurrentProperty = createServerFn({ method: 'POST' })
  .inputValidator((d: CurrentProperty | null) => d)
  .handler(async ({ data }) => {
    if (data) {
      setCookie(CURRENT_PROPERTY_COOKIE, JSON.stringify(data), {
        path: '/',
        maxAge: 60 * 60 * 24 * 365, // 1 year
        sameSite: 'lax',
      })
    } else {
      // Clear the cookie
      setCookie(CURRENT_PROPERTY_COOKIE, '', {
        path: '/',
        maxAge: 0,
      })
    }
    return { success: true }
  })

/**
 * Client-side helpers for reading/writing the cookie directly
 */
export function getCurrentPropertyFromCookie(): CurrentProperty | null {
  if (typeof document === 'undefined') return null

  const cookies = document.cookie.split(';')
  for (const cookie of cookies) {
    const [name, value] = cookie.trim().split('=')
    if (name === CURRENT_PROPERTY_COOKIE && value) {
      try {
        return JSON.parse(decodeURIComponent(value)) as CurrentProperty
      } catch {
        return null
      }
    }
  }
  return null
}

export function setCurrentPropertyCookie(property: CurrentProperty | null): void {
  if (typeof document === 'undefined') return

  if (property) {
    const value = encodeURIComponent(JSON.stringify(property))
    document.cookie = `${CURRENT_PROPERTY_COOKIE}=${value}; path=/; max-age=${60 * 60 * 24 * 365}; samesite=lax`
  } else {
    document.cookie = `${CURRENT_PROPERTY_COOKIE}=; path=/; max-age=0`
  }
}
