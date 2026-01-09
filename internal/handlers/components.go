package handlers

import (
	"log"
	"net/http"
	"strings"
	"time"

	"github.com/don/hausdog/internal/auth"
	"github.com/don/hausdog/internal/database"
	"github.com/don/hausdog/internal/storage"
	"github.com/don/hausdog/internal/templates"
	"github.com/google/uuid"
)

// ComponentsHandler handles component-related pages.
type ComponentsHandler struct {
	db       *database.DB
	storage  *storage.Client
	renderer *templates.Renderer
}

// NewComponentsHandler creates a new components handler.
func NewComponentsHandler(db *database.DB, storage *storage.Client, renderer *templates.Renderer) *ComponentsHandler {
	return &ComponentsHandler{
		db:       db,
		storage:  storage,
		renderer: renderer,
	}
}

// HandleCreate creates a new component for a system.
func (h *ComponentsHandler) HandleCreate(w http.ResponseWriter, r *http.Request) {
	user := auth.GetUser(r.Context())
	if user == nil {
		http.Redirect(w, r, "/login", http.StatusSeeOther)
		return
	}

	systemIDStr := r.PathValue("id")
	systemID, err := uuid.Parse(systemIDStr)
	if err != nil {
		http.Error(w, "Invalid system ID", http.StatusBadRequest)
		return
	}

	// Get system and verify ownership
	system, err := h.db.GetSystem(r.Context(), systemID)
	if err != nil || system == nil {
		http.NotFound(w, r)
		return
	}

	prop, err := h.db.GetProperty(r.Context(), system.PropertyID)
	if err != nil || prop == nil {
		http.NotFound(w, r)
		return
	}
	if prop.UserID != user.ID {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	if err := r.ParseForm(); err != nil {
		http.Error(w, "Invalid form data", http.StatusBadRequest)
		return
	}

	name := r.FormValue("name")
	if name == "" {
		http.Error(w, "Name is required", http.StatusBadRequest)
		return
	}

	params := database.CreateComponentParams{
		SystemID: systemID,
		Name:     name,
	}

	if v := r.FormValue("manufacturer"); v != "" {
		params.Manufacturer = &v
	}
	if v := r.FormValue("model"); v != "" {
		params.Model = &v
	}
	if v := r.FormValue("serial_number"); v != "" {
		params.SerialNumber = &v
	}
	if v := r.FormValue("install_date"); v != "" {
		if t, err := time.Parse("2006-01-02", v); err == nil {
			params.InstallDate = &t
		}
	}
	if v := r.FormValue("warranty_expires"); v != "" {
		if t, err := time.Parse("2006-01-02", v); err == nil {
			params.WarrantyExpires = &t
		}
	}
	if v := r.FormValue("notes"); v != "" {
		params.Notes = &v
	}

	_, err = h.db.CreateComponent(r.Context(), params)
	if err != nil {
		log.Printf("failed to create component: %v", err)
		http.Error(w, "Failed to create component", http.StatusInternalServerError)
		return
	}

	// Redirect back to system detail
	http.Redirect(w, r, "/systems/"+systemID.String(), http.StatusSeeOther)
}

// ComponentDetailData holds data for the component detail page.
type ComponentDetailData struct {
	Component *database.Component
	System    *database.System
	Property  *database.Property
	Documents []*DocumentWithThumbnail
}

// HandleDetail renders the component detail page.
func (h *ComponentsHandler) HandleDetail(w http.ResponseWriter, r *http.Request) {
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

	component, err := h.db.GetComponent(r.Context(), id)
	if err != nil || component == nil {
		http.NotFound(w, r)
		return
	}

	// Get system
	system, err := h.db.GetSystem(r.Context(), component.SystemID)
	if err != nil || system == nil {
		http.NotFound(w, r)
		return
	}

	// Get property to verify ownership
	prop, err := h.db.GetProperty(r.Context(), system.PropertyID)
	if err != nil || prop == nil {
		http.NotFound(w, r)
		return
	}
	if prop.UserID != user.ID {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	// Get documents linked to this component
	docs, err := h.db.ListDocumentsByComponent(r.Context(), id)
	if err != nil {
		log.Printf("failed to list documents for component: %v", err)
	}

	// Generate thumbnail URLs for image documents
	docsWithThumbs := make([]*DocumentWithThumbnail, len(docs))
	for i, doc := range docs {
		dwt := &DocumentWithThumbnail{Document: doc}
		if h.storage != nil && strings.HasPrefix(doc.ContentType, "image/") {
			if url, err := h.storage.GetSignedURL(doc.StoragePath, time.Hour); err == nil {
				dwt.ThumbnailURL = url
			}
		}
		docsWithThumbs[i] = dwt
	}

	data := &ComponentDetailData{
		Component: component,
		System:    system,
		Property:  prop,
		Documents: docsWithThumbs,
	}

	if err := h.renderer.RenderPage(w, r, "component_detail", data); err != nil {
		log.Printf("failed to render component detail page: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
	}
}

// HandleUpdate updates a component.
func (h *ComponentsHandler) HandleUpdate(w http.ResponseWriter, r *http.Request) {
	user := auth.GetUser(r.Context())
	if user == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	idStr := r.PathValue("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, "Invalid component ID", http.StatusBadRequest)
		return
	}

	component, err := h.db.GetComponent(r.Context(), id)
	if err != nil || component == nil {
		http.NotFound(w, r)
		return
	}

	// Get system to verify ownership chain
	system, err := h.db.GetSystem(r.Context(), component.SystemID)
	if err != nil || system == nil {
		http.NotFound(w, r)
		return
	}

	prop, err := h.db.GetProperty(r.Context(), system.PropertyID)
	if err != nil || prop == nil {
		http.NotFound(w, r)
		return
	}
	if prop.UserID != user.ID {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	if err := r.ParseForm(); err != nil {
		http.Error(w, "Invalid form data", http.StatusBadRequest)
		return
	}

	name := r.FormValue("name")
	if name == "" {
		http.Error(w, "Name is required", http.StatusBadRequest)
		return
	}

	params := database.CreateComponentParams{
		SystemID: component.SystemID,
		Name:     name,
	}

	if v := r.FormValue("manufacturer"); v != "" {
		params.Manufacturer = &v
	}
	if v := r.FormValue("model"); v != "" {
		params.Model = &v
	}
	if v := r.FormValue("serial_number"); v != "" {
		params.SerialNumber = &v
	}
	if v := r.FormValue("install_date"); v != "" {
		if t, err := time.Parse("2006-01-02", v); err == nil {
			params.InstallDate = &t
		}
	}
	if v := r.FormValue("warranty_expires"); v != "" {
		if t, err := time.Parse("2006-01-02", v); err == nil {
			params.WarrantyExpires = &t
		}
	}
	if v := r.FormValue("notes"); v != "" {
		params.Notes = &v
	}

	if err := h.db.UpdateComponent(r.Context(), id, params); err != nil {
		log.Printf("failed to update component: %v", err)
		http.Error(w, "Failed to update component", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

// HandleDelete deletes a component.
func (h *ComponentsHandler) HandleDelete(w http.ResponseWriter, r *http.Request) {
	user := auth.GetUser(r.Context())
	if user == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	idStr := r.PathValue("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, "Invalid component ID", http.StatusBadRequest)
		return
	}

	component, err := h.db.GetComponent(r.Context(), id)
	if err != nil || component == nil {
		http.NotFound(w, r)
		return
	}

	// Verify ownership via system -> property chain
	system, err := h.db.GetSystem(r.Context(), component.SystemID)
	if err != nil || system == nil {
		http.NotFound(w, r)
		return
	}

	prop, err := h.db.GetProperty(r.Context(), system.PropertyID)
	if err != nil || prop == nil {
		http.NotFound(w, r)
		return
	}
	if prop.UserID != user.ID {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	if err := h.db.DeleteComponent(r.Context(), id); err != nil {
		log.Printf("failed to delete component: %v", err)
		http.Error(w, "Failed to delete component", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}
