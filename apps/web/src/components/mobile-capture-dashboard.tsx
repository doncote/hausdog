import { Link } from '@tanstack/react-router'
import { Camera, Check, FileText, Loader2, Menu, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { DocumentType, uploadDocument } from '@/features/documents'
import { useCurrentProperty } from '@/hooks/use-current-property'
import { capturePhoto } from '@/lib/camera'

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
            : c,
        ),
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
          type="button"
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
