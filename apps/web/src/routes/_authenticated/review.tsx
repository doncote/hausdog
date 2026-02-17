import { createFileRoute, Link, useNavigate } from '@tanstack/react-router'
import {
  Box,
  Check,
  ChevronRight,
  FileText,
  Home,
  Image,
  Link2,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  DocumentStatus,
  type DocumentWithRelations,
  useConfirmDocument,
  useDeleteDocument,
  usePendingReviewDocuments,
  useUpdateDocumentStatus,
} from '@/features/documents'
import { getSignedUrl } from '@/features/documents/upload'
import { useCurrentProperty } from '@/hooks/use-current-property'

export const Route = createFileRoute('/_authenticated/review')({
  component: ReviewPage,
})

// Helper to safely access extracted data
function getExtractedData(doc: DocumentWithRelations) {
  const data = doc.extractedData as {
    documentType?: string
    confidence?: number
    rawText?: string
    extracted?: {
      manufacturer?: string
      model?: string
      serialNumber?: string
      productName?: string
      date?: string
      price?: number
      vendor?: string
      warrantyExpires?: string
    }
    suggestedItemName?: string
    suggestedCategory?: string
  } | null
  return data
}

// Helper to safely access resolve data
function getResolveData(doc: DocumentWithRelations) {
  const data = doc.resolveData as {
    action?: 'NEW_ITEM' | 'ATTACH_TO_ITEM' | 'CHILD_OF_ITEM'
    matchedItemId?: string | null
    confidence?: number
    reasoning?: string
    suggestedEventType?: string | null
  } | null
  return data
}

function ReviewPage() {
  const { user } = Route.useRouteContext()
  const { currentProperty, isLoaded } = useCurrentProperty()
  const navigate = useNavigate()

  const [selectedDocument, setSelectedDocument] = useState<DocumentWithRelations | null>(null)
  const [documentUrl, setDocumentUrl] = useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [documentToDelete, setDocumentToDelete] = useState<DocumentWithRelations | null>(null)

  const {
    data: pendingDocuments,
    isPending: documentsLoading,
    refetch,
  } = usePendingReviewDocuments(currentProperty?.id)

  const updateStatus = useUpdateDocumentStatus()
  const confirmDocument = useConfirmDocument()
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
    if (!user) return

    try {
      const result = await confirmDocument.mutateAsync({
        documentId: doc.id,
        userId: user.id,
        propertyId: doc.propertyId,
      })

      if (result.itemId) {
        const message =
          result.action === 'NEW_ITEM'
            ? 'Item created from document'
            : result.action === 'CHILD_OF_ITEM'
              ? 'Component added to item'
              : 'Document attached to item'

        toast.success(message, {
          action: {
            label: 'View Item',
            onClick: () => navigate({ to: '/items/$itemId', params: { itemId: result.itemId! } }),
          },
        })
      } else {
        toast.success('Document confirmed')
      }

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

  if (!isLoaded) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </div>
    )
  }

  if (!currentProperty) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-10">
        <div className="rounded-xl border-2 border-dashed bg-muted/30 p-12 text-center">
          <div className="mx-auto w-fit rounded-full bg-primary/10 p-4 mb-4">
            <Home className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">No property selected</h3>
          <p className="text-muted-foreground mb-6">
            Select a property from the header to review documents.
          </p>
          <Link to="/properties/new">
            <Button>Add Your First Property</Button>
          </Link>
        </div>
      </div>
    )
  }

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
          <p className="text-muted-foreground mt-1">Pending review for {currentProperty.name}</p>
        </div>
        <div className="flex gap-2">
          <Button variant="ghost" size="icon" onClick={() => refetch()}>
            <RefreshCw className="h-4 w-4" />
          </Button>
          <Link to="/capture">
            <Button variant="outline" className="gap-2">
              <FileText className="h-4 w-4" />
              Capture More
            </Button>
          </Link>
        </div>
      </div>

      {documentsLoading ? (
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
        <div className="grid gap-4 md:grid-cols-2">
          {pendingDocuments?.map((doc) => {
            const extracted = getExtractedData(doc)
            const resolved = getResolveData(doc)

            return (
              <div
                key={doc.id}
                className="rounded-xl border bg-card p-4 hover:shadow-md transition-shadow"
              >
                {/* Header */}
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
                      {extracted?.documentType || doc.type} · {(doc.sizeBytes / 1024).toFixed(0)} KB
                    </p>
                  </div>
                </div>

                {/* AI Suggestion */}
                {resolved && (
                  <div className="mb-4 p-3 rounded-lg bg-muted/50">
                    <div className="flex items-center gap-2 mb-2">
                      {resolved.action === 'NEW_ITEM' && (
                        <>
                          <Plus className="h-4 w-4 text-green-600" />
                          <span className="text-sm font-medium text-green-600">
                            Create New Item
                          </span>
                        </>
                      )}
                      {resolved.action === 'ATTACH_TO_ITEM' && (
                        <>
                          <Link2 className="h-4 w-4 text-blue-600" />
                          <span className="text-sm font-medium text-blue-600">
                            Attach to Existing
                          </span>
                        </>
                      )}
                      {resolved.action === 'CHILD_OF_ITEM' && (
                        <>
                          <Box className="h-4 w-4 text-purple-600" />
                          <span className="text-sm font-medium text-purple-600">
                            Add as Component
                          </span>
                        </>
                      )}
                      {resolved.confidence && (
                        <span className="text-xs text-muted-foreground ml-auto">
                          {Math.round(resolved.confidence * 100)}% confident
                        </span>
                      )}
                    </div>
                    {resolved.reasoning && (
                      <p className="text-xs text-muted-foreground">{resolved.reasoning}</p>
                    )}
                  </div>
                )}

                {/* Extracted Details */}
                {extracted?.extracted && (
                  <div className="mb-4 space-y-1 text-sm">
                    {extracted.suggestedItemName && (
                      <p>
                        <span className="text-muted-foreground">Item:</span>{' '}
                        {extracted.suggestedItemName}
                      </p>
                    )}
                    {extracted.extracted.manufacturer && (
                      <p>
                        <span className="text-muted-foreground">Manufacturer:</span>{' '}
                        {extracted.extracted.manufacturer}
                      </p>
                    )}
                    {extracted.extracted.model && (
                      <p>
                        <span className="text-muted-foreground">Model:</span>{' '}
                        {extracted.extracted.model}
                      </p>
                    )}
                    {extracted.extracted.serialNumber && (
                      <p>
                        <span className="text-muted-foreground">Serial:</span>{' '}
                        {extracted.extracted.serialNumber}
                      </p>
                    )}
                    {extracted.suggestedCategory && (
                      <p>
                        <span className="text-muted-foreground">Category:</span>{' '}
                        {extracted.suggestedCategory}
                      </p>
                    )}
                    {extracted.extracted.price && (
                      <p>
                        <span className="text-muted-foreground">Price:</span> $
                        {extracted.extracted.price}
                      </p>
                    )}
                    {extracted.extracted.vendor && (
                      <p>
                        <span className="text-muted-foreground">Vendor:</span>{' '}
                        {extracted.extracted.vendor}
                      </p>
                    )}
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleViewDocument(doc)}>
                    View
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => handleConfirm(doc)}
                    disabled={confirmDocument.isPending}
                    className="flex-1 gap-1"
                  >
                    <Check className="h-3 w-3" />
                    Confirm & Create
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
            )
          })}
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
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>{selectedDocument?.fileName}</DialogTitle>
            <DialogDescription>
              Review the extracted information before confirming
            </DialogDescription>
          </DialogHeader>

          <div className="grid md:grid-cols-2 gap-6 py-4">
            {/* Document Preview */}
            <div>
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
                    className="w-full h-[50vh] rounded-lg border"
                  />
                )
              ) : (
                <div className="flex items-center justify-center h-64 bg-muted rounded-lg">
                  <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
                </div>
              )}
            </div>

            {/* Extracted Data */}
            <div className="space-y-4">
              {selectedDocument &&
                (() => {
                  const extracted = getExtractedData(selectedDocument)
                  const resolved = getResolveData(selectedDocument)

                  return (
                    <>
                      {/* AI Action */}
                      {resolved && (
                        <div className="p-4 rounded-lg bg-muted/50">
                          <h3 className="font-medium mb-2">AI Suggestion</h3>
                          <div className="flex items-center gap-2 mb-2">
                            {resolved.action === 'NEW_ITEM' && (
                              <>
                                <Plus className="h-4 w-4 text-green-600" />
                                <span className="font-medium text-green-600">Create New Item</span>
                              </>
                            )}
                            {resolved.action === 'ATTACH_TO_ITEM' && (
                              <>
                                <Link2 className="h-4 w-4 text-blue-600" />
                                <span className="font-medium text-blue-600">
                                  Attach to Existing Item
                                </span>
                              </>
                            )}
                            {resolved.action === 'CHILD_OF_ITEM' && (
                              <>
                                <Box className="h-4 w-4 text-purple-600" />
                                <span className="font-medium text-purple-600">
                                  Add as Component
                                </span>
                              </>
                            )}
                          </div>
                          {resolved.confidence && (
                            <p className="text-sm text-muted-foreground mb-1">
                              Confidence: {Math.round(resolved.confidence * 100)}%
                            </p>
                          )}
                          {resolved.reasoning && (
                            <p className="text-sm text-muted-foreground">{resolved.reasoning}</p>
                          )}
                          {resolved.suggestedEventType && (
                            <p className="text-sm mt-2">
                              <span className="text-muted-foreground">Event type:</span>{' '}
                              {resolved.suggestedEventType}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Extracted Details */}
                      {extracted && (
                        <div className="p-4 rounded-lg border">
                          <h3 className="font-medium mb-3">Extracted Information</h3>
                          <dl className="space-y-2 text-sm">
                            {extracted.suggestedItemName && (
                              <div>
                                <dt className="text-muted-foreground">Item Name</dt>
                                <dd className="font-medium">{extracted.suggestedItemName}</dd>
                              </div>
                            )}
                            {extracted.suggestedCategory && (
                              <div>
                                <dt className="text-muted-foreground">Category</dt>
                                <dd>{extracted.suggestedCategory}</dd>
                              </div>
                            )}
                            {extracted.extracted?.manufacturer && (
                              <div>
                                <dt className="text-muted-foreground">Manufacturer</dt>
                                <dd>{extracted.extracted.manufacturer}</dd>
                              </div>
                            )}
                            {extracted.extracted?.model && (
                              <div>
                                <dt className="text-muted-foreground">Model</dt>
                                <dd>{extracted.extracted.model}</dd>
                              </div>
                            )}
                            {extracted.extracted?.serialNumber && (
                              <div>
                                <dt className="text-muted-foreground">Serial Number</dt>
                                <dd className="font-mono text-xs">
                                  {extracted.extracted.serialNumber}
                                </dd>
                              </div>
                            )}
                            {extracted.extracted?.price && (
                              <div>
                                <dt className="text-muted-foreground">Price</dt>
                                <dd>${extracted.extracted.price}</dd>
                              </div>
                            )}
                            {extracted.extracted?.vendor && (
                              <div>
                                <dt className="text-muted-foreground">Vendor</dt>
                                <dd>{extracted.extracted.vendor}</dd>
                              </div>
                            )}
                            {extracted.extracted?.date && (
                              <div>
                                <dt className="text-muted-foreground">Date</dt>
                                <dd>{extracted.extracted.date}</dd>
                              </div>
                            )}
                            {extracted.extracted?.warrantyExpires && (
                              <div>
                                <dt className="text-muted-foreground">Warranty Expires</dt>
                                <dd>{extracted.extracted.warrantyExpires}</dd>
                              </div>
                            )}
                            {extracted.documentType && (
                              <div>
                                <dt className="text-muted-foreground">Document Type</dt>
                                <dd>{extracted.documentType}</dd>
                              </div>
                            )}
                          </dl>
                        </div>
                      )}

                      {!extracted && !resolved && (
                        <div className="p-4 rounded-lg border border-dashed text-center text-muted-foreground">
                          No extraction data available
                        </div>
                      )}
                    </>
                  )
                })()}
            </div>
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
              Confirm & Create Item
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
              Are you sure you want to delete "{documentToDelete?.fileName}"? This action cannot be
              undone.
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
