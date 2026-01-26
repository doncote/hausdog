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
