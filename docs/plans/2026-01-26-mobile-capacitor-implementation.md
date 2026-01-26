# Mobile Capacitor Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add native iOS/Android apps using Capacitor with camera capture and push notifications.

**Architecture:** Capacitor wraps the existing TanStack Start web app in a native WebView. Native plugins provide camera and push notification access. Firebase Cloud Messaging delivers notifications to both platforms.

**Tech Stack:** Capacitor 7, @capacitor/camera, @capacitor/push-notifications, Firebase Admin SDK, Trigger.dev for scheduled notifications

---

## Task 1: Initialize Capacitor Project

**Files:**
- Create: `apps/web/capacitor.config.ts`
- Modify: `apps/web/package.json`

**Step 1: Install Capacitor dependencies**

Run:
```bash
cd apps/web && bun add @capacitor/core @capacitor/cli @capacitor/ios @capacitor/android
```

**Step 2: Create Capacitor config**

Create `apps/web/capacitor.config.ts`:
```typescript
import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.hausdog.app',
  appName: 'Hausdog',
  webDir: '.output/public',
  server: {
    // For development, point to local dev server
    // url: 'http://localhost:3333',
    // cleartext: true,
  },
  ios: {
    contentInset: 'automatic',
  },
  android: {
    allowMixedContent: true,
  },
}

export default config
```

**Step 3: Add Capacitor scripts to package.json**

Add to `apps/web/package.json` scripts:
```json
{
  "cap:sync": "cap sync",
  "cap:open:ios": "cap open ios",
  "cap:open:android": "cap open android"
}
```

**Step 4: Initialize native platforms**

Run:
```bash
cd apps/web && bunx cap add ios && bunx cap add android
```

**Step 5: Commit**

```bash
git add apps/web/capacitor.config.ts apps/web/package.json apps/web/ios apps/web/android
git commit -m "feat: initialize Capacitor for iOS and Android"
```

---

## Task 2: Add Camera Plugin

**Files:**
- Create: `apps/web/src/lib/camera.ts`
- Modify: `apps/web/package.json`

**Step 1: Install camera plugin**

Run:
```bash
cd apps/web && bun add @capacitor/camera
```

**Step 2: Create camera utility**

Create `apps/web/src/lib/camera.ts`:
```typescript
import { Camera, CameraResultType, CameraSource, type Photo } from '@capacitor/camera'
import { Capacitor } from '@capacitor/core'

export interface CaptureResult {
  base64: string
  mimeType: string
  fileName: string
}

export function isNativePlatform(): boolean {
  return Capacitor.isNativePlatform()
}

export async function capturePhoto(): Promise<CaptureResult | null> {
  if (!Capacitor.isNativePlatform()) {
    return null
  }

  const photo: Photo = await Camera.getPhoto({
    resultType: CameraResultType.Base64,
    source: CameraSource.Camera,
    quality: 90,
    allowEditing: false,
    correctOrientation: true,
  })

  if (!photo.base64String) {
    throw new Error('No image data returned from camera')
  }

  const mimeType = `image/${photo.format}`
  const fileName = `capture-${Date.now()}.${photo.format}`

  return {
    base64: photo.base64String,
    mimeType,
    fileName,
  }
}

export async function pickFromGallery(): Promise<CaptureResult | null> {
  if (!Capacitor.isNativePlatform()) {
    return null
  }

  const photo: Photo = await Camera.getPhoto({
    resultType: CameraResultType.Base64,
    source: CameraSource.Photos,
    quality: 90,
  })

  if (!photo.base64String) {
    throw new Error('No image data returned from gallery')
  }

  const mimeType = `image/${photo.format}`
  const fileName = `photo-${Date.now()}.${photo.format}`

  return {
    base64: photo.base64String,
    mimeType,
    fileName,
  }
}
```

**Step 3: Sync native projects**

Run:
```bash
cd apps/web && bunx cap sync
```

**Step 4: Commit**

```bash
git add apps/web/src/lib/camera.ts apps/web/package.json
git commit -m "feat: add Capacitor camera plugin and utility"
```

---

## Task 3: Create Mobile Dashboard Layout

**Files:**
- Create: `apps/web/src/components/mobile-capture-dashboard.tsx`
- Modify: `apps/web/src/routes/_authenticated/dashboard.tsx`

**Step 1: Create mobile capture component**

Create `apps/web/src/components/mobile-capture-dashboard.tsx`:
```typescript
import { Link } from '@tanstack/react-router'
import { Camera, Check, FileText, Loader2, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { uploadDocument, DocumentType } from '@/features/documents'
import { useCurrentProperty } from '@/hooks/use-current-property'
import { capturePhoto, type CaptureResult } from '@/lib/camera'

interface RecentCapture {
  id: string
  fileName: string
  thumbnailUrl?: string
  status: 'uploading' | 'processing' | 'complete' | 'failed'
}

interface MobileCaptureDashboardProps {
  userId: string
}

export function MobileCaptureDashboard({ userId }: MobileCaptureDashboardProps) {
  const { currentProperty } = useCurrentProperty()
  const [isCapturing, setIsCapturing] = useState(false)
  const [recentCaptures, setRecentCaptures] = useState<RecentCapture[]>([])

  const handleCapture = async () => {
    if (!currentProperty) {
      toast.error('Please select a property first')
      return
    }

    setIsCapturing(true)

    try {
      const result = await capturePhoto()

      if (!result) {
        toast.error('Camera not available')
        return
      }

      // Add to recent captures with uploading status
      const captureId = `capture-${Date.now()}`
      const thumbnailUrl = `data:${result.mimeType};base64,${result.base64.slice(0, 1000)}`

      setRecentCaptures((prev) => [
        { id: captureId, fileName: result.fileName, thumbnailUrl, status: 'uploading' },
        ...prev.slice(0, 2), // Keep only last 3
      ])

      // Upload
      const uploadResult = await uploadDocument({
        data: {
          userId,
          propertyId: currentProperty.id,
          fileName: result.fileName,
          contentType: result.mimeType,
          fileData: result.base64,
          type: DocumentType.PHOTO,
        },
      })

      // Update status
      setRecentCaptures((prev) =>
        prev.map((c) =>
          c.id === captureId
            ? { ...c, id: uploadResult.id, status: uploadResult.runId ? 'processing' : 'complete' }
            : c
        )
      )

      toast.success('Photo captured and uploading')
    } catch (error) {
      console.error('Capture error:', error)
      toast.error('Failed to capture photo')
    } finally {
      setIsCapturing(false)
    }
  }

  if (!currentProperty) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] px-6">
        <div className="rounded-full bg-muted p-6 mb-4">
          <Camera className="h-12 w-12 text-muted-foreground" />
        </div>
        <h2 className="text-xl font-semibold mb-2">No property selected</h2>
        <p className="text-muted-foreground text-center mb-6">
          Select a property to start capturing documents.
        </p>
        <Link to="/properties/new">
          <Button>Add Property</Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="flex flex-col min-h-[80vh] px-4 py-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-xl font-bold">Hausdog</h1>
          <p className="text-sm text-muted-foreground">{currentProperty.name}</p>
        </div>
        <Link to="/settings">
          <Button variant="ghost" size="icon">
            <Menu className="h-5 w-5" />
          </Button>
        </Link>
      </div>

      {/* Main capture button */}
      <div className="flex-1 flex items-center justify-center">
        <button
          onClick={handleCapture}
          disabled={isCapturing}
          className="w-48 h-48 rounded-full bg-primary text-primary-foreground flex flex-col items-center justify-center gap-3 shadow-lg active:scale-95 transition-transform disabled:opacity-50"
        >
          {isCapturing ? (
            <Loader2 className="h-16 w-16 animate-spin" />
          ) : (
            <>
              <Camera className="h-16 w-16" />
              <span className="text-lg font-medium">Tap to capture</span>
            </>
          )}
        </button>
      </div>

      {/* Recent captures */}
      {recentCaptures.length > 0 && (
        <div className="mt-6">
          <h3 className="text-sm font-medium text-muted-foreground mb-3">Recent captures</h3>
          <div className="flex gap-3">
            {recentCaptures.map((capture) => (
              <div
                key={capture.id}
                className="relative w-20 h-20 rounded-lg bg-muted overflow-hidden"
              >
                {capture.thumbnailUrl && (
                  <img
                    src={capture.thumbnailUrl}
                    alt={capture.fileName}
                    className="w-full h-full object-cover"
                  />
                )}
                <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                  {capture.status === 'uploading' || capture.status === 'processing' ? (
                    <Loader2 className="h-5 w-5 text-white animate-spin" />
                  ) : capture.status === 'complete' ? (
                    <Check className="h-5 w-5 text-green-400" />
                  ) : (
                    <X className="h-5 w-5 text-red-400" />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick links */}
      <div className="mt-6 flex gap-3">
        <Link to="/review" className="flex-1">
          <Button variant="outline" className="w-full gap-2">
            <FileText className="h-4 w-4" />
            Review
          </Button>
        </Link>
        <Link to="/documents" className="flex-1">
          <Button variant="outline" className="w-full">
            All Documents
          </Button>
        </Link>
      </div>
    </div>
  )
}
```

**Step 2: Update dashboard to use mobile layout**

Modify `apps/web/src/routes/_authenticated/dashboard.tsx`:

Add import at top:
```typescript
import { isNativePlatform } from '@/lib/camera'
import { MobileCaptureDashboard } from '@/components/mobile-capture-dashboard'
```

Replace the `DashboardPage` function body to check for native platform:
```typescript
function DashboardPage() {
  const { user } = Route.useRouteContext()

  // Show mobile capture-focused dashboard on native platforms
  if (isNativePlatform()) {
    return <MobileCaptureDashboard userId={user.id} />
  }

  // Existing desktop dashboard code below...
  const firstName = (user?.user_metadata?.full_name || user?.email || 'User').split(' ')[0]
  // ... rest of existing code
```

**Step 3: Commit**

```bash
git add apps/web/src/components/mobile-capture-dashboard.tsx apps/web/src/routes/_authenticated/dashboard.tsx
git commit -m "feat: add mobile-focused capture dashboard"
```

---

## Task 4: Update Capture Page for Native Camera

**Files:**
- Modify: `apps/web/src/routes/_authenticated/capture.tsx`

**Step 1: Add native camera support to capture page**

Add imports at top of `apps/web/src/routes/_authenticated/capture.tsx`:
```typescript
import { capturePhoto, pickFromGallery, isNativePlatform } from '@/lib/camera'
```

**Step 2: Add native capture handlers**

Add after the existing `handleFileSelect` function:
```typescript
const handleNativeCapture = async () => {
  try {
    const result = await capturePhoto()
    if (!result) return

    // Create a File-like object for the existing upload flow
    const file = new File(
      [Uint8Array.from(atob(result.base64), c => c.charCodeAt(0))],
      result.fileName,
      { type: result.mimeType }
    )

    // Add preview
    setPreviews((prev) => [...prev, `data:${result.mimeType};base64,${result.base64}`])
    setSelectedFiles((prev) => [...prev, file])
  } catch (error) {
    console.error('Native capture error:', error)
    toast.error('Failed to capture photo')
  }
}

const handleNativeGallery = async () => {
  try {
    const result = await pickFromGallery()
    if (!result) return

    const file = new File(
      [Uint8Array.from(atob(result.base64), c => c.charCodeAt(0))],
      result.fileName,
      { type: result.mimeType }
    )

    setPreviews((prev) => [...prev, `data:${result.mimeType};base64,${result.base64}`])
    setSelectedFiles((prev) => [...prev, file])
  } catch (error) {
    console.error('Gallery pick error:', error)
    toast.error('Failed to pick photo')
  }
}
```

**Step 3: Update buttons to use native camera when available**

Replace the upload buttons section:
```typescript
{/* Upload buttons */}
<div className="flex gap-3">
  {isNativePlatform() ? (
    <>
      <Button
        type="button"
        variant="outline"
        className="flex-1 gap-2"
        onClick={handleNativeCapture}
      >
        <Camera className="h-4 w-4" />
        Take Photo
      </Button>
      <Button
        type="button"
        variant="outline"
        className="flex-1 gap-2"
        onClick={handleNativeGallery}
      >
        <Image className="h-4 w-4" />
        Gallery
      </Button>
    </>
  ) : (
    <>
      <Button
        type="button"
        variant="outline"
        className="flex-1 gap-2"
        onClick={() => fileInputRef.current?.click()}
      >
        <FileUp className="h-4 w-4" />
        Choose Files
      </Button>
      <Button
        type="button"
        variant="outline"
        className="flex-1 gap-2"
        onClick={() => cameraInputRef.current?.click()}
      >
        <Camera className="h-4 w-4" />
        Take Photo
      </Button>
    </>
  )}
</div>
```

**Step 4: Commit**

```bash
git add apps/web/src/routes/_authenticated/capture.tsx
git commit -m "feat: integrate native camera in capture page"
```

---

## Task 5: Set Up Firebase Project

**Files:**
- Create: `apps/web/src/lib/firebase-admin.ts`
- Modify: `apps/web/package.json`

**Step 1: Install Firebase Admin SDK**

Run:
```bash
cd apps/web && bun add firebase-admin
```

**Step 2: Create Firebase admin utility**

Create `apps/web/src/lib/firebase-admin.ts`:
```typescript
import admin from 'firebase-admin'

let firebaseApp: admin.app.App | null = null

export function getFirebaseAdmin(): admin.app.App {
  if (firebaseApp) {
    return firebaseApp
  }

  const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY

  if (!serviceAccount) {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_KEY environment variable is not set')
  }

  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert(JSON.parse(serviceAccount)),
  })

  return firebaseApp
}

export function getMessaging(): admin.messaging.Messaging {
  return getFirebaseAdmin().messaging()
}
```

**Step 3: Document required Firebase setup**

The following must be done manually in Firebase Console:
1. Create a new Firebase project at https://console.firebase.google.com
2. Enable Cloud Messaging
3. Generate a service account key (Project Settings > Service Accounts > Generate new private key)
4. Add the JSON key to Doppler as `FIREBASE_SERVICE_ACCOUNT_KEY`
5. For iOS: Upload APNs key to Firebase (Project Settings > Cloud Messaging > Apple app configuration)
6. For Android: Download `google-services.json` to `apps/web/android/app/`

**Step 4: Commit**

```bash
git add apps/web/src/lib/firebase-admin.ts apps/web/package.json
git commit -m "feat: add Firebase Admin SDK for push notifications"
```

---

## Task 6: Create Device Token Storage

**Files:**
- Create: `supabase/migrations/20260126000000_device_tokens.sql`
- Create: `apps/web/src/features/notifications/service.ts`
- Create: `apps/web/src/features/notifications/index.ts`

**Step 1: Create migration for device tokens**

Create `supabase/migrations/20260126000000_device_tokens.sql`:
```sql
-- Device tokens for push notifications
CREATE TABLE IF NOT EXISTS public.device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL CHECK (platform IN ('ios', 'android', 'web')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, token)
);

-- Index for looking up tokens by user
CREATE INDEX idx_device_tokens_user_id ON public.device_tokens(user_id);

-- RLS policies
ALTER TABLE public.device_tokens ENABLE ROW LEVEL SECURITY;

-- Users can manage their own tokens
CREATE POLICY "Users can insert their own tokens"
  ON public.device_tokens
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own tokens"
  ON public.device_tokens
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own tokens"
  ON public.device_tokens
  FOR DELETE
  USING (auth.uid() = user_id);

-- Service role can read all tokens (for sending notifications)
CREATE POLICY "Service role can read all tokens"
  ON public.device_tokens
  FOR SELECT
  TO service_role
  USING (true);
```

**Step 2: Run migration**

Run:
```bash
supabase db push
```

**Step 3: Create notification service**

Create `apps/web/src/features/notifications/service.ts`:
```typescript
import { getMessaging } from '@/lib/firebase-admin'
import { db } from '@/lib/db'

export interface DeviceToken {
  id: string
  userId: string
  token: string
  platform: 'ios' | 'android' | 'web'
  createdAt: Date
  updatedAt: Date
}

export async function registerDeviceToken(
  userId: string,
  token: string,
  platform: 'ios' | 'android' | 'web'
): Promise<DeviceToken> {
  const result = await db.deviceToken.upsert({
    where: {
      userId_token: { userId, token },
    },
    update: {
      updatedAt: new Date(),
    },
    create: {
      userId,
      token,
      platform,
    },
  })

  return {
    id: result.id,
    userId: result.userId,
    token: result.token,
    platform: result.platform as 'ios' | 'android' | 'web',
    createdAt: result.createdAt,
    updatedAt: result.updatedAt,
  }
}

export async function removeDeviceToken(userId: string, token: string): Promise<void> {
  await db.deviceToken.deleteMany({
    where: { userId, token },
  })
}

export async function getDeviceTokens(userId: string): Promise<string[]> {
  const tokens = await db.deviceToken.findMany({
    where: { userId },
    select: { token: true },
  })

  return tokens.map((t) => t.token)
}

export async function sendPushNotification(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<{ successCount: number; failureCount: number }> {
  const tokens = await getDeviceTokens(userId)

  if (tokens.length === 0) {
    return { successCount: 0, failureCount: 0 }
  }

  const messaging = getMessaging()

  const response = await messaging.sendEachForMulticast({
    tokens,
    notification: {
      title,
      body,
    },
    data,
    apns: {
      payload: {
        aps: {
          sound: 'default',
          badge: 1,
        },
      },
    },
    android: {
      priority: 'high',
      notification: {
        sound: 'default',
        channelId: 'default',
      },
    },
  })

  // Remove invalid tokens
  const invalidTokens: string[] = []
  response.responses.forEach((resp, idx) => {
    if (!resp.success && resp.error?.code === 'messaging/registration-token-not-registered') {
      invalidTokens.push(tokens[idx])
    }
  })

  if (invalidTokens.length > 0) {
    await db.deviceToken.deleteMany({
      where: {
        userId,
        token: { in: invalidTokens },
      },
    })
  }

  return {
    successCount: response.successCount,
    failureCount: response.failureCount,
  }
}
```

**Step 4: Create index export**

Create `apps/web/src/features/notifications/index.ts`:
```typescript
export {
  registerDeviceToken,
  removeDeviceToken,
  getDeviceTokens,
  sendPushNotification,
} from './service'
export type { DeviceToken } from './service'
```

**Step 5: Commit**

```bash
git add supabase/migrations/20260126000000_device_tokens.sql apps/web/src/features/notifications/
git commit -m "feat: add device token storage and notification service"
```

---

## Task 7: Add Push Notification Plugin

**Files:**
- Modify: `apps/web/package.json`
- Create: `apps/web/src/lib/push-notifications.ts`
- Create: `apps/web/src/routes/api/notifications/register.ts`

**Step 1: Install push notification plugin**

Run:
```bash
cd apps/web && bun add @capacitor/push-notifications
```

**Step 2: Create push notification client utility**

Create `apps/web/src/lib/push-notifications.ts`:
```typescript
import { PushNotifications, type Token, type ActionPerformed } from '@capacitor/push-notifications'
import { Capacitor } from '@capacitor/core'

export interface PushNotificationCallbacks {
  onRegistration?: (token: string) => void
  onRegistrationError?: (error: Error) => void
  onNotificationReceived?: (notification: { title?: string; body?: string; data?: Record<string, unknown> }) => void
  onNotificationAction?: (action: ActionPerformed) => void
}

export async function initializePushNotifications(
  callbacks: PushNotificationCallbacks
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
```

**Step 3: Create API route for token registration**

Create `apps/web/src/routes/api/notifications/register.ts`:
```typescript
import { createFileRoute } from '@tanstack/react-router'
import { z } from 'zod'

const RegisterTokenSchema = z.object({
  token: z.string().min(1),
  platform: z.enum(['ios', 'android', 'web']),
})

export const Route = createFileRoute('/api/notifications/register')({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { registerDeviceToken } = await import('@/features/notifications')
        const { getSafeSession } = await import('@/lib/auth')

        const session = await getSafeSession(request)
        if (!session?.user) {
          return new Response(JSON.stringify({ error: 'Unauthorized' }), {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        const body = await request.json()
        const parsed = RegisterTokenSchema.safeParse(body)

        if (!parsed.success) {
          return new Response(JSON.stringify({ error: 'Invalid request', details: parsed.error }), {
            status: 400,
            headers: { 'Content-Type': 'application/json' },
          })
        }

        const { token, platform } = parsed.data

        const deviceToken = await registerDeviceToken(session.user.id, token, platform)

        return new Response(JSON.stringify({ success: true, id: deviceToken.id }), {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
        })
      },
    },
  },
})
```

**Step 4: Sync native projects**

Run:
```bash
cd apps/web && bunx cap sync
```

**Step 5: Commit**

```bash
git add apps/web/src/lib/push-notifications.ts apps/web/src/routes/api/notifications/ apps/web/package.json
git commit -m "feat: add push notification plugin and registration API"
```

---

## Task 8: Initialize Push Notifications on App Start

**Files:**
- Modify: `apps/web/src/routes/_authenticated.tsx`

**Step 1: Add push notification initialization**

Add imports to `apps/web/src/routes/_authenticated.tsx`:
```typescript
import { useEffect } from 'react'
import { initializePushNotifications } from '@/lib/push-notifications'
import { isNativePlatform } from '@/lib/camera'
```

**Step 2: Add initialization effect in component**

Inside the authenticated layout component, add:
```typescript
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
```

**Step 3: Commit**

```bash
git add apps/web/src/routes/_authenticated.tsx
git commit -m "feat: initialize push notifications on app start"
```

---

## Task 9: Add Extraction Complete Notification

**Files:**
- Modify: `apps/web/trigger/process-document.ts`

**Step 1: Add notification to document processing task**

In `apps/web/trigger/process-document.ts`, add import:
```typescript
import { sendPushNotification } from '@/features/notifications'
```

**Step 2: Send notification after extraction completes**

At the end of the successful processing path, add:
```typescript
// Send push notification
await sendPushNotification(
  payload.userId,
  'Document processed',
  `Your ${extractedData.documentType || 'document'} is ready to review`,
  { documentId: payload.documentId }
)
```

**Step 3: Commit**

```bash
git add apps/web/trigger/process-document.ts
git commit -m "feat: send push notification when document extraction completes"
```

---

## Task 10: Add Maintenance Reminder Scheduled Task

**Files:**
- Create: `apps/web/trigger/maintenance-reminders.ts`
- Modify: `apps/web/prisma/schema.prisma` (if maintenance schedules don't exist)

**Step 1: Create scheduled task for maintenance reminders**

Create `apps/web/trigger/maintenance-reminders.ts`:
```typescript
import { schedules } from '@trigger.dev/sdk'
import { db } from '@/lib/db'
import { sendPushNotification } from '@/features/notifications'

export const checkMaintenanceReminders = schedules.task({
  id: 'check-maintenance-reminders',
  cron: '0 9 * * *', // Daily at 9am UTC
  run: async (payload) => {
    console.log('Checking maintenance reminders for', payload.timestamp)

    // Get items with maintenance due today or overdue
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)

    // Query for items with maintenance due
    // Note: This assumes a nextMaintenanceDate field exists on items
    // Adjust based on actual schema
    const dueItems = await db.item.findMany({
      where: {
        nextMaintenanceDate: {
          gte: today,
          lt: tomorrow,
        },
      },
      include: {
        property: {
          select: {
            name: true,
            userId: true,
          },
        },
      },
    })

    console.log(`Found ${dueItems.length} items with maintenance due today`)

    // Group by user
    const userItems = new Map<string, typeof dueItems>()
    for (const item of dueItems) {
      const userId = item.property.userId
      if (!userItems.has(userId)) {
        userItems.set(userId, [])
      }
      userItems.get(userId)!.push(item)
    }

    // Send notifications
    for (const [userId, items] of userItems) {
      const count = items.length
      const firstItem = items[0]

      await sendPushNotification(
        userId,
        'Maintenance reminder',
        count === 1
          ? `${firstItem.name} maintenance is due today`
          : `${count} items have maintenance due today`,
        { type: 'maintenance', count: String(count) }
      )
    }

    return {
      checkedAt: payload.timestamp,
      itemsFound: dueItems.length,
      usersNotified: userItems.size,
    }
  },
})
```

**Step 2: Commit**

```bash
git add apps/web/trigger/maintenance-reminders.ts
git commit -m "feat: add scheduled maintenance reminder notifications"
```

---

## Task 11: Configure iOS Native Project

**Files:**
- Modify: `apps/web/ios/App/App/Info.plist`
- Modify: `apps/web/ios/App/App/AppDelegate.swift`

**Step 1: Add required permissions to Info.plist**

Add to `apps/web/ios/App/App/Info.plist`:
```xml
<key>NSCameraUsageDescription</key>
<string>Hausdog needs camera access to capture documents and photos of your home items.</string>
<key>NSPhotoLibraryUsageDescription</key>
<string>Hausdog needs photo library access to select existing photos for documentation.</string>
<key>UIBackgroundModes</key>
<array>
    <string>remote-notification</string>
</array>
```

**Step 2: Add Firebase configuration**

Copy `GoogleService-Info.plist` from Firebase Console to `apps/web/ios/App/App/`

**Step 3: Commit**

```bash
git add apps/web/ios/
git commit -m "feat: configure iOS permissions and Firebase"
```

---

## Task 12: Configure Android Native Project

**Files:**
- Modify: `apps/web/android/app/src/main/AndroidManifest.xml`
- Create: `apps/web/android/app/google-services.json`

**Step 1: Add required permissions to AndroidManifest.xml**

Add to `apps/web/android/app/src/main/AndroidManifest.xml`:
```xml
<uses-permission android:name="android.permission.CAMERA" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE" />
<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />
```

**Step 2: Add Firebase configuration**

Download `google-services.json` from Firebase Console and place in `apps/web/android/app/`

**Step 3: Commit**

```bash
git add apps/web/android/
git commit -m "feat: configure Android permissions and Firebase"
```

---

## Task 13: Add Prisma Model for Device Tokens

**Files:**
- Modify: `apps/web/prisma/schema.prisma`

**Step 1: Add DeviceToken model**

Add to `apps/web/prisma/schema.prisma`:
```prisma
model DeviceToken {
  id        String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId    String   @map("user_id") @db.Uuid
  token     String
  platform  String
  createdAt DateTime @default(now()) @map("created_at")
  updatedAt DateTime @default(now()) @updatedAt @map("updated_at")

  @@unique([userId, token])
  @@index([userId])
  @@map("device_tokens")
}
```

**Step 2: Generate Prisma client**

Run:
```bash
cd apps/web && bunx prisma generate
```

**Step 3: Commit**

```bash
git add apps/web/prisma/schema.prisma
git commit -m "feat: add DeviceToken model to Prisma schema"
```

---

## Task 14: Build and Test on Device

**Step 1: Build web app**

Run:
```bash
cd apps/web && doppler run -- bun run build
```

**Step 2: Sync to native projects**

Run:
```bash
cd apps/web && bunx cap sync
```

**Step 3: Open in Xcode (iOS)**

Run:
```bash
cd apps/web && bunx cap open ios
```

Then in Xcode:
1. Select your development team
2. Connect your iPhone
3. Build and run (Cmd+R)

**Step 4: Open in Android Studio (Android)**

Run:
```bash
cd apps/web && bunx cap open android
```

Then in Android Studio:
1. Connect your Android device or start emulator
2. Build and run (Shift+F10)

**Step 5: Test camera capture**

1. Open app on device
2. Log in
3. Tap the capture button
4. Verify native camera opens
5. Take a photo
6. Verify upload works

**Step 6: Test push notifications**

1. Verify device token is registered (check database)
2. Trigger a document extraction
3. Verify notification appears when processing completes

---

## Summary

Implementation order:
1. Tasks 1-4: Capacitor setup and camera integration
2. Tasks 5-8: Push notification infrastructure
3. Tasks 9-10: Notification triggers
4. Tasks 11-13: Native platform configuration
5. Task 14: Testing

Environment variables needed:
- `FIREBASE_SERVICE_ACCOUNT_KEY`: Firebase Admin SDK credentials (JSON string)

Firebase setup required:
- Create Firebase project
- Enable Cloud Messaging
- iOS: Upload APNs key
- Android: Download `google-services.json`
