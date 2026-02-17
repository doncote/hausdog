package client

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

// SimpleClient is a basic API client for manual HTTP calls
type SimpleClient struct {
	BaseURL    string
	APIKey     string
	HTTPClient *http.Client
}

// NewSimple creates a new simple API client
func NewSimple(baseURL, apiKey string) *SimpleClient {
	return &SimpleClient{
		BaseURL: baseURL,
		APIKey:  apiKey,
		HTTPClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

// APIError represents an API error response
type APIError struct {
	Error   string `json:"error"`
	Message string `json:"message"`
}

// doRequest performs an HTTP request with authentication
func (c *SimpleClient) doRequest(method, path string, body interface{}) ([]byte, error) {
	var reqBody io.Reader
	if body != nil {
		jsonBody, err := json.Marshal(body)
		if err != nil {
			return nil, fmt.Errorf("failed to marshal request body: %w", err)
		}
		reqBody = bytes.NewReader(jsonBody)
	}

	req, err := http.NewRequest(method, c.BaseURL+path, reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Authorization", "Bearer "+c.APIKey)
	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/json")

	resp, err := c.HTTPClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode >= 400 {
		var apiErr APIError
		if err := json.Unmarshal(respBody, &apiErr); err == nil && apiErr.Message != "" {
			return nil, fmt.Errorf("API error (%d): %s", resp.StatusCode, apiErr.Message)
		}
		return nil, fmt.Errorf("API error (%d): %s", resp.StatusCode, string(respBody))
	}

	return respBody, nil
}

// Get performs a GET request
func (c *SimpleClient) Get(path string) ([]byte, error) {
	return c.doRequest("GET", path, nil)
}

// Post performs a POST request
func (c *SimpleClient) Post(path string, body interface{}) ([]byte, error) {
	return c.doRequest("POST", path, body)
}

// Patch performs a PATCH request
func (c *SimpleClient) Patch(path string, body interface{}) ([]byte, error) {
	return c.doRequest("PATCH", path, body)
}

// Delete performs a DELETE request
func (c *SimpleClient) Delete(path string) ([]byte, error) {
	return c.doRequest("DELETE", path, nil)
}
