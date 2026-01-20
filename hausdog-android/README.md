# Hausdog Android App

Android companion app for Hausdog - take photos of home documents and upload for AI processing.

## Features

- Magic link authentication via Supabase
- Camera capture with CameraX
- Document upload to Supabase Storage
- AI extraction via Hausdog API
- Material 3 / Material You theming

## Tech Stack

- **Kotlin** - Primary language
- **Jetpack Compose** - Modern declarative UI
- **CameraX** - Camera capture
- **Supabase Kotlin SDK** - Auth & Storage
- **Ktor** - HTTP client
- **Coil** - Image loading

## Setup

### Prerequisites

- Android Studio Hedgehog (2023.1.1) or newer
- JDK 17
- Android SDK 35

### Configuration

1. Copy `local.properties.example` to `local.properties`
2. Set your Android SDK path
3. Set environment variables for Supabase:

```bash
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_KEY="your-anon-key"
```

Or add to `local.properties`:
```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_KEY=your-anon-key
```

### Build

```bash
# Debug build
./gradlew assembleDebug

# Install on connected device
./gradlew installDebug

# Run tests
./gradlew test
```

## Project Structure

```
app/src/main/kotlin/com/hausdog/app/
├── HausdogApp.kt          # Application class
├── MainActivity.kt        # Main activity & navigation
├── auth/
│   ├── AuthViewModel.kt   # Auth state management
│   └── LoginScreen.kt     # Login UI
├── camera/
│   ├── CameraViewModel.kt # Camera & upload logic
│   └── CameraScreen.kt    # Camera UI
├── data/
│   ├── SupabaseClient.kt  # Supabase initialization
│   ├── DocumentRepository.kt # Storage operations
│   └── ApiClient.kt       # Hausdog API client
└── ui/theme/
    └── Theme.kt           # Material 3 theme
```

## API Integration

The app uploads photos to Supabase Storage, then calls the Hausdog API to:
1. Create a document record
2. Trigger AI extraction
3. Poll for extraction results

### Endpoints Used

- `POST /api/documents` - Create document record
- `POST /api/documents/:id/extract` - Trigger extraction
- `GET /api/documents/:id` - Get document status/results

## Deep Links

The app handles `hausdog://auth/*` deep links for Supabase magic link authentication.

## License

Private - Hausdog
