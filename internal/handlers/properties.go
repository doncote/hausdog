package handlers

import (
	"log"
	"net/http"

	"github.com/don/hausdog/internal/auth"
	"github.com/don/hausdog/internal/database"
	"github.com/don/hausdog/internal/templates"
	"github.com/google/uuid"
)

// PropertiesHandler handles property-related pages.
type PropertiesHandler struct {
	db       *database.DB
	renderer *templates.Renderer
}

// NewPropertiesHandler creates a new properties handler.
func NewPropertiesHandler(db *database.DB, renderer *templates.Renderer) *PropertiesHandler {
	return &PropertiesHandler{
		db:       db,
		renderer: renderer,
	}
}

// PropertiesData holds data for the properties list page.
type PropertiesData struct {
	Properties []*PropertyWithStats
}

// PropertyWithStats includes system count for a property.
type PropertyWithStats struct {
	*database.Property
	SystemCount int
}

// PropertyDetailData holds data for the property detail page.
type PropertyDetailData struct {
	Property   *database.Property
	Systems    []*SystemWithCategory
	Categories []*database.Category
}

// SystemWithCategory includes category info for a system.
type SystemWithCategory struct {
	*database.System
	CategoryName string
}

// HandleList renders the properties list page.
func (h *PropertiesHandler) HandleList(w http.ResponseWriter, r *http.Request) {
	user := auth.GetUser(r.Context())
	if user == nil {
		http.Redirect(w, r, "/login", http.StatusSeeOther)
		return
	}

	properties, err := h.db.ListPropertiesByUser(r.Context(), user.ID)
	if err != nil {
		log.Printf("failed to list properties: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}

	// Get system counts for each property
	propsWithStats := make([]*PropertyWithStats, 0, len(properties))
	for _, prop := range properties {
		count, err := h.db.CountSystemsByProperty(r.Context(), prop.ID)
		if err != nil {
			log.Printf("failed to count systems for property %s: %v", prop.ID, err)
			count = 0
		}
		propsWithStats = append(propsWithStats, &PropertyWithStats{
			Property:    prop,
			SystemCount: count,
		})
	}

	data := &PropertiesData{
		Properties: propsWithStats,
	}

	if err := h.renderer.RenderPage(w, r, "properties", data); err != nil {
		log.Printf("failed to render properties page: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
	}
}

// HandleNew renders the new property form page.
func (h *PropertiesHandler) HandleNew(w http.ResponseWriter, r *http.Request) {
	user := auth.GetUser(r.Context())
	if user == nil {
		http.Redirect(w, r, "/login", http.StatusSeeOther)
		return
	}

	if err := h.renderer.RenderPage(w, r, "properties_new", nil); err != nil {
		log.Printf("failed to render new property page: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
	}
}

// HandleCreate creates a new property.
func (h *PropertiesHandler) HandleCreate(w http.ResponseWriter, r *http.Request) {
	user := auth.GetUser(r.Context())
	if user == nil {
		http.Redirect(w, r, "/login", http.StatusSeeOther)
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

	var address *string
	if addr := r.FormValue("address"); addr != "" {
		address = &addr
	}

	prop, err := h.db.CreateProperty(r.Context(), database.CreatePropertyParams{
		UserID:  user.ID,
		Name:    name,
		Address: address,
	})
	if err != nil {
		log.Printf("failed to create property: %v", err)
		http.Error(w, "Failed to create property", http.StatusInternalServerError)
		return
	}

	// Redirect to the new property's detail page
	http.Redirect(w, r, "/properties/"+prop.ID.String(), http.StatusSeeOther)
}

// HandleDetail renders the property detail page.
func (h *PropertiesHandler) HandleDetail(w http.ResponseWriter, r *http.Request) {
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

	prop, err := h.db.GetProperty(r.Context(), id)
	if err != nil || prop == nil {
		http.NotFound(w, r)
		return
	}

	// Verify ownership
	if prop.UserID != user.ID {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	// Get systems for this property
	systems, err := h.db.ListSystemsByProperty(r.Context(), id)
	if err != nil {
		log.Printf("failed to list systems: %v", err)
		systems = []*database.System{}
	}

	// Get categories for the add system form
	categories, err := h.db.ListCategories(r.Context())
	if err != nil {
		log.Printf("failed to list categories: %v", err)
		categories = []*database.Category{}
	}

	// Build category lookup map
	categoryMap := make(map[uuid.UUID]string)
	for _, cat := range categories {
		categoryMap[cat.ID] = cat.Name
	}

	// Add category names to systems
	systemsWithCategory := make([]*SystemWithCategory, 0, len(systems))
	for _, sys := range systems {
		systemsWithCategory = append(systemsWithCategory, &SystemWithCategory{
			System:       sys,
			CategoryName: categoryMap[sys.CategoryID],
		})
	}

	data := &PropertyDetailData{
		Property:   prop,
		Systems:    systemsWithCategory,
		Categories: categories,
	}

	if err := h.renderer.RenderPage(w, r, "property_detail", data); err != nil {
		log.Printf("failed to render property detail page: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
	}
}

// HandleUpdate updates an existing property.
func (h *PropertiesHandler) HandleUpdate(w http.ResponseWriter, r *http.Request) {
	user := auth.GetUser(r.Context())
	if user == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	idStr := r.PathValue("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, "Invalid property ID", http.StatusBadRequest)
		return
	}

	// Verify ownership
	prop, err := h.db.GetProperty(r.Context(), id)
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

	var address *string
	if addr := r.FormValue("address"); addr != "" {
		address = &addr
	}

	if err := h.db.UpdateProperty(r.Context(), id, name, address); err != nil {
		log.Printf("failed to update property: %v", err)
		http.Error(w, "Failed to update property", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}

// HandleDelete deletes a property.
func (h *PropertiesHandler) HandleDelete(w http.ResponseWriter, r *http.Request) {
	user := auth.GetUser(r.Context())
	if user == nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	idStr := r.PathValue("id")
	id, err := uuid.Parse(idStr)
	if err != nil {
		http.Error(w, "Invalid property ID", http.StatusBadRequest)
		return
	}

	// Verify ownership
	prop, err := h.db.GetProperty(r.Context(), id)
	if err != nil || prop == nil {
		http.NotFound(w, r)
		return
	}
	if prop.UserID != user.ID {
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	if err := h.db.DeleteProperty(r.Context(), id); err != nil {
		log.Printf("failed to delete property: %v", err)
		http.Error(w, "Failed to delete property", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
}
