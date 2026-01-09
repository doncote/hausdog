// Package templates provides HTML template rendering utilities.
package templates

import (
	"encoding/json"
	"fmt"
	"html/template"
	"io"
	"io/fs"
	"net/http"
	"os"
	"path/filepath"
	"strings"

	"github.com/don/hausdog/internal/auth"
)

// Renderer handles template rendering.
type Renderer struct {
	templates   map[string]*template.Template
	funcMap     template.FuncMap
	supabaseURL string
	supabaseKey string
}

// Flash holds flash message data.
type Flash struct {
	Success string
	Error   string
	Info    string
}

// PageData holds common data for all pages.
type PageData struct {
	User        *auth.User
	Flash       *Flash
	CurrentPath string
	Data        any
	// Supabase config for frontend realtime
	SupabaseURL   string
	SupabaseKey   string
	AccessToken   string // For Supabase JS client auth
	RefreshToken  string
}

// NewFromDir creates a new template renderer from a directory path.
func NewFromDir(dir string) (*Renderer, error) {
	return New(os.DirFS(dir))
}

// New creates a new template renderer.
// It loads templates from the provided filesystem.
func New(templatesFS fs.FS) (*Renderer, error) {
	r := &Renderer{
		templates: make(map[string]*template.Template),
		funcMap: template.FuncMap{
			"upper":     strings.ToUpper,
			"lower":     strings.ToLower,
			"hasPrefix": strings.HasPrefix,
			"hasSuffix": strings.HasSuffix,
			"contains":  strings.Contains,
			"slice": func(s string, start, end int) string {
				if start < 0 {
					start = 0
				}
				if end > len(s) {
					end = len(s)
				}
				if start > end {
					return ""
				}
				return s[start:end]
			},
			"mul": func(a, b float64) float64 {
				return a * b
			},
			"div": func(a, b float64) float64 {
				if b == 0 {
					return 0
				}
				return a / b
			},
			"add": func(a, b int) int {
				return a + b
			},
			"sub": func(a, b int) int {
				return a - b
			},
			"formatBytes": func(bytes int64) string {
				if bytes < 1024 {
					return fmt.Sprintf("%d B", bytes)
				}
				kb := float64(bytes) / 1024.0
				if kb < 1024 {
					return fmt.Sprintf("%.1f KB", kb)
				}
				mb := kb / 1024.0
				return fmt.Sprintf("%.1f MB", mb)
			},
			"formatJSON": func(data *json.RawMessage) string {
				if data == nil {
					return ""
				}
				// Pretty print the JSON
				var prettyJSON map[string]any
				if err := json.Unmarshal(*data, &prettyJSON); err != nil {
					return string(*data)
				}
				pretty, err := json.MarshalIndent(prettyJSON, "", "  ")
				if err != nil {
					return string(*data)
				}
				return string(pretty)
			},
		},
	}

	// Parse all page templates with their layouts
	pages, err := fs.Glob(templatesFS, "pages/*.html")
	if err != nil {
		return nil, fmt.Errorf("failed to glob pages: %w", err)
	}

	for _, page := range pages {
		name := filepath.Base(page)
		name = strings.TrimSuffix(name, ".html")

		// Determine which layout to use
		layout := "layouts/base.html"
		if name == "login" {
			layout = "layouts/login.html"
		}

		// Parse layout + page
		tmpl, err := template.New("").Funcs(r.funcMap).ParseFS(templatesFS, layout, page)
		if err != nil {
			return nil, fmt.Errorf("failed to parse template %s: %w", name, err)
		}

		r.templates[name] = tmpl
	}

	// Parse partial templates
	partials, err := fs.Glob(templatesFS, "partials/*.html")
	if err != nil {
		return nil, fmt.Errorf("failed to glob partials: %w", err)
	}

	for _, partial := range partials {
		name := filepath.Base(partial)
		name = strings.TrimSuffix(name, ".html")

		tmpl, err := template.New("").Funcs(r.funcMap).ParseFS(templatesFS, partial)
		if err != nil {
			return nil, fmt.Errorf("failed to parse partial %s: %w", name, err)
		}

		r.templates["partial:"+name] = tmpl
	}

	return r, nil
}

// Render renders a page template with the given data.
func (r *Renderer) Render(w io.Writer, name string, data *PageData) error {
	tmpl, ok := r.templates[name]
	if !ok {
		return fmt.Errorf("template %s not found", name)
	}

	// Execute the layout template (base.html or login.html)
	// The page template defines blocks that override the layout's blocks
	layoutName := "base.html"
	if name == "login" {
		layoutName = "login.html"
	}
	return tmpl.ExecuteTemplate(w, layoutName, data)
}

// RenderPartial renders a partial template.
func (r *Renderer) RenderPartial(w io.Writer, name string, data any) error {
	tmpl, ok := r.templates["partial:"+name]
	if !ok {
		return fmt.Errorf("partial template %s not found", name)
	}

	return tmpl.ExecuteTemplate(w, name+".html", data)
}

// SetSupabaseConfig sets the Supabase URL and key for frontend realtime.
func (r *Renderer) SetSupabaseConfig(url, key string) {
	r.supabaseURL = url
	r.supabaseKey = key
}

// RenderPage is a convenience method for HTTP handlers.
func (r *Renderer) RenderPage(w http.ResponseWriter, req *http.Request, name string, data any) error {
	pageData := &PageData{
		User:        auth.GetUser(req.Context()),
		CurrentPath: req.URL.Path,
		Data:        data,
		SupabaseURL: r.supabaseURL,
		SupabaseKey: r.supabaseKey,
	}

	// Get access token from cookie for Supabase JS client
	if cookie, err := req.Cookie("access_token"); err == nil {
		pageData.AccessToken = cookie.Value
	}
	if cookie, err := req.Cookie("refresh_token"); err == nil {
		pageData.RefreshToken = cookie.Value
	}

	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	return r.Render(w, name, pageData)
}

// RenderError renders an error page.
func (r *Renderer) RenderError(w http.ResponseWriter, req *http.Request, statusCode int, message string) {
	w.WriteHeader(statusCode)
	r.RenderPage(w, req, "error", map[string]any{
		"StatusCode": statusCode,
		"Message":    message,
	})
}
