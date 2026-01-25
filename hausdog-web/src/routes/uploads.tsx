import { createFileRoute, useRouteContext } from '@tanstack/react-router'
import { useState, useCallback, useRef, useEffect } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { requireAuthFromContext } from '@/lib/auth'
import {
  useDocumentsForUser,
  useUploadDocument,
  useExtractDocument,
  useDeleteDocument,
  getSignedUrl,
  type Document,
} from '@/features/documents'
import {
  BookOpen,
  Receipt,
  FileText,
  Shield,
  FileCheck,
  ClipboardCheck,
  Wrench,
  Camera,
  File,
  Upload,
  Trash2,
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

export const Route = createFileRoute('/uploads')({
  beforeLoad: ({ context }) => {
    requireAuthFromContext(context)
  },
  component: UploadsPage,
})

function DocTypeIcon({ type }: { type?: string }) {
  const iconClass = 'size-5 text-muted-foreground'
  switch (type) {
    case 'manual':
      return <BookOpen className={iconClass} />
    case 'receipt':
      return <Receipt className={iconClass} />
    case 'invoice':
      return <FileText className={iconClass} />
    case 'warranty':
      return <Shield className={iconClass} />
    case 'permit':
      return <FileCheck className={iconClass} />
    case 'inspection':
      return <ClipboardCheck className={iconClass} />
    case 'service_record':
      return <Wrench className={iconClass} />
    case 'photo':
      return <Camera className={iconClass} />
    default:
      return <File className={iconClass} />
  }
}

interface UploadQueueItem {
  id: string
  file: File
  status: 'pending' | 'uploading' | 'extracting' | 'complete' | 'error'
  error?: string
}

function UploadsPage() {
  const { user } = useRouteContext({ from: '/uploads' })
  const [isDragging, setIsDragging] = useState(false)
  const [uploadQueue, setUploadQueue] = useState<UploadQueueItem[]>([])
  const fileInputRef = useRef<HTMLInputElement>(null)
  const processingRef = useRef(false)

  const { data: documents, isPending } = useDocumentsForUser(user?.id)
  const uploadDocument = useUploadDocument()
  const extractDocument = useExtractDocument()
  const deleteDocumentMutation = useDeleteDocument()

  const addToQueue = useCallback((files: File[]) => {
    const validFiles = files.filter(
      (f) => f.type.startsWith('image/') || f.type === 'application/pdf'
    )

    if (validFiles.length !== files.length) {
      toast.error('Some files were skipped (only images and PDFs allowed)')
    }

    const newItems: UploadQueueItem[] = validFiles.map((file) => ({
      id: crypto.randomUUID(),
      file,
      status: 'pending',
    }))

    setUploadQueue((prev) => [...prev, ...newItems])
  }, [])

  const processQueue = useCallback(async () => {
    if (processingRef.current || !user) return

    const pendingItem = uploadQueue.find((item) => item.status === 'pending')
    if (!pendingItem) return

    processingRef.current = true

    // Update status to uploading
    setUploadQueue((prev) =>
      prev.map((item) => (item.id === pendingItem.id ? { ...item, status: 'uploading' } : item))
    )

    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => {
          const result = reader.result as string
          const base64Data = result.split(',')[1]
          resolve(base64Data)
        }
        reader.onerror = reject
        reader.readAsDataURL(pendingItem.file)
      })

      const doc = await uploadDocument.mutateAsync({
        userId: user.id,
        filename: pendingItem.file.name,
        contentType: pendingItem.file.type,
        fileData: base64,
      })

      // Update status to extracting
      setUploadQueue((prev) =>
        prev.map((item) => (item.id === pendingItem.id ? { ...item, status: 'extracting' } : item))
      )

      await extractDocument.mutateAsync({
        documentId: doc.id,
        userId: user.id,
      })

      // Update status to complete
      setUploadQueue((prev) =>
        prev.map((item) => (item.id === pendingItem.id ? { ...item, status: 'complete' } : item))
      )
    } catch (err) {
      setUploadQueue((prev) =>
        prev.map((item) =>
          item.id === pendingItem.id
            ? { ...item, status: 'error', error: err instanceof Error ? err.message : 'Failed' }
            : item
        )
      )
    } finally {
      processingRef.current = false
    }
  }, [uploadQueue, user, uploadDocument, extractDocument])

  // Process queue when items are added
  useEffect(() => {
    const hasPending = uploadQueue.some((item) => item.status === 'pending')
    if (hasPending && !processingRef.current) {
      processQueue()
    }
  }, [uploadQueue, processQueue])

  const removeFromQueue = (id: string) => {
    setUploadQueue((prev) => prev.filter((item) => item.id !== id))
  }

  const clearCompleted = () => {
    setUploadQueue((prev) => prev.filter((item) => item.status !== 'complete'))
  }

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault()
      e.stopPropagation()
      setIsDragging(false)

      const files = Array.from(e.dataTransfer.files)
      if (files.length > 0) {
        addToQueue(files)
      }
    },
    [addToQueue]
  )

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const files = Array.from(e.target.files || [])
      if (files.length > 0) {
        addToQueue(files)
      }
      e.target.value = ''
    },
    [addToQueue]
  )

  const handleDelete = async (doc: Document) => {
    if (!user) return
    if (!confirm('Delete this document?')) return

    try {
      await deleteDocumentMutation.mutateAsync({
        id: doc.id,
        userId: user.id,
      })
      toast.success('Document deleted')
    } catch {
      toast.error('Failed to delete document')
    }
  }

  const activeUploads = uploadQueue.filter(
    (item) => item.status !== 'complete' && item.status !== 'error'
  )
  const hasCompleted = uploadQueue.some((item) => item.status === 'complete')

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight">Uploads</h1>
          <p className="text-muted-foreground mt-1">
            Upload documents to extract information automatically
          </p>
        </div>

        {/* Drop Zone */}
        <div
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          onClick={() => fileInputRef.current?.click()}
          className={cn(
            'relative rounded-xl border-2 border-dashed p-8 mb-8 cursor-pointer transition-all',
            isDragging
              ? 'border-primary bg-primary/5 scale-[1.01]'
              : 'border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/30'
          )}
        >
          <input
            ref={fileInputRef}
            type="file"
            className="hidden"
            accept="image/*,application/pdf"
            multiple
            onChange={handleFileSelect}
          />
          <div className="flex flex-col items-center text-center">
            <div
              className={cn(
                'rounded-full p-4 mb-4 transition-colors',
                isDragging ? 'bg-primary/20' : 'bg-muted'
              )}
            >
              <Upload
                className={cn('h-8 w-8 transition-colors', isDragging ? 'text-primary' : 'text-muted-foreground')}
              />
            </div>
            <h3 className="text-lg font-semibold mb-1">
              {isDragging ? 'Drop files here' : 'Drag & drop files here'}
            </h3>
            <p className="text-muted-foreground text-sm mb-4">or click to browse</p>
            <p className="text-xs text-muted-foreground">Supports images and PDFs</p>
          </div>
        </div>

        {/* Upload Queue */}
        {uploadQueue.length > 0 && (
          <div className="mb-8">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold">Upload Queue</h2>
              {hasCompleted && (
                <Button variant="ghost" size="sm" onClick={clearCompleted}>
                  Clear completed
                </Button>
              )}
            </div>
            <div className="space-y-2">
              {uploadQueue.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-3 rounded-lg border bg-card p-3"
                >
                  <div className="flex-shrink-0">
                    {item.status === 'pending' && (
                      <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                        <File className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    {(item.status === 'uploading' || item.status === 'extracting') && (
                      <div className="h-8 w-8 rounded-full bg-blue-100 flex items-center justify-center">
                        <Loader2 className="h-4 w-4 text-blue-600 animate-spin" />
                      </div>
                    )}
                    {item.status === 'complete' && (
                      <div className="h-8 w-8 rounded-full bg-green-100 flex items-center justify-center">
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      </div>
                    )}
                    {item.status === 'error' && (
                      <div className="h-8 w-8 rounded-full bg-red-100 flex items-center justify-center">
                        <AlertCircle className="h-4 w-4 text-red-600" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{item.file.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.status === 'pending' && 'Waiting...'}
                      {item.status === 'uploading' && 'Uploading...'}
                      {item.status === 'extracting' && 'Extracting data...'}
                      {item.status === 'complete' && 'Complete'}
                      {item.status === 'error' && (item.error || 'Failed')}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-foreground"
                    onClick={() => removeFromQueue(item.id)}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Documents List */}
        <div>
          <h2 className="text-lg font-semibold mb-4">Documents</h2>
          {isPending ? (
            <div className="space-y-3">
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
              <Skeleton className="h-24 w-full rounded-xl" />
            </div>
          ) : documents && documents.length > 0 ? (
            <div className="space-y-3">
              {documents.map((doc) => (
                <DocumentCard
                  key={doc.id}
                  document={doc}
                  userId={user!.id}
                  onDelete={() => handleDelete(doc)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-xl border bg-muted/30 p-8 text-center">
              <p className="text-muted-foreground">
                No documents yet. Drop some files above to get started.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function DocumentCard({
  document,
  userId,
  onDelete,
}: {
  document: Document
  userId: string
  onDelete: () => void
}) {
  const [thumbnailUrl, setThumbnailUrl] = useState<string | null>(null)

  useEffect(() => {
    if (document.contentType.startsWith('image/')) {
      getSignedUrl({ data: { storagePath: document.storagePath, userId } })
        .then((result) => setThumbnailUrl(result.signedUrl))
        .catch(() => {})
    }
  }, [document.storagePath, document.contentType, userId])

  const statusColors: Record<string, string> = {
    pending: 'bg-yellow-100 text-yellow-800',
    processing: 'bg-blue-100 text-blue-800',
    complete: 'bg-green-100 text-green-800',
    failed: 'bg-red-100 text-red-800',
  }

  return (
    <Card>
      <CardContent className="py-4">
        <div className="flex items-center gap-4">
          {/* Thumbnail */}
          <div className="flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-muted">
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt={document.filename}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-muted-foreground">
                {document.contentType.startsWith('image/') ? (
                  <Camera className="h-6 w-6" />
                ) : (
                  <FileText className="h-6 w-6" />
                )}
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            {document.extractedData ? (
              <>
                <div className="flex items-center gap-2">
                  <DocTypeIcon type={document.extractedData.documentType} />
                  <h3 className="font-medium">
                    {document.extractedData.equipment?.manufacturer &&
                    document.extractedData.equipment?.model
                      ? `${document.extractedData.equipment.manufacturer} ${document.extractedData.equipment.model}`
                      : document.extractedData.equipment?.manufacturer ||
                        document.extractedData.documentType ||
                        'Document'}
                  </h3>
                  {document.processingStatus !== 'complete' && (
                    <Badge className={statusColors[document.processingStatus] || ''}>
                      {document.processingStatus}
                    </Badge>
                  )}
                </div>
                {document.extractedData.suggestedCategory && (
                  <p className="text-sm text-muted-foreground mt-0.5">
                    Category: {document.extractedData.suggestedCategory}
                  </p>
                )}
                {document.extractedData.financial?.amount && (
                  <p className="text-sm mt-0.5">
                    ${document.extractedData.financial.amount.toFixed(2)}
                    {document.extractedData.financial.vendor && (
                      <span className="text-muted-foreground">
                        {' '}
                        from {document.extractedData.financial.vendor}
                      </span>
                    )}
                  </p>
                )}
                <p className="text-xs text-muted-foreground mt-1 truncate">{document.filename}</p>
              </>
            ) : (
              <>
                <div className="flex items-center gap-2">
                  <h3 className="font-medium truncate">{document.filename}</h3>
                  <Badge className={statusColors[document.processingStatus] || ''}>
                    {document.processingStatus}
                  </Badge>
                </div>
              </>
            )}
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground">
              {new Date(document.createdAt).toLocaleDateString()}
            </span>
            <Button
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-destructive"
              onClick={onDelete}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
