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

// SystemsHandler handles system-related pages.
type SystemsHandler struct {
	db       *database.DB
	storage  *storage.Client
	renderer *templates.Renderer
}

// NewSystemsHandler creates a new systems handler.
func NewSystemsHandler(db *database.DB, storage *storage.Client, renderer *templates.Renderer) *SystemsHandler {
	return &SystemsHandler{
		db:       db,
		storage:  storage,
		renderer: renderer,
	}
}

// SystemsListData holds data for the systems list page.
type SystemsListData struct {
	Systems    []*SystemWithProperty
	Categories []*database.Category
}

// SystemWithProperty holds a system and its property info.
type SystemWithProperty struct {
	System   *database.System
	Property *database.Property
	Category *database.Category
}

// HandleList renders the systems list page.
func (h *SystemsHandler) HandleList(w http.ResponseWriter, r *http.Request) {
	user := auth.GetUser(r.Context())
	if user == nil {
		http.Redirect(w, r, "/login", http.StatusSeeOther)
		return
	}

	// Get all systems for the user
	systems, err := h.db.ListSystemsByUser(r.Context(), user.ID)
	if err != nil {
		log.Printf("failed to list systems: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	// Get categories for display
	categories, err := h.db.ListCategories(r.Context())
	if err != nil {
		log.Printf("failed to list categories: %v", err)
	}
	catMap := make(map[uuid.UUID]*database.Category)
	for _, cat := range categories {
		catMap[cat.ID] = cat
	}

	// Get properties for display
	props, err := h.db.ListPropertiesByUser(r.Context(), user.ID)
	if err != nil {
		log.Printf("failed to list properties: %v", err)
	}
	propMap := make(map[uuid.UUID]*database.Property)
	for _, prop := range props {
		propMap[prop.ID] = prop
	}

	// Build enriched system list
	var systemsWithProps []*SystemWithProperty
	for _, sys := range systems {
		swp := &SystemWithProperty{
			System:   sys,
			Property: propMap[sys.PropertyID],
			Category: catMap[sys.CategoryID],
		}
		systemsWithProps = append(systemsWithProps, swp)
	}

	data := &SystemsListData{
		Systems:    systemsWithProps,
		Categories: categories,
	}

	if err := h.renderer.RenderPage(w, r, "systems", data); err != nil {
		log.Printf("failed to render systems page: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
	}
}

// HandleCreate creates a new system for a property.
func (h *SystemsHandler) HandleCreate(w http.ResponseWriter, r *http.Request) {
	user := auth.GetUser(r.Context())
	if user == nil {
		http.Redirect(w, r, "/login", http.StatusSeeOther)
		return
	}

	propertyIDStr := r.PathValue("id")
	propertyID, err := uuid.Parse(propertyIDStr)
	if err != nil {
		http.Error(w, "Invalid property ID", http.StatusBadRequest)
		return
	}

	// Verify property ownership
	prop, err := h.db.GetProperty(r.Context(), propertyID)
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

	categoryIDStr := r.FormValue("category_id")
	categoryID, err := uuid.Parse(categoryIDStr)
	if err != nil {
		http.Error(w, "Invalid category", http.StatusBadRequest)
		return
	}

	name := r.FormValue("name")
	if name == "" {
		http.Error(w, "Name is required", http.StatusBadRequest)
		return
	}

	params := database.CreateSystemParams{
		PropertyID: propertyID,
		CategoryID: categoryID,
		Name:       name,
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

	_, err = h.db.CreateSystem(r.Context(), params)
	if err != nil {
		log.Printf("failed to create system: %v", err)
		http.Error(w, "Failed to create system", http.StatusInternalServerError)
		return
	}

	// Redirect back to property detail
	http.Redirect(w, r, "/properties/"+propertyID.String(), http.StatusSeeOther)
}

// DocumentWithThumbnail wraps a document with its thumbnail URL.
type DocumentWithThumbnail struct {
	*database.Document
	ThumbnailURL string
}

// SystemDetailData holds data for the system detail page.
type SystemDetailData struct {
	System     *database.System
	Property   *database.Property
	Category   *database.Category
	Components []*database.Component
	Documents  []*DocumentWithThumbnail
	Categories []*database.Category
}

// HandleDetail renders the system detail page.
func (h *SystemsHandler) HandleDetail(w http.ResponseWriter, r *http.Request) {
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

	system, err := h.db.GetSystem(r.Context(), id)
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

	// Get category
	category, err := h.db.GetCategory(r.Context(), system.CategoryID)
	if err != nil {
		log.Printf("failed to get category: %v", err)
	}

	// Get components for this system
	components, err := h.db.ListComponentsBySystem(r.Context(), id)
	if err != nil {
		log.Printf("failed to list components for system: %v", err)
	}

	// Get documents linked to this system
	docs, err := h.db.ListDocumentsBySystem(r.Context(), id)
	if err != nil {
		log.Printf("failed to list documents for system: %v", err)
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

	// Get categories for edit modal
	categories, err := h.db.ListCategories(r.Context())
	if err != nil {
		log.Printf("failed to list categories: %v", err)
	}

	data := &SystemDetailData{
		System:     system,
		Property:   prop,
		Category:   category,
		Components: components,
		Documents:  docsWithThumbs,
		Categories: categories,
	}

	if err := h.renderer.RenderPage(w, r, "system_detail", data); err != nil {
		log.Printf("failed to render system detail page: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
	}
}

// HandleUpdate updates a system.
func (h *SystemsHandler) HandleUpdate(w http.ResponseWriter, r *http.Request) {
	user := auth.GetUser(r.Context())
	if user == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	idStr := r.PathValue("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, "Invalid system ID", http.StatusBadRequest)
		return
	}

	system, err := h.db.GetSystem(r.Context(), id)
	if err != nil || system == nil {
		http.NotFound(w, r)
		return
	}

	// Verify ownership via property
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

	categoryIDStr := r.FormValue("category_id")
	categoryID, err := uuid.Parse(categoryIDStr)
	if err != nil {
		http.Error(w, "Invalid category", http.StatusBadRequest)
		return
	}

	params := database.CreateSystemParams{
		CategoryID: categoryID,
		Name:       name,
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

	if err := h.db.UpdateSystem(r.Context(), id, params); err != nil {
		log.Printf("failed to update system: %v", err)
		http.Error(w, "Failed to update system", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

// HandleDelete deletes a system.
func (h *SystemsHandler) HandleDelete(w http.ResponseWriter, r *http.Request) {
	user := auth.GetUser(r.Context())
	if user == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	idStr := r.PathValue("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, "Invalid system ID", http.StatusBadRequest)
		return
	}

	system, err := h.db.GetSystem(r.Context(), id)
	if err != nil || system == nil {
		http.NotFound(w, r)
		return
	}

	// Verify ownership via property
	prop, err := h.db.GetProperty(r.Context(), system.PropertyID)
	if err != nil || prop == nil {
		http.NotFound(w, r)
		return
	}
	if prop.UserID != user.ID {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	if err := h.db.DeleteSystem(r.Context(), id); err != nil {
		log.Printf("failed to delete system: %v", err)
		http.Error(w, "Failed to delete system", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}
