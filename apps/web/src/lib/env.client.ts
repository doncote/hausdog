/**
 * Client-side environment variables.
 * These are injected into window.ENV at runtime by the root layout.
 */

declare global {
  interface Window {
    ENV?: {
      GOOGLE_PLACES_API_KEY?: string
    }
  }
}

export function getClientEnv() {
  if (typeof window === 'undefined') {
    return {}
  }
  return window.ENV ?? {}
}

export function getGooglePlacesApiKey(): string | undefined {
  return getClientEnv().GOOGLE_PLACES_API_KEY
}
