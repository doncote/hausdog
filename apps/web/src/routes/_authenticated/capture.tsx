import { createFileRoute, Link } from '@tanstack/react-router'
import { useRealtimeRun } from '@trigger.dev/react-hooks'
import { ArrowLeft, Camera, Check, FileUp, Home, Image, Loader2, X } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { DocumentType, uploadDocument } from '@/features/documents'
import { useCurrentProperty } from '@/hooks/use-current-property'

interface UploadedDoc {
  id: string
  fileName: string
  runId?: string
  accessToken?: string
  status: 'uploading' | 'processing' | 'complete' | 'failed'
}

function UploadProgress({ doc }: { doc: UploadedDoc }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg border bg-muted/30">
      <div className="rounded-lg bg-secondary p-2">
        {doc.status === 'complete' ? (
          <Check className="h-4 w-4 text-green-600" />
        ) : doc.status === 'failed' ? (
          <X className="h-4 w-4 text-red-600" />
        ) : (
          <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{doc.fileName}</p>
        <p className="text-xs text-muted-foreground">
          {doc.status === 'uploading' && 'Uploading...'}
          {doc.status === 'processing' && 'Processing with AI...'}
          {doc.status === 'complete' && 'Ready for review'}
          {doc.status === 'failed' && 'Failed'}
        </p>
      </div>
    </div>
  )
}

function RealtimeTracker({
  runId,
  accessToken,
  onComplete,
}: {
  runId: string
  accessToken: string
  onComplete: (status: 'complete' | 'failed') => void
}) {
  const { run } = useRealtimeRun(runId, { accessToken })

  useEffect(() => {
    if (run?.status === 'COMPLETED') {
      onComplete('complete')
    } else if (run?.status === 'FAILED') {
      onComplete('failed')
    }
  }, [run?.status, onComplete])

  return null
}

export const Route = createFileRoute('/_authenticated/capture')({
  component: CapturePage,
})

function CapturePage() {
  const { user } = Route.useRouteContext()
  const { currentProperty, isLoaded } = useCurrentProperty()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const cameraInputRef = useRef<HTMLInputElement>(null)

  const [selectedType, setSelectedType] = useState<string>(DocumentType.PHOTO)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [previews, setPreviews] = useState<string[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [uploadedDocs, setUploadedDocs] = useState<UploadedDoc[]>([])

  const handleRunComplete = (docId: string, status: 'complete' | 'failed') => {
    setUploadedDocs((prev) => prev.map((d) => (d.id === docId ? { ...d, status } : d)))
  }

  const allComplete =
    uploadedDocs.length > 0 &&
    uploadedDocs.every((d) => d.status === 'complete' || d.status === 'failed')
  const processingDocs = uploadedDocs.filter(
    (d) => d.status === 'processing' && d.runId && d.accessToken,
  )

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    // Generate previews for images
    const newPreviews: string[] = []
    files.forEach((file) => {
      if (file.type.startsWith('image/')) {
        const reader = new FileReader()
        reader.onload = (e) => {
          newPreviews.push(e.target?.result as string)
          if (newPreviews.length === files.filter((f) => f.type.startsWith('image/')).length) {
            setPreviews((prev) => [...prev, ...newPreviews])
          }
        }
        reader.readAsDataURL(file)
      }
    })

    setSelectedFiles((prev) => [...prev, ...files])
  }

  const removeFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
    setPreviews((prev) => prev.filter((_, i) => i !== index))
  }

  const handleUpload = async () => {
    if (!user || !currentProperty || selectedFiles.length === 0) {
      toast.error('Please select at least one file')
      return
    }

    setIsUploading(true)
    setUploadedDocs([])

    try {
      const newDocs: UploadedDoc[] = []

      for (const file of selectedFiles) {
        // Add to tracking with uploading status
        const tempId = `temp-${Date.now()}-${file.name}`
        setUploadedDocs((prev) => [
          ...prev,
          { id: tempId, fileName: file.name, status: 'uploading' },
        ])

        // Read file as base64
        const base64 = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader()
          reader.onload = () => {
            const result = reader.result as string
            // Remove data URL prefix to get pure base64
            const base64Data = result.split(',')[1]
            resolve(base64Data)
          }
          reader.onerror = reject
          reader.readAsDataURL(file)
        })

        const result = await uploadDocument({
          data: {
            userId: user.id,
            propertyId: currentProperty.id,
            fileName: file.name,
            contentType: file.type,
            fileData: base64,
            type: selectedType,
          },
        })

        // Update with real ID and processing status
        const uploadedDoc: UploadedDoc = {
          id: result.id,
          fileName: file.name,
          runId: result.runId,
          accessToken: result.publicAccessToken,
          status: result.runId ? 'processing' : 'complete',
        }
        newDocs.push(uploadedDoc)

        setUploadedDocs((prev) => prev.map((d) => (d.id === tempId ? uploadedDoc : d)))
      }

      toast.success(
        `${selectedFiles.length} document${selectedFiles.length > 1 ? 's' : ''} uploaded`,
      )
      setSelectedFiles([])
      setPreviews([])
    } catch (error) {
      console.error('Upload error:', error)
      toast.error('Failed to upload documents')
    } finally {
      setIsUploading(false)
    }
  }

  if (!isLoaded) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-10">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!currentProperty) {
    return (
      <div className="mx-auto max-w-2xl px-6 py-10">
        <div className="rounded-xl border-2 border-dashed bg-muted/30 p-12 text-center">
          <div className="mx-auto w-fit rounded-full bg-primary/10 p-4 mb-4">
            <Home className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No property selected</h3>
          <p className="text-muted-foreground mb-6">
            Select a property from the header to capture documents.
          </p>
          <Link to="/properties/new">
            <Button>Add Your First Property</Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-2xl px-6 py-10">
      <Link
        to="/dashboard"
        className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-8"
      >
        <ArrowLeft className="h-4 w-4" />
        Back to Dashboard
      </Link>

      <div className="rounded-xl border bg-card p-8">
        <div className="flex items-center gap-4 mb-8">
          <div className="rounded-lg bg-primary/10 p-3">
            <Camera className="h-6 w-6 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Capture Documents</h1>
            <p className="text-muted-foreground">Upload to {currentProperty.name}</p>
          </div>
        </div>

        <div className="space-y-6">
          {/* Document Type */}
          <div className="space-y-2">
            <Label htmlFor="type">Document Type</Label>
            <Select value={selectedType} onValueChange={setSelectedType}>
              <SelectTrigger id="type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(DocumentType).map(([key, value]) => (
                  <SelectItem key={value} value={value}>
                    {key.charAt(0) + key.slice(1).toLowerCase()}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* File Upload Area */}
          <div className="space-y-4">
            <Label>Documents</Label>

            {/* Hidden file inputs */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,application/pdf"
              multiple
              onChange={handleFileSelect}
              className="hidden"
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFileSelect}
              className="hidden"
            />

            {/* Upload buttons */}
            <div className="flex gap-3">
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
            </div>

            {/* Preview area */}
            {selectedFiles.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2">
                {selectedFiles.map((file, index) => (
                  <div
                    key={`${file.name}-${file.size}-${file.lastModified}`}
                    className="relative rounded-lg border bg-muted/30 p-3"
                  >
                    <button
                      type="button"
                      onClick={() => removeFile(index)}
                      className="absolute -top-2 -right-2 rounded-full bg-destructive p-1 text-destructive-foreground shadow-sm hover:bg-destructive/90"
                    >
                      <X className="h-3 w-3" />
                    </button>

                    {file.type.startsWith('image/') && previews[index] ? (
                      <img
                        src={previews[index]}
                        alt={file.name}
                        className="w-full h-32 object-cover rounded mb-2"
                      />
                    ) : (
                      <div className="w-full h-32 flex items-center justify-center bg-secondary rounded mb-2">
                        <Image className="h-8 w-8 text-muted-foreground" />
                      </div>
                    )}

                    <p className="text-sm font-medium truncate">{file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {(file.size / 1024).toFixed(0)} KB
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Upload button */}
          <Button
            onClick={handleUpload}
            disabled={selectedFiles.length === 0 || isUploading}
            className="w-full"
          >
            {isUploading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Uploading...
              </>
            ) : (
              <>Upload {selectedFiles.length > 0 && `(${selectedFiles.length})`}</>
            )}
          </Button>

          {/* Upload progress */}
          {uploadedDocs.length > 0 && (
            <div className="space-y-3 pt-4 border-t">
              <h3 className="text-sm font-medium">Processing</h3>
              {uploadedDocs.map((doc) => (
                <UploadProgress key={doc.id} doc={doc} />
              ))}
              {allComplete && (
                <Link to="/review" className="block">
                  <Button variant="outline" className="w-full gap-2">
                    <Check className="h-4 w-4" />
                    Review Documents
                  </Button>
                </Link>
              )}
              {/* Realtime trackers - rendered separately to avoid DOM issues */}
              {processingDocs.map((doc) => (
                <RealtimeTracker
                  key={doc.runId}
                  runId={doc.runId!}
                  accessToken={doc.accessToken!}
                  onComplete={(status) => handleRunComplete(doc.id, status)}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
