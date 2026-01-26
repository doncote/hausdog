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
