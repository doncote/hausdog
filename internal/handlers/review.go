package handlers

import (
	"encoding/json"
	"log"
	"net/http"

	"github.com/don/hausdog/internal/auth"
	"github.com/don/hausdog/internal/database"
	"github.com/don/hausdog/internal/extraction"
	"github.com/don/hausdog/internal/storage"
	"github.com/don/hausdog/internal/templates"
	"github.com/google/uuid"
)

// ReviewHandler handles document review operations.
type ReviewHandler struct {
	db       *database.DB
	storage  *storage.Client
	renderer *templates.Renderer
}

// NewReviewHandler creates a new review handler.
func NewReviewHandler(db *database.DB, storage *storage.Client, renderer *templates.Renderer) *ReviewHandler {
	return &ReviewHandler{
		db:       db,
		storage:  storage,
		renderer: renderer,
	}
}

// ReviewQueueData holds data for the review queue page.
type ReviewQueueData struct {
	Documents  []*DocumentWithExtraction
	TotalCount int
}

// DocumentWithExtraction combines document with parsed extraction data.
type DocumentWithExtraction struct {
	*database.Document
	Extraction *extraction.ExtractionResult
}

// HandleReviewQueue shows the list of documents ready for review.
func (h *ReviewHandler) HandleReviewQueue(w http.ResponseWriter, r *http.Request) {
	user := auth.GetUser(r.Context())
	if user == nil {
		http.Redirect(w, r, "/login", http.StatusSeeOther)
		return
	}

	// Get documents with complete status
	docs, err := h.db.ListDocumentsByStatus(r.Context(), user.ID, database.ProcessingStatusComplete, 50, 0)
	if err != nil {
		log.Printf("failed to list documents: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	// Parse extraction data for each document
	docsWithExtraction := make([]*DocumentWithExtraction, 0, len(docs))
	for _, doc := range docs {
		dwe := &DocumentWithExtraction{Document: doc}
		if doc.ExtractedData != nil {
			var ext extraction.ExtractionResult
			if err := json.Unmarshal(*doc.ExtractedData, &ext); err == nil {
				dwe.Extraction = &ext
			}
		}
		docsWithExtraction = append(docsWithExtraction, dwe)
	}

	data := ReviewQueueData{
		Documents:  docsWithExtraction,
		TotalCount: len(docsWithExtraction),
	}

	if err := h.renderer.RenderPage(w, r, "review", data); err != nil {
		log.Printf("failed to render review page: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
	}
}

// HandleReviewItem shows a single document for review.
func (h *ReviewHandler) HandleReviewItem(w http.ResponseWriter, r *http.Request) {
	user := auth.GetUser(r.Context())
	if user == nil {
		http.Redirect(w, r, "/login", http.StatusSeeOther)
		return
	}

	// Get document ID from URL
	idStr := r.PathValue("id")
	docID, err := uuid.Parse(idStr)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	// Get document
	doc, err := h.db.GetDocumentByUser(r.Context(), docID, user.ID)
	if err != nil {
		log.Printf("failed to get document: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
	if doc == nil {
		http.NotFound(w, r)
		return
	}

	// Parse extraction data
	dwe := &DocumentWithExtraction{Document: doc}
	if doc.ExtractedData != nil {
		var ext extraction.ExtractionResult
		if err := json.Unmarshal(*doc.ExtractedData, &ext); err == nil {
			dwe.Extraction = &ext
		}
	}

	// Get categories for dropdown
	categories, err := h.db.ListCategories(r.Context())
	if err != nil {
		log.Printf("failed to list categories: %v", err)
	}

	// Get user's properties for dropdown
	properties, err := h.db.ListPropertiesByUser(r.Context(), user.ID)
	if err != nil {
		log.Printf("failed to list properties: %v", err)
	}

	data := map[string]any{
		"Document":   dwe,
		"Categories": categories,
		"Properties": properties,
	}

	if err := h.renderer.RenderPage(w, r, "review_item", data); err != nil {
		log.Printf("failed to render review item page: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
	}
}

// HandleConfirmDocument confirms a document review.
func (h *ReviewHandler) HandleConfirmDocument(w http.ResponseWriter, r *http.Request) {
	user := auth.GetUser(r.Context())
	if user == nil {
		writeJSON(w, http.StatusUnauthorized, ErrorResponse{Error: "unauthorized"})
		return
	}

	idStr := r.PathValue("id")
	docID, err := uuid.Parse(idStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, ErrorResponse{Error: "invalid document ID"})
		return
	}

	// Verify document belongs to user
	doc, err := h.db.GetDocumentByUser(r.Context(), docID, user.ID)
	if err != nil || doc == nil {
		writeJSON(w, http.StatusNotFound, ErrorResponse{Error: "document not found"})
		return
	}

	// Parse form data for any edits
	if err := r.ParseForm(); err != nil {
		writeJSON(w, http.StatusBadRequest, ErrorResponse{Error: "invalid form data"})
		return
	}

	// Update document status to confirmed
	if err := h.db.UpdateDocumentStatus(r.Context(), docID, "confirmed"); err != nil {
		log.Printf("failed to confirm document: %v", err)
		writeJSON(w, http.StatusInternalServerError, ErrorResponse{Error: "failed to confirm document"})
		return
	}

	// If system_id provided, link document to system
	if systemIDStr := r.FormValue("system_id"); systemIDStr != "" {
		systemID, err := uuid.Parse(systemIDStr)
		if err == nil {
			h.db.LinkDocumentToSystem(r.Context(), docID, systemID)
		}
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "confirmed"})
}

// HandleRejectDocument rejects a document.
func (h *ReviewHandler) HandleRejectDocument(w http.ResponseWriter, r *http.Request) {
	user := auth.GetUser(r.Context())
	if user == nil {
		writeJSON(w, http.StatusUnauthorized, ErrorResponse{Error: "unauthorized"})
		return
	}

	idStr := r.PathValue("id")
	docID, err := uuid.Parse(idStr)
	if err != nil {
		writeJSON(w, http.StatusBadRequest, ErrorResponse{Error: "invalid document ID"})
		return
	}

	// Verify document belongs to user
	doc, err := h.db.GetDocumentByUser(r.Context(), docID, user.ID)
	if err != nil || doc == nil {
		writeJSON(w, http.StatusNotFound, ErrorResponse{Error: "document not found"})
		return
	}

	// Update document status to rejected
	if err := h.db.UpdateDocumentStatus(r.Context(), docID, "rejected"); err != nil {
		log.Printf("failed to reject document: %v", err)
		writeJSON(w, http.StatusInternalServerError, ErrorResponse{Error: "failed to reject document"})
		return
	}

	writeJSON(w, http.StatusOK, map[string]string{"status": "rejected"})
}

// HandleDocumentPreview returns the document file for preview.
func (h *ReviewHandler) HandleDocumentPreview(w http.ResponseWriter, r *http.Request) {
	user := auth.GetUser(r.Context())
	if user == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	idStr := r.PathValue("id")
	docID, err := uuid.Parse(idStr)
	if err != nil {
		http.NotFound(w, r)
		return
	}

	// Get document
	doc, err := h.db.GetDocumentByUser(r.Context(), docID, user.ID)
	if err != nil || doc == nil {
		http.NotFound(w, r)
		return
	}

	// Get signed URL for the document
	signedURL, err := h.storage.GetSignedURL(doc.StoragePath, 15*60) // 15 minutes
	if err != nil {
		log.Printf("failed to get signed URL: %v", err)
		http.Error(w, "Failed to get document", http.StatusInternalServerError)
		return
	}

	// Redirect to signed URL
	http.Redirect(w, r, signedURL, http.StatusTemporaryRedirect)
}
