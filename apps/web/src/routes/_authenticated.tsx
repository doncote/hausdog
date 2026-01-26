import { createFileRoute, Outlet } from '@tanstack/react-router'
import { useEffect } from 'react'
import { Header } from '@/components/layout/header'
import { requireAuthFromContext } from '@/lib/auth'
import { isNativePlatform } from '@/lib/camera'
import { initializePushNotifications } from '@/lib/push-notifications'

export const Route = createFileRoute('/_authenticated')({
  beforeLoad: ({ context }) => {
    requireAuthFromContext(context)
  },
  component: AuthenticatedLayout,
})

function AuthenticatedLayout() {
  const { user } = Route.useRouteContext()

  useEffect(() => {
    if (!isNativePlatform()) return

    initializePushNotifications({
      onRegistration: async (token) => {
        // Determine platform
        const platform = /iPhone|iPad|iPod/.test(navigator.userAgent) ? 'ios' : 'android'

        // Register token with backend
        try {
          await fetch('/api/notifications/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token, platform }),
          })
          console.log('Device token registered')
        } catch (error) {
          console.error('Failed to register device token:', error)
        }
      },
      onNotificationReceived: (notification) => {
        // Handle foreground notification
        console.log('Notification received:', notification)
      },
      onNotificationAction: (action) => {
        // Handle notification tap - navigate to relevant page
        const data = action.notification.data
        if (data?.documentId) {
          // Navigate to document review
          window.location.href = `/review?documentId=${data.documentId}`
        }
      },
    })
  }, [])

  return (
    <div className="min-h-screen bg-background flex flex-col">
      <Header user={user!} />
      <main className="flex-1">
        <Outlet />
      </main>
    </div>
  )
}
