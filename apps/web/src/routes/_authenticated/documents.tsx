import { createFileRoute, Link } from '@tanstack/react-router'
import { useState } from 'react'
import {
  Camera,
  ChevronRight,
  FileText,
  Filter,
  Image,
  Loader2,
  Search,
  Trash2,
} from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
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
  useDocumentsForProperty,
  useDeleteDocument,
  getSignedUrl,
  DocumentStatus,
  type DocumentWithRelations,
} from '@/features/documents'

export const Route = createFileRoute('/_authenticated/documents')({
  component: DocumentsPage,
})

function DocumentsPage() {
  const { user } = Route.useRouteContext()

  const { data: properties, isPending: propertiesLoading } = useProperties(user?.id)

  const [selectedPropertyId, setSelectedPropertyId] = useState<string>('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedDocument, setSelectedDocument] = useState<DocumentWithRelations | null>(null)
  const [documentUrl, setDocumentUrl] = useState<string | null>(null)
  const [showDeleteDialog, setShowDeleteDialog] = useState(false)
  const [documentToDelete, setDocumentToDelete] = useState<DocumentWithRelations | null>(null)

  const { data: documents, isPending: documentsLoading } =
    useDocumentsForProperty(selectedPropertyId || undefined)

  const deleteDocument = useDeleteDocument()

  // Filter documents
  const filteredDocuments = documents?.filter((doc) => {
    const matchesSearch = searchQuery === '' ||
      doc.fileName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      doc.type.toLowerCase().includes(searchQuery.toLowerCase())

    const matchesStatus = statusFilter === 'all' || doc.status === statusFilter

    return matchesSearch && matchesStatus
  }) || []

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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case DocumentStatus.READY_FOR_REVIEW:
        return <span className="px-2 py-0.5 text-xs rounded-full bg-yellow-100 text-yellow-800">Pending Review</span>
      case DocumentStatus.CONFIRMED:
        return <span className="px-2 py-0.5 text-xs rounded-full bg-green-100 text-green-800">Confirmed</span>
      case DocumentStatus.DISCARDED:
        return <span className="px-2 py-0.5 text-xs rounded-full bg-gray-100 text-gray-800">Discarded</span>
      default:
        return <span className="px-2 py-0.5 text-xs rounded-full bg-blue-100 text-blue-800">{status}</span>
    }
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
        <span className="font-medium">Documents</span>
      </nav>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
          <p className="text-muted-foreground mt-1">
            View and manage all your uploaded documents
          </p>
        </div>
        <Link to="/capture">
          <Button className="gap-2">
            <Camera className="h-4 w-4" />
            Capture Document
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="w-[200px]">
          <Label htmlFor="property" className="sr-only">Property</Label>
          <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
            <SelectTrigger id="property">
              <SelectValue placeholder="Select property" />
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

        {selectedPropertyId && (
          <>
            <div className="relative flex-1 min-w-[200px] max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>

            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value={DocumentStatus.READY_FOR_REVIEW}>Pending Review</SelectItem>
                <SelectItem value={DocumentStatus.CONFIRMED}>Confirmed</SelectItem>
                <SelectItem value={DocumentStatus.DISCARDED}>Discarded</SelectItem>
              </SelectContent>
            </Select>
          </>
        )}
      </div>

      {!selectedPropertyId ? (
        <div className="rounded-xl border-2 border-dashed bg-muted/30 p-12 text-center">
          <p className="text-muted-foreground">
            Select a property to view documents
          </p>
        </div>
      ) : documentsLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : filteredDocuments.length === 0 ? (
        <div className="rounded-xl border-2 border-dashed bg-muted/30 p-12 text-center">
          <div className="mx-auto w-fit rounded-full bg-primary/10 p-4 mb-4">
            <FileText className="h-8 w-8 text-primary" />
          </div>
          <h3 className="text-lg font-semibold mb-2">
            {documents && documents.length > 0 ? 'No matching documents' : 'No documents yet'}
          </h3>
          <p className="text-muted-foreground mb-6">
            {documents && documents.length > 0
              ? 'Try adjusting your filters'
              : 'Upload documents to get started'}
          </p>
          {documents && documents.length > 0 ? (
            <Button
              variant="outline"
              onClick={() => {
                setSearchQuery('')
                setStatusFilter('all')
              }}
            >
              Clear filters
            </Button>
          ) : (
            <Link to="/capture">
              <Button className="gap-2">
                <Camera className="h-4 w-4" />
                Capture Document
              </Button>
            </Link>
          )}
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredDocuments.map((doc) => (
            <div
              key={doc.id}
              className="rounded-xl border bg-card p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-3 mb-3">
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

              <div className="flex items-center justify-between">
                {getStatusBadge(doc.status)}
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleViewDocument(doc)}
                  >
                    View
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-destructive hover:text-destructive"
                    onClick={() => {
                      setDocumentToDelete(doc)
                      setShowDeleteDialog(true)
                    }}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
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
              {selectedDocument && (
                <span className="ml-2">{getStatusBadge(selectedDocument.status)}</span>
              )}
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
