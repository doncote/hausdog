package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"strings"

	"github.com/don/hausdog/internal/auth"
	"github.com/don/hausdog/internal/config"
	"github.com/don/hausdog/internal/database"
	"github.com/don/hausdog/internal/handlers"
	"github.com/don/hausdog/internal/storage"
	"github.com/don/hausdog/internal/templates"
)

func main() {
	ctx := context.Background()

	// Load config (optional in dev mode)
	cfg, err := config.Load()
	if err != nil {
		log.Printf("Warning: %v (running in dev mode)", err)
		cfg = &config.Config{
			Port:     os.Getenv("PORT"),
			LogLevel: "debug",
		}
		if cfg.Port == "" {
			cfg.Port = "8080"
		}
	}

	// Setup templates
	renderer, err := templates.NewFromDir("web/templates")
	if err != nil {
		log.Fatal("failed to create template renderer:", err)
	}

	// Setup database (optional)
	var db *database.DB
	if cfg.DatabaseURL != "" {
		db, err = database.New(ctx, cfg.DatabaseURL)
		if err != nil {
			log.Fatalf("failed to connect to database: %v", err)
		}
		defer db.Close()
		log.Println("Connected to database")
	} else {
		log.Println("Warning: DATABASE_URL not set, database features disabled")
	}

	// Setup storage client (optional)
	var storageClient *storage.Client
	if cfg.SupabaseURL != "" && cfg.SupabaseServiceKey != "" {
		storageClient = storage.NewClient(cfg.SupabaseURL, cfg.SupabaseServiceKey, "documents")
		log.Println("Storage client configured")
	} else {
		log.Println("Warning: Supabase not configured, storage features disabled")
	}

	// Setup auth
	var authMiddleware *auth.Middleware
	var authHandlers *auth.Handlers
	if cfg.SupabaseURL != "" && cfg.SupabaseKey != "" {
		authClient := auth.NewClient(cfg.SupabaseURL, cfg.SupabaseKey)
		authMiddleware = auth.NewMiddleware(cfg.SessionSecret, authClient)
		baseURL := "http://localhost:" + cfg.Port
		if os.Getenv("FLY_APP_NAME") != "" {
			baseURL = "https://" + os.Getenv("FLY_APP_NAME") + ".fly.dev"
		}
		authHandlers = auth.NewHandlers(authClient, baseURL)
		log.Println("Auth configured")
	}

	// Setup upload handler
	var uploadHandler *handlers.UploadHandler
	if db != nil && storageClient != nil {
		uploadHandler = handlers.NewUploadHandler(db, storageClient)
	}

	mux := http.NewServeMux()

	// Health check endpoint
	mux.HandleFunc("GET /health", func(w http.ResponseWriter, r *http.Request) {
		w.WriteHeader(http.StatusOK)
		w.Write([]byte("ok"))
	})

	// Static files with cache headers
	staticFS := http.FileServer(http.Dir("web/static"))
	mux.Handle("GET /static/", http.StripPrefix("/static/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Set cache headers for static assets (1 week for CSS/JS, 1 day for others)
		path := strings.ToLower(r.URL.Path)
		if strings.HasSuffix(path, ".css") || strings.HasSuffix(path, ".js") {
			w.Header().Set("Cache-Control", "public, max-age=604800") // 7 days
		} else {
			w.Header().Set("Cache-Control", "public, max-age=86400") // 1 day
		}
		staticFS.ServeHTTP(w, r)
	})))

	// Home page
	mux.HandleFunc("GET /", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path != "/" {
			http.NotFound(w, r)
			return
		}
		if err := renderer.RenderPage(w, r, "home", nil); err != nil {
			log.Printf("failed to render home page: %v", err)
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		}
	})

	// Login page
	mux.HandleFunc("GET /login", func(w http.ResponseWriter, r *http.Request) {
		if err := renderer.RenderPage(w, r, "login", nil); err != nil {
			log.Printf("failed to render login page: %v", err)
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		}
	})

	// Auth routes
	if authHandlers != nil {
		mux.HandleFunc("GET /auth/login", authHandlers.HandleLogin)
		mux.HandleFunc("GET /auth/callback", authHandlers.HandleCallback)
		mux.HandleFunc("GET /logout", authHandlers.HandleLogout)
	}

	// Upload page
	mux.HandleFunc("GET /upload", func(w http.ResponseWriter, r *http.Request) {
		if err := renderer.RenderPage(w, r, "upload", nil); err != nil {
			log.Printf("failed to render upload page: %v", err)
			http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		}
	})

	// Upload API
	if uploadHandler != nil && authMiddleware != nil {
		mux.Handle("POST /api/upload", authMiddleware.RequireAuth(http.HandlerFunc(uploadHandler.HandleUpload)))
	}

	// Recent documents API
	if db != nil {
		mux.HandleFunc("GET /api/documents/recent", func(w http.ResponseWriter, r *http.Request) {
			user := auth.GetUser(r.Context())
			if user == nil {
				w.Header().Set("Content-Type", "text/html")
				renderer.RenderPartial(w, "recent_uploads", nil)
				return
			}

			docs, err := db.ListDocumentsByUser(r.Context(), user.ID, 10, 0)
			if err != nil {
				log.Printf("failed to list documents: %v", err)
				http.Error(w, "Internal Server Error", http.StatusInternalServerError)
				return
			}

			w.Header().Set("Content-Type", "text/html")
			renderer.RenderPartial(w, "recent_uploads", docs)
		})
	}

	log.Printf("Starting server on :%s", cfg.Port)
	if err := http.ListenAndServe(":"+cfg.Port, mux); err != nil {
		log.Fatal(err)
	}
}
