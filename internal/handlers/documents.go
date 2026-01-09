package handlers

import (
	"log"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/don/hausdog/internal/auth"
	"github.com/don/hausdog/internal/database"
	"github.com/don/hausdog/internal/storage"
	"github.com/don/hausdog/internal/templates"
	"github.com/google/uuid"
)

// Reprocessor is an interface for triggering document reprocessing.
type Reprocessor interface {
	Enqueue(docID uuid.UUID)
}

// DocumentsHandler handles document-related pages.
type DocumentsHandler struct {
	db          *database.DB
	storage     *storage.Client
	renderer    *templates.Renderer
	reprocessor Reprocessor
}

// NewDocumentsHandler creates a new documents handler.
func NewDocumentsHandler(db *database.DB, storage *storage.Client, renderer *templates.Renderer, reprocessor Reprocessor) *DocumentsHandler {
	return &DocumentsHandler{
		db:          db,
		storage:     storage,
		renderer:    renderer,
		reprocessor: reprocessor,
	}
}

// DocumentsListData holds data for the documents list page.
type DocumentsListData struct {
	Documents    []*DocumentWithThumbnail
	StatusCounts map[string]int
	Filter       string
	Page         int
	HasMore      bool
}

const documentsPerPage = 20

// HandleList renders the documents list page.
func (h *DocumentsHandler) HandleList(w http.ResponseWriter, r *http.Request) {
	user := auth.GetUser(r.Context())
	if user == nil {
		http.Redirect(w, r, "/login", http.StatusSeeOther)
		return
	}

	// Parse query params
	filter := r.URL.Query().Get("status")
	pageStr := r.URL.Query().Get("page")
	page := 1
	if p, err := strconv.Atoi(pageStr); err == nil && p > 0 {
		page = p
	}
	offset := (page - 1) * documentsPerPage

	// Get documents
	var docs []*database.Document
	var err error

	if filter != "" && filter != "all" {
		docs, err = h.db.ListDocumentsByStatus(r.Context(), user.ID, filter, documentsPerPage+1, offset)
	} else {
		docs, err = h.db.ListDocumentsByUser(r.Context(), user.ID, documentsPerPage+1, offset)
	}

	if err != nil {
		log.Printf("failed to list documents: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	// Check if there are more pages
	hasMore := len(docs) > documentsPerPage
	if hasMore {
		docs = docs[:documentsPerPage]
	}

	// Generate thumbnail URLs for image documents
	docsWithThumbs := make([]*DocumentWithThumbnail, len(docs))
	for i, doc := range docs {
		dwt := &DocumentWithThumbnail{Document: doc}
		if strings.HasPrefix(doc.ContentType, "image/") {
			if url, err := h.storage.GetSignedURL(doc.StoragePath, time.Hour); err == nil {
				dwt.ThumbnailURL = url
			}
		}
		docsWithThumbs[i] = dwt
	}

	// Get status counts for filter badges
	statusCounts, err := h.db.CountDocumentsByStatus(r.Context(), user.ID)
	if err != nil {
		log.Printf("failed to count documents: %v", err)
		statusCounts = make(map[string]int)
	}

	data := &DocumentsListData{
		Documents:    docsWithThumbs,
		StatusCounts: statusCounts,
		Filter:       filter,
		Page:         page,
		HasMore:      hasMore,
	}

	if err := h.renderer.RenderPage(w, r, "documents", data); err != nil {
		log.Printf("failed to render documents page: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
	}
}

// DocumentDetailData holds data for the document detail page.
type DocumentDetailData struct {
	Document   *database.Document
	Property   *database.Property
	System     *database.System
	SignedURL  string
	Properties []*database.Property // For linking UI
	Systems    []*database.System   // For linking UI
}

// HandleDetail renders the document detail page.
func (h *DocumentsHandler) HandleDetail(w http.ResponseWriter, r *http.Request) {
	user := auth.GetUser(r.Context())
	if user == nil {
		http.Redirect(w, r, "/login", http.StatusSeeOther)
		return
	}

	idStr := r.PathValue("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	doc, err := h.db.GetDocumentByUser(r.Context(), id, user.ID)
	if err != nil || doc == nil {
		http.NotFound(w, r)
		return
	}

	data := &DocumentDetailData{
		Document: doc,
	}

	// Get signed URL for viewing the document (1 hour expiry)
	if strings.HasPrefix(doc.ContentType, "image/") || doc.ContentType == "application/pdf" {
		signedURL, err := h.storage.GetSignedURL(doc.StoragePath, time.Hour)
		if err != nil {
			log.Printf("failed to get signed URL: %v", err)
		} else {
			data.SignedURL = signedURL
		}
	}

	// Load related property if linked
	if doc.PropertyID != nil {
		prop, err := h.db.GetProperty(r.Context(), *doc.PropertyID)
		if err == nil {
			data.Property = prop
		}
	}

	// Load related system if linked
	if doc.SystemID != nil {
		sys, err := h.db.GetSystem(r.Context(), *doc.SystemID)
		if err == nil {
			data.System = sys
		}
	}

	// Load user's properties and systems for linking UI
	props, err := h.db.ListPropertiesByUser(r.Context(), user.ID)
	if err == nil {
		data.Properties = props
	}
	systems, err := h.db.ListSystemsByUser(r.Context(), user.ID)
	if err == nil {
		data.Systems = systems
	}

	if err := h.renderer.RenderPage(w, r, "document_detail", data); err != nil {
		log.Printf("failed to render document detail page: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
	}
}

// HandleReprocess queues a document for reprocessing.
func (h *DocumentsHandler) HandleReprocess(w http.ResponseWriter, r *http.Request) {
	user := auth.GetUser(r.Context())
	if user == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	idStr := r.PathValue("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, "Invalid document ID", http.StatusBadRequest)
		return
	}

	doc, err := h.db.GetDocumentByUser(r.Context(), id, user.ID)
	if err != nil || doc == nil {
		http.NotFound(w, r)
		return
	}

	if h.reprocessor == nil {
		http.Error(w, "Reprocessing not available", http.StatusServiceUnavailable)
		return
	}

	// Reset status to pending and queue for processing
	if err := h.db.UpdateDocumentStatus(r.Context(), id, "pending"); err != nil {
		log.Printf("failed to reset document status: %v", err)
		http.Error(w, "Failed to reprocess", http.StatusInternalServerError)
		return
	}

	h.reprocessor.Enqueue(id)
	log.Printf("Document %s queued for reprocessing", id)

	w.WriteHeader(http.StatusOK)
}

// HandleLink updates document links to property/system.
func (h *DocumentsHandler) HandleLink(w http.ResponseWriter, r *http.Request) {
	user := auth.GetUser(r.Context())
	if user == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	idStr := r.PathValue("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, "Invalid document ID", http.StatusBadRequest)
		return
	}

	doc, err := h.db.GetDocumentByUser(r.Context(), id, user.ID)
	if err != nil || doc == nil {
		http.NotFound(w, r)
		return
	}

	if err := r.ParseForm(); err != nil {
		http.Error(w, "Invalid form data", http.StatusBadRequest)
		return
	}

	// Parse property ID
	var propertyID *uuid.UUID
	if propIDStr := r.FormValue("property_id"); propIDStr != "" {
		propID, err := uuid.Parse(propIDStr)
		if err == nil {
			// Verify user owns this property
			prop, err := h.db.GetProperty(r.Context(), propID)
			if err == nil && prop != nil && prop.UserID == user.ID {
				propertyID = &propID
			}
		}
	}

	// Parse system ID
	var systemID *uuid.UUID
	if sysIDStr := r.FormValue("system_id"); sysIDStr != "" {
		sysID, err := uuid.Parse(sysIDStr)
		if err == nil {
			// Verify user owns this system (via property)
			sys, err := h.db.GetSystem(r.Context(), sysID)
			if err == nil && sys != nil {
				prop, err := h.db.GetProperty(r.Context(), sys.PropertyID)
				if err == nil && prop != nil && prop.UserID == user.ID {
					systemID = &sysID
					// Also set property if not already set
					if propertyID == nil {
						propertyID = &sys.PropertyID
					}
				}
			}
		}
	}

	// Update document links
	if err := h.db.UpdateDocumentLinks(r.Context(), id, propertyID, systemID); err != nil {
		log.Printf("failed to update document links: %v", err)
		http.Error(w, "Failed to update links", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

// HandleDelete deletes a document.
func (h *DocumentsHandler) HandleDelete(w http.ResponseWriter, r *http.Request) {
	user := auth.GetUser(r.Context())
	if user == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	idStr := r.PathValue("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, "Invalid document ID", http.StatusBadRequest)
		return
	}

	doc, err := h.db.GetDocumentByUser(r.Context(), id, user.ID)
	if err != nil || doc == nil {
		http.NotFound(w, r)
		return
	}

	// Delete from storage
	if err := h.storage.Delete(doc.StoragePath); err != nil {
		log.Printf("failed to delete from storage: %v", err)
		// Continue anyway to delete DB record
	}

	// Delete from database
	if err := h.db.DeleteDocument(r.Context(), id); err != nil {
		log.Printf("failed to delete document: %v", err)
		http.Error(w, "Failed to delete document", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}
