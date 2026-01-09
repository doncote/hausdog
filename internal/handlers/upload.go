package handlers

import (
	"encoding/json"
	"log"
	"mime"
	"net/http"
	"path/filepath"
	"strings"

	"github.com/don/hausdog/internal/auth"
	"github.com/don/hausdog/internal/database"
	"github.com/don/hausdog/internal/extraction"
	"github.com/don/hausdog/internal/storage"
	"github.com/google/uuid"
)

const maxUploadSize = 50 << 20 // 50MB

// allowedMimeTypes defines which file types can be uploaded.
var allowedMimeTypes = map[string]bool{
	"image/jpeg":       true,
	"image/png":        true,
	"image/gif":        true,
	"image/webp":       true,
	"image/heic":       true,
	"image/heif":       true,
	"application/pdf":  true,
}

// UploadHandler handles document uploads.
type UploadHandler struct {
	db        *database.DB
	storage   *storage.Client
	processor *extraction.Processor
}

// NewUploadHandler creates a new upload handler.
func NewUploadHandler(db *database.DB, storage *storage.Client, processor *extraction.Processor) *UploadHandler {
	return &UploadHandler{
		db:        db,
		storage:   storage,
		processor: processor,
	}
}

// UploadResponse is the JSON response for successful uploads.
type UploadResponse struct {
	ID          string `json:"id"`
	Filename    string `json:"filename"`
	ContentType string `json:"content_type"`
	Size        int64  `json:"size"`
	Status      string `json:"status"`
}

// ErrorResponse is the JSON response for errors.
type ErrorResponse struct {
	Error string `json:"error"`
}

// HandleUpload handles POST /api/upload
func (h *UploadHandler) HandleUpload(w http.ResponseWriter, r *http.Request) {
	user := auth.GetUser(r.Context())
	if user == nil {
		writeJSON(w, http.StatusUnauthorized, ErrorResponse{Error: "unauthorized"})
		return
	}

	// Limit request size
	r.Body = http.MaxBytesReader(w, r.Body, maxUploadSize)

	// Parse multipart form
	if err := r.ParseMultipartForm(maxUploadSize); err != nil {
		log.Printf("failed to parse multipart form: %v", err)
		writeJSON(w, http.StatusBadRequest, ErrorResponse{Error: "file too large or invalid form"})
		return
	}

	file, header, err := r.FormFile("file")
	if err != nil {
		log.Printf("failed to get file from form: %v", err)
		writeJSON(w, http.StatusBadRequest, ErrorResponse{Error: "no file provided"})
		return
	}
	defer file.Close()

	// Validate content type
	contentType := header.Header.Get("Content-Type")
	if contentType == "" {
		// Try to detect from extension
		ext := filepath.Ext(header.Filename)
		contentType = mime.TypeByExtension(ext)
	}

	// Normalize content type (strip parameters like charset)
	mediaType, _, _ := mime.ParseMediaType(contentType)
	if mediaType == "" {
		mediaType = contentType
	}

	if !isAllowedMimeType(mediaType) {
		writeJSON(w, http.StatusBadRequest, ErrorResponse{
			Error: "invalid file type. Allowed: images (JPEG, PNG, GIF, WebP, HEIC) and PDF",
		})
		return
	}

	// Upload to storage
	result, err := h.storage.Upload(user.ID, header.Filename, mediaType, file)
	if err != nil {
		log.Printf("failed to upload to storage: %v", err)
		writeJSON(w, http.StatusInternalServerError, ErrorResponse{Error: "failed to upload file"})
		return
	}

	// Parse optional system_id and property_id
	var systemID *uuid.UUID
	var propertyID *uuid.UUID

	if sid := r.FormValue("system_id"); sid != "" {
		if id, err := uuid.Parse(sid); err == nil {
			systemID = &id
		}
	}
	if pid := r.FormValue("property_id"); pid != "" {
		if id, err := uuid.Parse(pid); err == nil {
			propertyID = &id
		}
	}

	// Create database record
	doc, err := h.db.CreateDocument(r.Context(), database.CreateDocumentParams{
		UserID:      user.ID,
		PropertyID:  propertyID,
		SystemID:    systemID,
		Filename:    header.Filename,
		StoragePath: result.Path,
		ContentType: mediaType,
		SizeBytes:   result.Size,
	})
	if err != nil {
		log.Printf("failed to create document record: %v", err)
		// Try to clean up storage
		_ = h.storage.Delete(result.Path)
		writeJSON(w, http.StatusInternalServerError, ErrorResponse{Error: "failed to save document"})
		return
	}

	// Enqueue for extraction if processor is available
	if h.processor != nil {
		h.processor.Enqueue(doc.ID)
	}

	writeJSON(w, http.StatusCreated, UploadResponse{
		ID:          doc.ID.String(),
		Filename:    doc.Filename,
		ContentType: doc.ContentType,
		Size:        doc.SizeBytes,
		Status:      doc.ProcessingStatus,
	})
}

// isAllowedMimeType checks if a MIME type is allowed for upload.
func isAllowedMimeType(mimeType string) bool {
	// Check exact match
	if allowedMimeTypes[mimeType] {
		return true
	}

	// Check image/* wildcard
	if strings.HasPrefix(mimeType, "image/") {
		return true
	}

	return false
}

// writeJSON writes a JSON response.
func writeJSON(w http.ResponseWriter, status int, data any) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	if err := json.NewEncoder(w).Encode(data); err != nil {
		log.Printf("failed to encode JSON response: %v", err)
	}
}
