package auth

import (
	"context"
	"net/http"
	"strings"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

type contextKey string

const (
	// UserContextKey is the context key for the authenticated user.
	UserContextKey contextKey = "user"
)

// Claims represents the JWT claims from Supabase.
type Claims struct {
	jwt.RegisteredClaims
	Email string `json:"email"`
}

// Middleware provides authentication middleware.
type Middleware struct {
	jwtSecret []byte
	client    *Client
}

// NewMiddleware creates a new auth middleware.
func NewMiddleware(jwtSecret string, client *Client) *Middleware {
	return &Middleware{
		jwtSecret: []byte(jwtSecret),
		client:    client,
	}
}

// RequireAuth is middleware that requires a valid JWT token.
// It extracts the user from the token and adds it to the request context.
func (m *Middleware) RequireAuth(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Try to get token from Authorization header
		token := extractBearerToken(r)

		// Fall back to cookie
		if token == "" {
			if cookie, err := r.Cookie("access_token"); err == nil {
				token = cookie.Value
			}
		}

		if token == "" {
			http.Redirect(w, r, "/login", http.StatusSeeOther)
			return
		}

		// Parse and validate the JWT
		claims := &Claims{}
		parsedToken, err := jwt.ParseWithClaims(token, claims, func(t *jwt.Token) (interface{}, error) {
			return m.jwtSecret, nil
		})

		if err != nil || !parsedToken.Valid {
			// Token is invalid, redirect to login
			http.Redirect(w, r, "/login", http.StatusSeeOther)
			return
		}

		// Extract user ID from the subject claim
		userID, err := uuid.Parse(claims.Subject)
		if err != nil {
			http.Redirect(w, r, "/login", http.StatusSeeOther)
			return
		}

		// Create user and add to context
		user := &User{
			ID:    userID,
			Email: claims.Email,
		}

		ctx := context.WithValue(r.Context(), UserContextKey, user)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// GetUser extracts the authenticated user from the request context.
func GetUser(ctx context.Context) *User {
	user, _ := ctx.Value(UserContextKey).(*User)
	return user
}

// extractBearerToken extracts the token from the Authorization header.
func extractBearerToken(r *http.Request) string {
	auth := r.Header.Get("Authorization")
	if auth == "" {
		return ""
	}

	parts := strings.SplitN(auth, " ", 2)
	if len(parts) != 2 || !strings.EqualFold(parts[0], "bearer") {
		return ""
	}

	return parts[1]
}
