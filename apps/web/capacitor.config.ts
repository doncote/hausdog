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
