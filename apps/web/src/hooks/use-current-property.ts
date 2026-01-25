import { useQueryClient } from '@tanstack/react-query'
import { useCallback, useEffect, useState } from 'react'
import {
  type CurrentProperty,
  getCurrentPropertyFromCookie,
  setCurrentProperty,
  setCurrentPropertyCookie,
} from '@/lib/current-property'

/**
 * Hook to manage the current property selection.
 * Reads from cookie on mount, syncs changes to cookie and server.
 */
export function useCurrentProperty() {
  const [currentProperty, setCurrentPropertyState] = useState<CurrentProperty | null>(null)
  const [isLoaded, setIsLoaded] = useState(false)
  const queryClient = useQueryClient()

  // Load from cookie on mount
  useEffect(() => {
    const stored = getCurrentPropertyFromCookie()
    setCurrentPropertyState(stored)
    setIsLoaded(true)
  }, [])

  const selectProperty = useCallback(
    async (property: CurrentProperty | null) => {
      // Update local state immediately
      setCurrentPropertyState(property)

      // Update cookie (client-side for immediate effect)
      setCurrentPropertyCookie(property)

      // Also sync to server cookie
      await setCurrentProperty({ data: property })

      // Invalidate queries that depend on property
      queryClient.invalidateQueries({ queryKey: ['documents'] })
      queryClient.invalidateQueries({ queryKey: ['items'] })
      queryClient.invalidateQueries({ queryKey: ['spaces'] })
      queryClient.invalidateQueries({ queryKey: ['events'] })
      queryClient.invalidateQueries({ queryKey: ['conversations'] })
    },
    [queryClient],
  )

  const clearProperty = useCallback(() => {
    selectProperty(null)
  }, [selectProperty])

  return {
    currentProperty,
    isLoaded,
    selectProperty,
    clearProperty,
    hasProperty: !!currentProperty,
  }
}
