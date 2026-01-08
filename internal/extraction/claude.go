// Package extraction handles AI-powered document data extraction using Claude.
package extraction

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"time"
)

const (
	claudeAPIURL     = "https://api.anthropic.com/v1/messages"
	claudeAPIVersion = "2023-06-01"
	claudeModel      = "claude-sonnet-4-20250514"
)

// Client handles Claude API interactions for document extraction.
type Client struct {
	apiKey     string
	httpClient *http.Client
}

// NewClient creates a new Claude extraction client.
func NewClient(apiKey string) *Client {
	return &Client{
		apiKey: apiKey,
		httpClient: &http.Client{
			Timeout: 120 * time.Second, // Long timeout for vision requests
		},
	}
}

// Message represents a Claude API message.
type Message struct {
	Role    string    `json:"role"`
	Content []Content `json:"content"`
}

// Content represents message content (text or image).
type Content struct {
	Type   string  `json:"type"`
	Text   string  `json:"text,omitempty"`
	Source *Source `json:"source,omitempty"`
}

// Source represents an image source.
type Source struct {
	Type      string `json:"type"`
	MediaType string `json:"media_type"`
	Data      string `json:"data"`
}

// Request represents a Claude API request.
type Request struct {
	Model     string    `json:"model"`
	MaxTokens int       `json:"max_tokens"`
	System    string    `json:"system,omitempty"`
	Messages  []Message `json:"messages"`
}

// Response represents a Claude API response.
type Response struct {
	ID           string           `json:"id"`
	Type         string           `json:"type"`
	Role         string           `json:"role"`
	Content      []ResponseContent `json:"content"`
	Model        string           `json:"model"`
	StopReason   string           `json:"stop_reason"`
	StopSequence *string          `json:"stop_sequence"`
	Usage        Usage            `json:"usage"`
}

// ResponseContent represents content in the response.
type ResponseContent struct {
	Type string `json:"type"`
	Text string `json:"text"`
}

// Usage represents token usage.
type Usage struct {
	InputTokens  int `json:"input_tokens"`
	OutputTokens int `json:"output_tokens"`
}

// APIError represents an API error response.
type APIError struct {
	Type    string `json:"type"`
	Message string `json:"message"`
}

// Extract sends a document to Claude for extraction.
// It accepts the document data, content type, and extraction prompt.
func (c *Client) Extract(data []byte, contentType string, systemPrompt, userPrompt string) (*ExtractionResult, error) {
	// Build the message content
	content := []Content{
		{
			Type: "image",
			Source: &Source{
				Type:      "base64",
				MediaType: contentType,
				Data:      base64.StdEncoding.EncodeToString(data),
			},
		},
		{
			Type: "text",
			Text: userPrompt,
		},
	}

	// For PDFs, we need to handle differently - Claude doesn't support PDF directly
	// For now, we'll just send PDFs as documents and rely on text extraction
	if contentType == "application/pdf" {
		content = []Content{
			{
				Type: "document",
				Source: &Source{
					Type:      "base64",
					MediaType: contentType,
					Data:      base64.StdEncoding.EncodeToString(data),
				},
			},
			{
				Type: "text",
				Text: userPrompt,
			},
		}
	}

	req := Request{
		Model:     claudeModel,
		MaxTokens: 4096,
		System:    systemPrompt,
		Messages: []Message{
			{
				Role:    "user",
				Content: content,
			},
		},
	}

	reqBody, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	httpReq, err := http.NewRequest("POST", claudeAPIURL, bytes.NewReader(reqBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")
	httpReq.Header.Set("x-api-key", c.apiKey)
	httpReq.Header.Set("anthropic-version", claudeAPIVersion)

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode != http.StatusOK {
		var apiErr struct {
			Error APIError `json:"error"`
		}
		if err := json.Unmarshal(respBody, &apiErr); err == nil {
			return nil, fmt.Errorf("API error (%d): %s - %s", resp.StatusCode, apiErr.Error.Type, apiErr.Error.Message)
		}
		return nil, fmt.Errorf("API error (%d): %s", resp.StatusCode, string(respBody))
	}

	var claudeResp Response
	if err := json.Unmarshal(respBody, &claudeResp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	// Extract the text content
	if len(claudeResp.Content) == 0 {
		return nil, fmt.Errorf("empty response from Claude")
	}

	text := ""
	for _, c := range claudeResp.Content {
		if c.Type == "text" {
			text += c.Text
		}
	}

	// Parse the JSON response
	result, err := parseExtractionResult(text)
	if err != nil {
		return nil, fmt.Errorf("failed to parse extraction result: %w", err)
	}

	return result, nil
}

// parseExtractionResult extracts JSON from Claude's response.
func parseExtractionResult(text string) (*ExtractionResult, error) {
	// Try to find JSON in the response (it might be wrapped in markdown code blocks)
	jsonStart := -1
	jsonEnd := -1

	// Look for ```json block
	if idx := bytes.Index([]byte(text), []byte("```json")); idx != -1 {
		jsonStart = idx + 7
		if endIdx := bytes.Index([]byte(text[jsonStart:]), []byte("```")); endIdx != -1 {
			jsonEnd = jsonStart + endIdx
		}
	}

	// Look for plain ``` block
	if jsonStart == -1 {
		if idx := bytes.Index([]byte(text), []byte("```\n{")); idx != -1 {
			jsonStart = idx + 4
			if endIdx := bytes.Index([]byte(text[jsonStart:]), []byte("```")); endIdx != -1 {
				jsonEnd = jsonStart + endIdx
			}
		}
	}

	// Try to find raw JSON object
	if jsonStart == -1 {
		if idx := bytes.Index([]byte(text), []byte("{")); idx != -1 {
			jsonStart = idx
			jsonEnd = len(text)
		}
	}

	if jsonStart == -1 {
		return nil, fmt.Errorf("no JSON found in response")
	}

	jsonText := text[jsonStart:jsonEnd]

	var result ExtractionResult
	if err := json.Unmarshal([]byte(jsonText), &result); err != nil {
		return nil, fmt.Errorf("failed to parse JSON: %w (json: %s)", err, jsonText[:min(200, len(jsonText))])
	}

	return &result, nil
}

func min(a, b int) int {
	if a < b {
		return a
	}
	return b
}
