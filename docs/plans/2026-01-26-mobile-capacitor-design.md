# Mobile App with Capacitor - Design Document

## Overview

Add native mobile capabilities to Hausdog using Capacitor, enabling camera capture and push notifications on iOS and Android.

## Goals

1. Native camera capture with viewfinder, flash control
2. Push notifications for document extraction complete and maintenance reminders
3. Mobile-first dashboard focused on quick photo capture
4. Support both iOS and Android

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    Mobile Apps                          │
│  ┌─────────────┐                    ┌─────────────┐    │
│  │   iOS App   │                    │ Android App │    │
│  │ (Capacitor) │                    │ (Capacitor) │    │
│  └──────┬──────┘                    └──────┬──────┘    │
│         │    Native Camera Plugin          │           │
│         │    Push Notifications            │           │
└─────────┼──────────────────────────────────┼───────────┘
          │                                  │
          ▼                                  ▼
┌─────────────────────────────────────────────────────────┐
│              Existing TanStack Start App                │
│         (runs inside Capacitor WebView)                 │
└─────────────────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────┐
│                     Backend                             │
│  ┌─────────────┐  ┌─────────────┐  ┌───────────────┐   │
│  │  Supabase   │  │ Trigger.dev │  │ Firebase FCM  │   │
│  │  (DB/Auth)  │  │ (Scheduled) │  │ (Push Send)   │   │
│  └─────────────┘  └─────────────┘  └───────────────┘   │
└─────────────────────────────────────────────────────────┘
```

## Project Structure

```
hausdog/
├── hausdog-web/           # Existing TanStack Start app (unchanged)
│   ├── src/
│   ├── dist/              # Build output (Capacitor points here)
│   └── ...
├── mobile/                # New Capacitor project
│   ├── ios/               # Xcode project
│   ├── android/           # Android Studio project
│   ├── capacitor.config.ts
│   └── package.json       # Capacitor deps
└── ...
```

## Capacitor Plugins

| Plugin | Purpose |
|--------|---------|
| `@capacitor/camera` | Native camera with viewfinder, flash, front/back switch |
| `@capacitor/push-notifications` | Register device, receive push tokens, handle notifications |
| `@capacitor/filesystem` | Save captured photos before upload |
| `@capacitor/app` | Handle app lifecycle (background/foreground for notifications) |

## Camera Capture Flow

### User Experience

1. User taps "Capture" button on uploads page or mobile dashboard
2. Native camera opens with viewfinder, flash toggle, front/back switch
3. User takes photo → preview appears → confirm or retake
4. Photo returns to web app as base64
5. Existing upload flow handles the rest (upload → extract)

### Implementation

```typescript
// src/lib/camera.ts
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera'
import { Capacitor } from '@capacitor/core'

export async function capturePhoto() {
  if (!Capacitor.isNativePlatform()) {
    return null  // Fallback to file input on web
  }

  const photo = await Camera.getPhoto({
    resultType: CameraResultType.Base64,
    source: CameraSource.Camera,
    quality: 90,
  })

  return photo.base64String
}
```

## Mobile-First Dashboard

On native platforms, logged-in dashboard is capture-focused:

```
┌─────────────────────────────┐
│  Hausdog            [Menu]  │
├─────────────────────────────┤
│                             │
│      ┌───────────────┐      │
│      │               │      │
│      │   📷 Camera   │      │
│      │               │      │
│      │  Tap to       │      │
│      │  capture      │      │
│      │               │      │
│      └───────────────┘      │
│                             │
│   Recent captures (3)       │
│   ┌─────┐ ┌─────┐ ┌─────┐   │
│   │ img │ │ img │ │ img │   │
│   └─────┘ └─────┘ └─────┘   │
│                             │
│   [View all documents →]    │
└─────────────────────────────┘
```

- Giant camera button - one-tap capture
- Recent captures row for confirmation
- Minimal navigation, menu tucked away
- Use `Capacitor.isNativePlatform()` to detect mobile vs desktop

## Push Notifications

### Database Schema

```sql
CREATE TABLE device_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  token TEXT NOT NULL,
  platform TEXT NOT NULL,  -- 'ios' or 'android'
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(user_id, token)
);
```

### Registration Flow

1. App launches → request notification permission
2. If granted → Capacitor plugin returns device token
3. App sends token to API → store in `device_tokens` table
4. Token refreshes periodically → update stored token

### Sending Notifications

```typescript
// src/lib/notifications.ts
import admin from 'firebase-admin'

export async function sendPushNotification(
  userId: string,
  title: string,
  body: string
) {
  const tokens = await getDeviceTokens(userId)

  if (tokens.length === 0) return

  await admin.messaging().sendEachForMulticast({
    tokens,
    notification: { title, body },
  })
}
```

### Notification Triggers

**1. Document extraction complete (event-based)**

Add to existing `extract.ts` after successful extraction:

```typescript
await sendPushNotification(userId,
  'Document processed',
  `Your ${extractedData.documentType} is ready to review`
)
```

**2. Maintenance reminders (scheduled via Trigger.dev)**

```typescript
// trigger/maintenance-reminders.ts
export const checkMaintenanceReminders = schedules.task({
  id: 'check-maintenance-reminders',
  cron: '0 9 * * *',  // Daily at 9am
  run: async () => {
    const dueItems = await getMaintenanceDueToday()

    for (const item of dueItems) {
      await sendPushNotification(item.userId,
        'Maintenance reminder',
        `${item.systemName}: ${item.taskName} is due today`
      )
    }
  },
})
```

## Setup Requirements

### Firebase

1. Create Firebase project
2. Enable Cloud Messaging
3. Download config files:
   - iOS: `GoogleService-Info.plist`
   - Android: `google-services.json`
4. Set up Firebase Admin SDK on server

### iOS

1. Apple Developer account
2. Push notification capability in Xcode
3. APNs key or certificate uploaded to Firebase

### Android

1. `google-services.json` in `android/app/`
2. No additional certificates needed

## Development Workflow

1. **Web changes:** Develop in browser as usual (`bun run dev`)
2. **Build:** `bun run build` outputs to `dist/`
3. **Sync:** `npx cap sync` copies build to native projects
4. **Run:** Open Xcode/Android Studio to run on device

## Implementation Order

1. Set up Capacitor project structure
2. Add camera plugin, implement capture flow
3. Add mobile-focused dashboard layout
4. Set up Firebase project
5. Add push notification plugin
6. Implement device token registration
7. Add extraction complete notification
8. Add maintenance reminder scheduled job

## Out of Scope

- Offline support
- App store distribution (can add later)
- Maintenance scheduling UI (separate feature)
