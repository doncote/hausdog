// Package storage provides Supabase storage client for document uploads.
package storage

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"path"
	"strings"
	"time"

	"github.com/google/uuid"
)

// Client handles Supabase Storage operations.
type Client struct {
	baseURL    string
	serviceKey string
	bucket     string
	httpClient *http.Client
}

// NewClient creates a new Supabase Storage client.
func NewClient(supabaseURL, serviceKey, bucket string) *Client {
	return &Client{
		baseURL:    strings.TrimSuffix(supabaseURL, "/"),
		serviceKey: serviceKey,
		bucket:     bucket,
		httpClient: &http.Client{Timeout: 60 * time.Second},
	}
}

// UploadResult contains information about an uploaded file.
type UploadResult struct {
	Path        string `json:"path"`
	FullPath    string `json:"full_path"`
	ContentType string `json:"content_type"`
	Size        int64  `json:"size"`
}

// Upload uploads a file to Supabase Storage.
// It generates a unique path using UUID to avoid collisions.
func (c *Client) Upload(userID uuid.UUID, filename string, contentType string, data io.Reader) (*UploadResult, error) {
	// Generate unique storage path: user_id/uuid/filename
	fileID := uuid.New()
	storagePath := path.Join(userID.String(), fileID.String(), filename)

	// Read all data to get size and create request body
	body, err := io.ReadAll(data)
	if err != nil {
		return nil, fmt.Errorf("failed to read file data: %w", err)
	}

	// Build upload URL
	uploadURL := fmt.Sprintf("%s/storage/v1/object/%s/%s", c.baseURL, c.bucket, storagePath)

	req, err := http.NewRequest("POST", uploadURL, bytes.NewReader(body))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.serviceKey)
	req.Header.Set("Content-Type", contentType)
	req.Header.Set("x-upsert", "false")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("failed to upload file: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusCreated {
		respBody, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("upload failed with status %d: %s", resp.StatusCode, string(respBody))
	}

	return &UploadResult{
		Path:        storagePath,
		FullPath:    fmt.Sprintf("%s/storage/v1/object/%s/%s", c.baseURL, c.bucket, storagePath),
		ContentType: contentType,
		Size:        int64(len(body)),
	}, nil
}

// Download downloads a file from Supabase Storage.
func (c *Client) Download(storagePath string) (io.ReadCloser, string, error) {
	downloadURL := fmt.Sprintf("%s/storage/v1/object/%s/%s", c.baseURL, c.bucket, storagePath)

	req, err := http.NewRequest("GET", downloadURL, nil)
	if err != nil {
		return nil, "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.serviceKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, "", fmt.Errorf("failed to download file: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		resp.Body.Close()
		return nil, "", fmt.Errorf("download failed with status %d", resp.StatusCode)
	}

	contentType := resp.Header.Get("Content-Type")
	return resp.Body, contentType, nil
}

// GetSignedURL generates a signed URL for temporary access to a private file.
func (c *Client) GetSignedURL(storagePath string, expiresIn time.Duration) (string, error) {
	signURL := fmt.Sprintf("%s/storage/v1/object/sign/%s/%s", c.baseURL, c.bucket, storagePath)

	body := map[string]int64{
		"expiresIn": int64(expiresIn.Seconds()),
	}
	bodyJSON, err := json.Marshal(body)
	if err != nil {
		return "", fmt.Errorf("failed to marshal request body: %w", err)
	}

	req, err := http.NewRequest("POST", signURL, bytes.NewReader(bodyJSON))
	if err != nil {
		return "", fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.serviceKey)
	req.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return "", fmt.Errorf("failed to get signed URL: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		respBody, _ := io.ReadAll(resp.Body)
		return "", fmt.Errorf("sign URL failed with status %d: %s", resp.StatusCode, string(respBody))
	}

	var result struct {
		SignedURL string `json:"signedURL"`
	}
	if err := json.NewDecoder(resp.Body).Decode(&result); err != nil {
		return "", fmt.Errorf("failed to decode response: %w", err)
	}

	// The signedURL is relative, prepend the base URL and storage path
	if !strings.HasPrefix(result.SignedURL, "http") {
		return c.baseURL + "/storage/v1" + result.SignedURL, nil
	}

	return result.SignedURL, nil
}

// Delete removes a file from Supabase Storage.
func (c *Client) Delete(storagePath string) error {
	deleteURL := fmt.Sprintf("%s/storage/v1/object/%s/%s", c.baseURL, c.bucket, url.PathEscape(storagePath))

	req, err := http.NewRequest("DELETE", deleteURL, nil)
	if err != nil {
		return fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.serviceKey)

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return fmt.Errorf("failed to delete file: %w", err)
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK && resp.StatusCode != http.StatusNoContent {
		return fmt.Errorf("delete failed with status %d", resp.StatusCode)
	}

	return nil
}
