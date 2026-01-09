package main

import (
	"context"
	"log"
	"net/http"
	"os"
	"strings"
	"time"

	"github.com/don/hausdog/internal/auth"
	"github.com/don/hausdog/internal/config"
	"github.com/don/hausdog/internal/database"
	"github.com/don/hausdog/internal/extraction"
	"github.com/don/hausdog/internal/handlers"
	"github.com/don/hausdog/internal/middleware"
	"github.com/don/hausdog/internal/realtime"
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

	// Setup event emitter for realtime processing updates (optional)
	var eventEmitter *realtime.EventEmitter
	if db != nil {
		eventEmitter = realtime.NewEventEmitter(db.Pool)
		defer eventEmitter.Stop()
		log.Println("Realtime event emitter configured")
	}

	// Setup extraction processor (optional)
	var extractionProcessor *extraction.Processor
	if cfg.HasLLMConfig() && db != nil && storageClient != nil {
		provider := extraction.NewProvider(extraction.ProviderType(cfg.LLMProvider), cfg.LLMAPIKey())
		extractionProcessor = extraction.NewProcessor(db, storageClient, provider, eventEmitter)
		extractionProcessor.StartPeriodicCheck(30 * time.Second)
		defer extractionProcessor.Stop()
		log.Printf("Document extraction enabled (provider: %s)", provider.Name())

		// Process any pending documents from previous runs
		if err := extractionProcessor.ProcessPending(ctx); err != nil {
			log.Printf("Warning: failed to process pending documents: %v", err)
		}
	} else {
		log.Println("Warning: No LLM API key configured, document extraction disabled")
	}

	// Setup auth
	var authMiddleware *auth.Middleware
	var authHandlers *auth.Handlers
	if cfg.SupabaseURL != "" && cfg.SupabaseKey != "" {
		authClient := auth.NewClient(cfg.SupabaseURL, cfg.SupabaseKey)
		authMiddleware = auth.NewMiddleware(cfg.SupabaseJWTSecret, authClient)
		baseURL := "http://localhost:" + cfg.Port
		if os.Getenv("FLY_APP_NAME") != "" {
			baseURL = "https://" + os.Getenv("FLY_APP_NAME") + ".fly.dev"
		}
		authHandlers = auth.NewHandlers(authClient, baseURL)
		// Configure renderer with Supabase for frontend realtime
		renderer.SetSupabaseConfig(cfg.SupabaseURL, cfg.SupabaseKey)
		log.Println("Auth configured")
	}

	// Setup upload handler
	var uploadHandler *handlers.UploadHandler
	if db != nil && storageClient != nil {
		uploadHandler = handlers.NewUploadHandler(db, storageClient, extractionProcessor)
	}

	// Setup properties handler
	var propertiesHandler *handlers.PropertiesHandler
	if db != nil {
		propertiesHandler = handlers.NewPropertiesHandler(db, renderer)
	}

	// Setup systems handler
	var systemsHandler *handlers.SystemsHandler
	if db != nil {
		systemsHandler = handlers.NewSystemsHandler(db, storageClient, renderer)
	}

	// Setup components handler
	var componentsHandler *handlers.ComponentsHandler
	if db != nil {
		componentsHandler = handlers.NewComponentsHandler(db, storageClient, renderer)
	}

	// Setup documents handler
	var documentsHandler *handlers.DocumentsHandler
	if db != nil && storageClient != nil {
		documentsHandler = handlers.NewDocumentsHandler(db, storageClient, renderer, extractionProcessor)
	}

	// Setup home handler
	homeHandler := handlers.NewHomeHandler(db, renderer)

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
	mux.HandleFunc("GET /", homeHandler.HandleDashboard)

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

	// Properties routes
	if propertiesHandler != nil {
		mux.HandleFunc("GET /properties", propertiesHandler.HandleList)
		mux.HandleFunc("GET /properties/new", propertiesHandler.HandleNew)
		mux.HandleFunc("GET /properties/{id}", propertiesHandler.HandleDetail)
		mux.HandleFunc("POST /properties", propertiesHandler.HandleCreate)
		mux.HandleFunc("PUT /properties/{id}", propertiesHandler.HandleUpdate)
		mux.HandleFunc("DELETE /properties/{id}", propertiesHandler.HandleDelete)
	}

	// Systems routes
	if systemsHandler != nil {
		mux.HandleFunc("GET /systems", systemsHandler.HandleList)
		mux.HandleFunc("POST /properties/{id}/systems", systemsHandler.HandleCreate)
		mux.HandleFunc("GET /systems/{id}", systemsHandler.HandleDetail)
		mux.HandleFunc("PUT /systems/{id}", systemsHandler.HandleUpdate)
		mux.HandleFunc("DELETE /systems/{id}", systemsHandler.HandleDelete)
	}

	// Components routes
	if componentsHandler != nil {
		mux.HandleFunc("POST /systems/{id}/components", componentsHandler.HandleCreate)
		mux.HandleFunc("GET /components/{id}", componentsHandler.HandleDetail)
		mux.HandleFunc("PUT /components/{id}", componentsHandler.HandleUpdate)
		mux.HandleFunc("DELETE /components/{id}", componentsHandler.HandleDelete)
	}

	// Documents routes
	if documentsHandler != nil {
		mux.HandleFunc("GET /documents", documentsHandler.HandleList)
		mux.HandleFunc("GET /documents/{id}", documentsHandler.HandleDetail)
		mux.HandleFunc("PUT /documents/{id}/link", documentsHandler.HandleLink)
		mux.HandleFunc("POST /documents/{id}/reprocess", documentsHandler.HandleReprocess)
		mux.HandleFunc("DELETE /documents/{id}", documentsHandler.HandleDelete)
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

	// Build middleware chain
	var handler http.Handler = mux
	if authMiddleware != nil {
		handler = authMiddleware.OptionalAuth(handler)
	}
	handler = middleware.Logging(handler)

	serverURL := "http://localhost:" + cfg.Port
	if os.Getenv("FLY_APP_NAME") != "" {
		serverURL = "https://" + os.Getenv("FLY_APP_NAME") + ".fly.dev"
	}
	log.Printf("Server starting at %s", serverURL)
	if err := http.ListenAndServe(":"+cfg.Port, handler); err != nil {
		log.Fatal(err)
	}
}
