package auth

import (
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

	authURL := h.client.GetOAuthURL(provider, h.redirectURL)
	http.Redirect(w, r, authURL, http.StatusSeeOther)
}

// HandleCallback handles the OAuth callback.
func (h *Handlers) HandleCallback(w http.ResponseWriter, r *http.Request) {
	code := r.URL.Query().Get("code")
	if code == "" {
		http.Error(w, "Missing authorization code", http.StatusBadRequest)
		return
	}

	session, err := h.client.ExchangeCodeForSession(code)
	if err != nil {
		http.Error(w, "Failed to authenticate", http.StatusInternalServerError)
		return
	}

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
