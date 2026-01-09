package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"strings"

	"github.com/google/uuid"
)

// Client handles Supabase authentication.
type Client struct {
	baseURL    string
	anonKey    string
	httpClient *http.Client
}

// NewClient creates a new Supabase auth client.
func NewClient(supabaseURL, anonKey string) *Client {
	return &Client{
		baseURL:    strings.TrimSuffix(supabaseURL, "/"),
		anonKey:    anonKey,
		httpClient: &http.Client{},
	}
}

// User represents a Supabase user from the JWT claims.
type User struct {
	ID    uuid.UUID `json:"id"`
	Email string    `json:"email"`
}

// Session represents an authenticated session.
type Session struct {
	AccessToken  string `json:"access_token"`
	RefreshToken string `json:"refresh_token"`
	ExpiresIn    int    `json:"expires_in"`
	TokenType    string `json:"token_type"`
	User         *User  `json:"user"`
}

// generateCodeVerifier creates a random code verifier for PKCE.
func generateCodeVerifier() (string, error) {
	b := make([]byte, 32)
	if _, err := rand.Read(b); err != nil {
		return "", err
	}
	return base64.RawURLEncoding.EncodeToString(b), nil
}

// generateCodeChallenge creates a code challenge from a verifier using S256.
func generateCodeChallenge(verifier string) string {
	h := sha256.Sum256([]byte(verifier))
	return base64.RawURLEncoding.EncodeToString(h[:])
}

// GetOAuthURL returns the OAuth authorization URL and code verifier for PKCE flow.
func (c *Client) GetOAuthURL(provider, redirectURL string) (authURL string, codeVerifier string, err error) {
	codeVerifier, err = generateCodeVerifier()
	if err != nil {
		return "", "", fmt.Errorf("failed to generate code verifier: %w", err)
	}
	codeChallenge := generateCodeChallenge(codeVerifier)

	params := url.Values{}
	params.Set("provider", provider)
	params.Set("redirect_to", redirectURL)
	params.Set("code_challenge", codeChallenge)
	params.Set("code_challenge_method", "S256")

	authURL = fmt.Sprintf("%s/auth/v1/authorize?%s", c.baseURL, params.Encode())
	return authURL, codeVerifier, nil
}

// ExchangeCodeForSession exchanges an OAuth code for a session using PKCE.
func (c *Client) ExchangeCodeForSession(code, codeVerifier string) (*Session, error) {
	reqURL := fmt.Sprintf("%s/auth/v1/token?grant_type=pkce", c.baseURL)

	body := fmt.Sprintf(`{"auth_code":"%s","code_verifier":"%s"}`, code, codeVerifier)

	req, err := http.NewRequest("POST", reqURL, strings.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", c.anonKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to exchange code: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("exchange failed with status %d: %s", resp.StatusCode, string(respBody))
	}

	var session Session
	if err := json.NewDecoder(resp.Body).Decode(&session); err != nil {
		return nil, fmt.Errorf("failed to decode session: %w", err)
	}

	return &session, nil
}

// RefreshSession refreshes an expired session.
func (c *Client) RefreshSession(refreshToken string) (*Session, error) {
	reqURL := fmt.Sprintf("%s/auth/v1/token?grant_type=refresh_token", c.baseURL)

	body := fmt.Sprintf(`{"refresh_token":"%s"}`, refreshToken)
	req, err := http.NewRequest("POST", reqURL, strings.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("apikey", c.anonKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to refresh token: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("refresh failed with status: %d", resp.StatusCode)
	}

	var session Session
	if err := json.NewDecoder(resp.Body).Decode(&session); err != nil {
		return nil, fmt.Errorf("failed to decode session: %w", err)
	}

	return &session, nil
}

// GetUser fetches the current user from the access token.
func (c *Client) GetUser(accessToken string) (*User, error) {
	reqURL := fmt.Sprintf("%s/auth/v1/user", c.baseURL)

	req, err := http.NewRequest("GET", reqURL, nil)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+accessToken)
	req.Header.Set("apikey", c.anonKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to get user: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("get user failed with status: %d", resp.StatusCode)
	}

	var user User
	if err := json.NewDecoder(resp.Body).Decode(&user); err != nil {
		return nil, fmt.Errorf("failed to decode user: %w", err)
	}

	return &user, nil
}
