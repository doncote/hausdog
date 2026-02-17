import { Capacitor } from '@capacitor/core'
import { type ActionPerformed, PushNotifications, type Token } from '@capacitor/push-notifications'

export interface PushNotificationCallbacks {
  onRegistration?: (token: string) => void
  onRegistrationError?: (error: Error) => void
  onNotificationReceived?: (notification: {
    title?: string
    body?: string
    data?: Record<string, unknown>
  }) => void
  onNotificationAction?: (action: ActionPerformed) => void
}

export async function initializePushNotifications(
  callbacks: PushNotificationCallbacks,
): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) {
    console.log('Push notifications only available on native platforms')
    return false
  }

  // Request permission
  const permStatus = await PushNotifications.requestPermissions()

  if (permStatus.receive !== 'granted') {
    console.log('Push notification permission denied')
    return false
  }

  // Register listeners
  PushNotifications.addListener('registration', (token: Token) => {
    console.log('Push registration success, token:', token.value)
    callbacks.onRegistration?.(token.value)
  })

  PushNotifications.addListener('registrationError', (error) => {
    console.error('Push registration error:', error)
    callbacks.onRegistrationError?.(new Error(error.error))
  })

  PushNotifications.addListener('pushNotificationReceived', (notification) => {
    console.log('Push notification received:', notification)
    callbacks.onNotificationReceived?.({
      title: notification.title,
      body: notification.body,
      data: notification.data,
    })
  })

  PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
    console.log('Push notification action:', action)
    callbacks.onNotificationAction?.(action)
  })

  // Register with APNs/FCM
  await PushNotifications.register()

  return true
}

export async function getDeliveredNotifications() {
  if (!Capacitor.isNativePlatform()) return []

  const result = await PushNotifications.getDeliveredNotifications()
  return result.notifications
}

export async function clearAllNotifications() {
  if (!Capacitor.isNativePlatform()) return

  await PushNotifications.removeAllDeliveredNotifications()
}
