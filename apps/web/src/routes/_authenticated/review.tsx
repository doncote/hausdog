import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import {
  Check,
  ChevronRight,
  FileText,
  Image,
  Loader2,
  Trash2,
  X,
} from 'lucide-react'
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useProperties } from '@/features/properties'
import {
  usePendingReviewDocuments,
  useUpdateDocumentStatus,
  useDeleteDocument,
  DocumentStatus,
  type DocumentWithRelations,
  getSignedUrl,
} from '@/features/documents'

export const Route = createFileRoute('/_authenticated/review')({
  validateSearch: (search: Record<string, unknown>) => ({
    propertyId: (search.propertyId as string) || undefined,
  }),
  component: ReviewPage,
})

function ReviewPage() {
  const { user } = Route.useRouteContext()
  const { propertyId: initialPropertyId } = Route.useSearch()

  const { data: properties, isPending: propertiesLoading } = useProperties(user?.id)

  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(initialPropertyId || '')
  const [selectedDocument, setSelectedDocument] = useState<DocumentWithRelations | null>(null)
  const [documentUrl, setDocumentUrl] = useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [documentToDelete, setDocumentToDelete] = useState<DocumentWithRelations | null>(null)

  const { data: pendingDocuments, isPending: documentsLoading } =
    usePendingReviewDocuments(selectedPropertyId || undefined)

  const updateStatus = useUpdateDocumentStatus()
  const deleteDocument = useDeleteDocument()

  const handleViewDocument = async (doc: DocumentWithRelations) => {
    setSelectedDocument(doc)
    try {
      const { signedUrl } = await getSignedUrl({
        data: { storagePath: doc.storagePath, propertyId: doc.propertyId },
      })
      setDocumentUrl(signedUrl)
    } catch (error) {
      console.error('Failed to get document URL:', error)
      toast.error('Failed to load document')
    }
  }

  const handleConfirm = async (doc: DocumentWithRelations) => {
    try {
      await updateStatus.mutateAsync({
        id: doc.id,
        propertyId: doc.propertyId,
        status: DocumentStatus.CONFIRMED,
      })
      toast.success('Document confirmed')
      setSelectedDocument(null)
      setDocumentUrl(null)
    } catch (error) {
      console.error('Failed to confirm document:', error)
      toast.error('Failed to confirm document')
    }
  }

  const handleDiscard = async (doc: DocumentWithRelations) => {
    try {
      await updateStatus.mutateAsync({
        id: doc.id,
        propertyId: doc.propertyId,
        status: DocumentStatus.DISCARDED,
      })
      toast.success('Document discarded')
      setSelectedDocument(null)
      setDocumentUrl(null)
    } catch (error) {
      console.error('Failed to discard document:', error)
      toast.error('Failed to discard document')
    }
  }

  const handleDelete = async () => {
    if (!documentToDelete) return

    try {
      await deleteDocument.mutateAsync({
        id: documentToDelete.id,
        propertyId: documentToDelete.propertyId,
      })
      toast.success('Document deleted')
      setShowDeleteDialog(false)
      setDocumentToDelete(null)
      if (selectedDocument?.id === documentToDelete.id) {
        setSelectedDocument(null)
        setDocumentUrl(null)
      }
    } catch (error) {
      console.error('Failed to delete document:', error)
      toast.error('Failed to delete document')
    }
  }

  const pendingCount = pendingDocuments?.length || 0

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <nav className="flex items-center gap-2 text-sm mb-8">
        <Link
          to="/dashboard"
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          Dashboard
        </Link>
        <ChevronRight className="h-4 w-4 text-muted-foreground" />
        <span className="font-medium">Review Documents</span>
      </nav>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Review Documents</h1>
          <p className="text-muted-foreground mt-1">
            Review and confirm uploaded documents
          </p>
        </div>
        <Link to="/capture">
          <Button variant="outline" className="gap-2">
            <FileText className="h-4 w-4" />
            Capture More
          </Button>
        </Link>
      </div>

      {/* Property Selection */}
      <div className="mb-6 max-w-xs">
        <Label htmlFor="property" className="mb-2 block">
          Property
        </Label>
        <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
          <SelectTrigger id="property">
            <SelectValue placeholder="Select a property" />
          </SelectTrigger>
          <SelectContent>
            {propertiesLoading ? (
              <SelectItem value="loading" disabled>
                Loading...
              </SelectItem>
            ) : properties && properties.length > 0 ? (
              properties.map((property) => (
                <SelectItem key={property.id} value={property.id}>
                  {property.name}
                </SelectItem>
              ))
            ) : (
              <SelectItem value="none" disabled>
                No properties found
              </SelectItem>
            )}
          </SelectContent>
        </Select>
      </div>

      {!selectedPropertyId ? (
        <div className="rounded-xl border-2 border-dashed bg-muted/30 p-12 text-center">
          <p className="text-muted-foreground">
            Select a property to view documents pending review
          </p>
        </div>
      ) : documentsLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : pendingCount === 0 ? (
        <div className="rounded-xl border-2 border-dashed bg-muted/30 p-12 text-center">
          <div className="mx-auto w-fit rounded-full bg-primary/10 p-4 mb-4">
            <Check className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">All caught up!</h3>
          <p className="text-muted-foreground mb-6">
            No documents pending review for this property
          </p>
          <Link to="/capture">
            <Button className="gap-2">
              <FileText className="h-4 w-4" />
              Capture Documents
            </Button>
          </Link>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {pendingDocuments?.map((doc) => (
            <div
              key={doc.id}
              className="rounded-xl border bg-card p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-3 mb-4">
                <div className="rounded-lg bg-secondary p-2.5">
                  {doc.contentType.startsWith('image/') ? (
                    <Image className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <FileText className="h-5 w-5 text-muted-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{doc.fileName}</p>
                  <p className="text-sm text-muted-foreground">
                    {doc.type} · {(doc.sizeBytes / 1024).toFixed(0)} KB
                  </p>
                </div>
              </div>

              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleViewDocument(doc)}
                  className="flex-1"
                >
                  View
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => handleConfirm(doc)}
                  disabled={updateStatus.isPending}
                  className="flex-1 gap-1"
                >
                  <Check className="h-3 w-3" />
                  Confirm
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => {
                    setDocumentToDelete(doc)
                    setShowDeleteDialog(true)
                  }}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Document Preview Dialog */}
      <Dialog
        open={!!selectedDocument}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedDocument(null)
            setDocumentUrl(null)
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{selectedDocument?.fileName}</DialogTitle>
            <DialogDescription>
              {selectedDocument?.type} ·{' '}
              {selectedDocument && (selectedDocument.sizeBytes / 1024).toFixed(0)} KB
            </DialogDescription>
          </DialogHeader>

          <div className="py-4">
            {documentUrl ? (
              selectedDocument?.contentType.startsWith('image/') ? (
                <img
                  src={documentUrl}
                  alt={selectedDocument.fileName}
                  className="w-full rounded-lg"
                />
              ) : (
                <iframe
                  src={documentUrl}
                  title={selectedDocument?.fileName}
                  className="w-full h-[60vh] rounded-lg border"
                />
              )
            ) : (
              <div className="flex items-center justify-center h-64">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={() => selectedDocument && handleDiscard(selectedDocument)}
              disabled={updateStatus.isPending}
              className="gap-2"
            >
              <X className="h-4 w-4" />
              Discard
            </Button>
            <Button
              onClick={() => selectedDocument && handleConfirm(selectedDocument)}
              disabled={updateStatus.isPending}
              className="gap-2"
            >
              <Check className="h-4 w-4" />
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Document</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete "{documentToDelete?.fileName}"? This action
              cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteDialog(false)}>
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={deleteDocument.isPending}
            >
              {deleteDocument.isPending ? 'Deleting...' : 'Delete'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
