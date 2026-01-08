package handlers

import (
	"log"
	"net/http"

	"github.com/don/hausdog/internal/auth"
	"github.com/don/hausdog/internal/database"
	"github.com/don/hausdog/internal/templates"
)

// HomeHandler handles the home/dashboard page.
type HomeHandler struct {
	db       *database.DB
	renderer *templates.Renderer
}

// NewHomeHandler creates a new home handler.
func NewHomeHandler(db *database.DB, renderer *templates.Renderer) *HomeHandler {
	return &HomeHandler{
		db:       db,
		renderer: renderer,
	}
}

// DashboardData holds data for the dashboard page.
type DashboardData struct {
	Properties     []*database.Property
	Categories     []*CategoryWithCount
	DocumentCounts map[string]int
	TotalSystems   int
	TotalDocuments int
}

// CategoryWithCount includes system count for a category.
type CategoryWithCount struct {
	*database.Category
	SystemCount int
}

// HandleDashboard renders the home/dashboard page.
func (h *HomeHandler) HandleDashboard(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/" {
		http.NotFound(w, r)
		return
	}

	user := auth.GetUser(r.Context())

	var data *DashboardData

	if user != nil && h.db != nil {
		// Get user's properties
		properties, err := h.db.ListPropertiesByUser(r.Context(), user.ID)
		if err != nil {
			log.Printf("failed to list properties: %v", err)
		}

		// Get categories with counts
		categories, err := h.db.ListCategories(r.Context())
		if err != nil {
			log.Printf("failed to list categories: %v", err)
		}

		// Get system counts by category
		categoryCounts, err := h.db.CountSystemsByCategory(r.Context(), user.ID)
		if err != nil {
			log.Printf("failed to count systems: %v", err)
		}

		catsWithCount := make([]*CategoryWithCount, 0, len(categories))
		totalSystems := 0
		for _, cat := range categories {
			count := categoryCounts[cat.ID.String()]
			totalSystems += count
			catsWithCount = append(catsWithCount, &CategoryWithCount{
				Category:    cat,
				SystemCount: count,
			})
		}

		// Get document counts
		docCounts, err := h.db.CountDocumentsByStatus(r.Context(), user.ID)
		if err != nil {
			log.Printf("failed to count documents: %v", err)
		}

		totalDocs := 0
		for _, count := range docCounts {
			totalDocs += count
		}

		data = &DashboardData{
			Properties:     properties,
			Categories:     catsWithCount,
			DocumentCounts: docCounts,
			TotalSystems:   totalSystems,
			TotalDocuments: totalDocs,
		}
	}

	if err := h.renderer.RenderPage(w, r, "home", data); err != nil {
		log.Printf("failed to render home page: %v", err)
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
	}
}
