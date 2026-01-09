// Package config handles environment variable loading and application configuration.
package config

import (
	"fmt"
	"os"
	"strconv"

	"github.com/joho/godotenv"
)

func init() {
	// Load .env.local first (for local development), then .env
	// Existing env vars take precedence
	_ = godotenv.Load(".env.local")
	_ = godotenv.Load(".env")
}

// Config holds all application configuration.
type Config struct {
	// Server settings
	Port     string
	LogLevel string

	// Supabase
	SupabaseURL        string
	SupabaseKey        string
	SupabaseServiceKey string
	SupabaseJWTSecret  string

	// Database
	DatabaseURL string

	// LLM Provider for document extraction
	LLMProvider  string // "claude" or "gemini"
	ClaudeAPIKey string
	GeminiAPIKey string

	// Session
	SessionSecret string
}

// Load reads configuration from environment variables.
// Returns an error if required variables are missing.
func Load() (*Config, error) {
	cfg := &Config{
		Port:               getEnv("PORT", "8080"),
		LogLevel:           getEnv("LOG_LEVEL", "info"),
		SupabaseURL:        os.Getenv("SUPABASE_URL"),
		SupabaseKey:        os.Getenv("SUPABASE_KEY"),
		SupabaseServiceKey: os.Getenv("SUPABASE_SERVICE_KEY"),
		SupabaseJWTSecret:  os.Getenv("SUPABASE_JWT_SECRET"),
		DatabaseURL:        os.Getenv("DATABASE_URL"),
		LLMProvider:        getEnv("LLM_PROVIDER", "claude"), // Default to Claude
		ClaudeAPIKey:       os.Getenv("CLAUDE_API_KEY"),
		GeminiAPIKey:       os.Getenv("GEMINI_API_KEY"),
		SessionSecret:      os.Getenv("SESSION_SECRET"),
	}

	// Validate required fields
	var missing []string
	if cfg.SupabaseURL == "" {
		missing = append(missing, "SUPABASE_URL")
	}
	if cfg.SupabaseKey == "" {
		missing = append(missing, "SUPABASE_KEY")
	}
	if cfg.DatabaseURL == "" {
		missing = append(missing, "DATABASE_URL")
	}
	if cfg.SessionSecret == "" {
		missing = append(missing, "SESSION_SECRET")
	}

	if len(missing) > 0 {
		return nil, fmt.Errorf("missing required environment variables: %v", missing)
	}

	return cfg, nil
}

// MustLoad loads configuration and panics on error.
// Use this in main() where you want to fail fast.
func MustLoad() *Config {
	cfg, err := Load()
	if err != nil {
		panic(err)
	}
	return cfg
}

// getEnv returns the value of an environment variable or a default value.
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// getEnvInt returns the value of an environment variable as an int or a default value.
func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if i, err := strconv.Atoi(value); err == nil {
			return i
		}
	}
	return defaultValue
}

// getEnvBool returns the value of an environment variable as a bool or a default value.
func getEnvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if b, err := strconv.ParseBool(value); err == nil {
			return b
		}
	}
	return defaultValue
}

// IsDevelopment returns true if running in development mode.
func (c *Config) IsDevelopment() bool {
	return c.LogLevel == "debug"
}

// LLMAPIKey returns the API key for the configured LLM provider.
func (c *Config) LLMAPIKey() string {
	switch c.LLMProvider {
	case "gemini":
		return c.GeminiAPIKey
	case "claude":
		fallthrough
	default:
		return c.ClaudeAPIKey
	}
}

// HasLLMConfig returns true if an LLM provider is properly configured.
func (c *Config) HasLLMConfig() bool {
	return c.LLMAPIKey() != ""
}
