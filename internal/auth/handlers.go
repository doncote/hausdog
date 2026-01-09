package auth

import (
	"log"
	"net/http"
	"time"
)

// Handlers provides HTTP handlers for authentication.
type Handlers struct {
	client      *Client
	redirectURL string
}

// NewHandlers creates new auth handlers.
func NewHandlers(client *Client, baseURL string) *Handlers {
	return &Handlers{
		client:      client,
		redirectURL: baseURL + "/auth/callback",
	}
}

// HandleLogin redirects to the OAuth provider.
func (h *Handlers) HandleLogin(w http.ResponseWriter, r *http.Request) {
	provider := r.URL.Query().Get("provider")
	if provider == "" {
		provider = "google"
	}

	authURL, codeVerifier, err := h.client.GetOAuthURL(provider, h.redirectURL)
	if err != nil {
		http.Error(w, "Failed to generate auth URL", http.StatusInternalServerError)
		return
	}

	// Store code verifier in a secure cookie for the callback
	http.SetCookie(w, &http.Cookie{
		Name:     "code_verifier",
		Value:    codeVerifier,
		Path:     "/",
		HttpOnly: true,
		Secure:   false, // Allow HTTP for local dev
		SameSite: http.SameSiteLaxMode,
		MaxAge:   600, // 10 minutes
	})

	http.Redirect(w, r, authURL, http.StatusSeeOther)
}

// HandleCallback handles the OAuth callback.
func (h *Handlers) HandleCallback(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	if code == "" {
		http.Error(w, "Missing authorization code", http.StatusBadRequest)
		return
	}

	// Get code verifier from cookie
	verifierCookie, err := r.Cookie("code_verifier")
	if err != nil {
		http.Error(w, "Missing code verifier", http.StatusBadRequest)
		return
	}

	// Clear the code verifier cookie
	http.SetCookie(w, &http.Cookie{
		Name:     "code_verifier",
		Value:    "",
		Path:     "/",
		MaxAge:   -1,
		Expires:  time.Unix(0, 0),
	})

	log.Printf("Exchanging code %s with verifier %s...", code[:8], verifierCookie.Value[:8])
	session, err := h.client.ExchangeCodeForSession(code, verifierCookie.Value)
	if err != nil {
		log.Printf("Failed to exchange code: %v", err)
		http.Error(w, "Failed to authenticate", http.StatusInternalServerError)
		return
	}
	log.Printf("Got session for user: %s", session.User.Email)

	// Set the access token as an HTTP-only cookie
	http.SetCookie(w, &http.Cookie{
		Name:     "access_token",
		Value:    session.AccessToken,
		Path:     "/",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   session.ExpiresIn,
	})

	// Set refresh token as well for session refresh
	http.SetCookie(w, &http.Cookie{
		Name:     "refresh_token",
		Value:    session.RefreshToken,
		Path:     "/",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   60 * 60 * 24 * 30, // 30 days
	})

	// Redirect to home page
	http.Redirect(w, r, "/", http.StatusSeeOther)
}

// HandleLogout clears the session cookies.
func (h *Handlers) HandleLogout(w http.ResponseWriter, r *http.Request) {
	// Clear access token
	http.SetCookie(w, &http.Cookie{
		Name:     "access_token",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
		Expires:  time.Unix(0, 0),
	})

	// Clear refresh token
	http.SetCookie(w, &http.Cookie{
		Name:     "refresh_token",
		Value:    "",
		Path:     "/",
		HttpOnly: true,
		Secure:   true,
		SameSite: http.SameSiteLaxMode,
		MaxAge:   -1,
		Expires:  time.Unix(0, 0),
	})

	http.Redirect(w, r, "/login", http.StatusSeeOther)
}
