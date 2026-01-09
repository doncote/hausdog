package extraction

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"time"
)

const (
	// gemini-2.0-flash has free tier access and vision capabilities
	geminiAPIURL = "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent"
)

// GeminiClient handles Google Gemini API interactions for document extraction.
type GeminiClient struct {
	apiKey     string
	httpClient *http.Client
	// Conversation state for multi-turn tool use
	conversationHistory []GeminiContent
}

// NewGeminiClient creates a new Gemini extraction client.
func NewGeminiClient(apiKey string) *GeminiClient {
	return &GeminiClient{
		apiKey: apiKey,
		httpClient: &http.Client{
			Timeout: 120 * time.Second,
		},
	}
}

// Name returns the provider name.
func (c *GeminiClient) Name() string {
	return "Gemini"
}

// SupportsTools returns whether this provider supports tool calling.
func (c *GeminiClient) SupportsTools() bool {
	return true
}

// SupportsStreaming returns whether this provider supports streaming responses.
func (c *GeminiClient) SupportsStreaming() bool {
	return false // TODO: Implement Gemini streaming
}

// ExtractStreaming falls back to non-streaming Extract for Gemini.
// The callback is called once with the full response.
func (c *GeminiClient) ExtractStreaming(data []byte, contentType string, systemPrompt, userPrompt string, callback StreamCallback) (*ExtractionResult, error) {
	result, err := c.Extract(data, contentType, systemPrompt, userPrompt)
	if err != nil {
		return nil, err
	}

	// Call callback with final chunk indicator (no streaming for Gemini)
	if callback != nil {
		callback("", 0, true)
	}

	return result, nil
}

// GeminiRequest represents a Gemini API request.
type GeminiRequest struct {
	Contents          []GeminiContent         `json:"contents"`
	SystemInstruction *GeminiContent          `json:"systemInstruction,omitempty"`
	GenerationConfig  *GeminiGenerationConfig `json:"generationConfig,omitempty"`
	Tools             []GeminiTool            `json:"tools,omitempty"`
}

// GeminiTool represents a tool declaration for function calling.
type GeminiTool struct {
	FunctionDeclarations []GeminiFunctionDeclaration `json:"functionDeclarations,omitempty"`
}

// GeminiFunctionDeclaration describes a function the model can call.
type GeminiFunctionDeclaration struct {
	Name        string                 `json:"name"`
	Description string                 `json:"description"`
	Parameters  *GeminiSchema          `json:"parameters,omitempty"`
}

// GeminiSchema describes the parameters schema.
type GeminiSchema struct {
	Type       string                  `json:"type"`
	Properties map[string]*GeminiSchema `json:"properties,omitempty"`
	Required   []string                `json:"required,omitempty"`
	Enum       []string                `json:"enum,omitempty"`
	Description string                 `json:"description,omitempty"`
}

// GeminiContent represents content in a Gemini request/response.
type GeminiContent struct {
	Parts []GeminiPart `json:"parts"`
	Role  string       `json:"role,omitempty"`
}

// GeminiPart represents a part of content (text, inline data, or function call/response).
type GeminiPart struct {
	Text             string               `json:"text,omitempty"`
	InlineData       *GeminiInlineData    `json:"inlineData,omitempty"`
	FunctionCall     *GeminiFunctionCall  `json:"functionCall,omitempty"`
	FunctionResponse *GeminiFunctionResponse `json:"functionResponse,omitempty"`
}

// GeminiFunctionCall represents a function call from the model.
type GeminiFunctionCall struct {
	Name string         `json:"name"`
	Args map[string]any `json:"args"`
}

// GeminiFunctionResponse represents a function response to send back.
type GeminiFunctionResponse struct {
	Name     string         `json:"name"`
	Response map[string]any `json:"response"`
}

// GeminiInlineData represents inline binary data (images, PDFs).
type GeminiInlineData struct {
	MimeType string `json:"mimeType"`
	Data     string `json:"data"`
}

// GeminiGenerationConfig contains generation parameters.
type GeminiGenerationConfig struct {
	Temperature     float64 `json:"temperature,omitempty"`
	MaxOutputTokens int     `json:"maxOutputTokens,omitempty"`
}

// GeminiResponse represents a Gemini API response.
type GeminiResponse struct {
	Candidates    []GeminiCandidate `json:"candidates"`
	Error         *GeminiError      `json:"error,omitempty"`
	UsageMetadata *GeminiUsage      `json:"usageMetadata,omitempty"`
}

// GeminiUsage represents token usage in the response.
type GeminiUsage struct {
	PromptTokenCount     int `json:"promptTokenCount"`
	CandidatesTokenCount int `json:"candidatesTokenCount"`
	TotalTokenCount      int `json:"totalTokenCount"`
}

// GeminiCandidate represents a response candidate.
type GeminiCandidate struct {
	Content      GeminiContent `json:"content"`
	FinishReason string        `json:"finishReason"`
}

// GeminiError represents an API error.
type GeminiError struct {
	Code    int    `json:"code"`
	Message string `json:"message"`
	Status  string `json:"status"`
}

// Extract sends a document to Gemini for extraction.
func (c *GeminiClient) Extract(data []byte, contentType string, systemPrompt, userPrompt string) (*ExtractionResult, error) {
	// Build the request
	parts := []GeminiPart{
		{
			InlineData: &GeminiInlineData{
				MimeType: contentType,
				Data:     base64.StdEncoding.EncodeToString(data),
			},
		},
		{
			Text: userPrompt,
		},
	}

	req := GeminiRequest{
		Contents: []GeminiContent{
			{
				Parts: parts,
				Role:  "user",
			},
		},
		SystemInstruction: &GeminiContent{
			Parts: []GeminiPart{
				{Text: systemPrompt},
			},
		},
		GenerationConfig: &GeminiGenerationConfig{
			Temperature:     0.1,
			MaxOutputTokens: 4096,
		},
	}

	reqBody, err := json.Marshal(req)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	// Build URL with API key
	url := fmt.Sprintf("%s?key=%s", geminiAPIURL, c.apiKey)

	httpReq, err := http.NewRequest("POST", url, bytes.NewReader(reqBody))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	var geminiResp GeminiResponse
	if err := json.Unmarshal(respBody, &geminiResp); err != nil {
		return nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	if geminiResp.Error != nil {
		return nil, fmt.Errorf("API error (%d): %s - %s", geminiResp.Error.Code, geminiResp.Error.Status, geminiResp.Error.Message)
	}

	if len(geminiResp.Candidates) == 0 {
		return nil, fmt.Errorf("empty response from Gemini")
	}

	// Extract the text content
	text := ""
	for _, part := range geminiResp.Candidates[0].Content.Parts {
		if part.Text != "" {
			text += part.Text
		}
	}

	if text == "" {
		return nil, fmt.Errorf("no text content in response")
	}

	// Parse the JSON response (reuse the same parser from Claude)
	result, err := parseExtractionResult(text)
	if err != nil {
		return nil, fmt.Errorf("failed to parse extraction result: %w", err)
	}

	return result, nil
}

// convertToolsToGemini converts provider-agnostic tools to Gemini format.
func convertToolsToGemini(tools []Tool) []GeminiTool {
	var declarations []GeminiFunctionDeclaration

	for _, tool := range tools {
		decl := GeminiFunctionDeclaration{
			Name:        tool.Name,
			Description: tool.Description,
		}

		if len(tool.Parameters) > 0 {
			props := make(map[string]*GeminiSchema)
			var required []string

			for _, param := range tool.Parameters {
				schema := &GeminiSchema{
					Type:        param.Type,
					Description: param.Description,
				}
				if len(param.Enum) > 0 {
					schema.Enum = param.Enum
				}
				props[param.Name] = schema

				if param.Required {
					required = append(required, param.Name)
				}
			}

			decl.Parameters = &GeminiSchema{
				Type:       "object",
				Properties: props,
				Required:   required,
			}
		}

		declarations = append(declarations, decl)
	}

	return []GeminiTool{{FunctionDeclarations: declarations}}
}

// ExtractWithTools sends document data with tools for agentic extraction.
func (c *GeminiClient) ExtractWithTools(data []byte, contentType string, systemPrompt, userPrompt string, tools []Tool) (*ExtractionResult, []ToolCall, error) {
	// Clear conversation history for new extraction
	c.conversationHistory = nil

	// Build the initial user message with document
	parts := []GeminiPart{
		{
			InlineData: &GeminiInlineData{
				MimeType: contentType,
				Data:     base64.StdEncoding.EncodeToString(data),
			},
		},
		{
			Text: userPrompt,
		},
	}

	userContent := GeminiContent{
		Parts: parts,
		Role:  "user",
	}

	req := GeminiRequest{
		Contents: []GeminiContent{userContent},
		SystemInstruction: &GeminiContent{
			Parts: []GeminiPart{{Text: systemPrompt}},
		},
		GenerationConfig: &GeminiGenerationConfig{
			Temperature:     0.1,
			MaxOutputTokens: 4096,
		},
		Tools: convertToolsToGemini(tools),
	}

	// Store user content in history
	c.conversationHistory = append(c.conversationHistory, userContent)

	return c.sendRequestAndParse(req)
}

// ContinueWithToolResults continues the conversation after tool execution.
func (c *GeminiClient) ContinueWithToolResults(results []ToolResult) (*ExtractionResult, []ToolCall, error) {
	// Build function response parts
	var parts []GeminiPart
	for _, result := range results {
		parts = append(parts, GeminiPart{
			FunctionResponse: &GeminiFunctionResponse{
				Name: result.ToolCallID, // Use tool name stored in ID
				Response: map[string]any{
					"result":   result.Content,
					"is_error": result.IsError,
				},
			},
		})
	}

	functionResponseContent := GeminiContent{
		Parts: parts,
		Role:  "user",
	}

	// Add to history
	c.conversationHistory = append(c.conversationHistory, functionResponseContent)

	req := GeminiRequest{
		Contents: c.conversationHistory,
		GenerationConfig: &GeminiGenerationConfig{
			Temperature:     0.1,
			MaxOutputTokens: 4096,
		},
	}

	return c.sendRequestAndParse(req)
}

// sendRequestAndParse sends the request and parses the response.
func (c *GeminiClient) sendRequestAndParse(req GeminiRequest) (*ExtractionResult, []ToolCall, error) {
	reqBody, err := json.Marshal(req)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	url := fmt.Sprintf("%s?key=%s", geminiAPIURL, c.apiKey)

	httpReq, err := http.NewRequest("POST", url, bytes.NewReader(reqBody))
	if err != nil {
		return nil, nil, fmt.Errorf("failed to create request: %w", err)
	}

	httpReq.Header.Set("Content-Type", "application/json")

	resp, err := c.httpClient.Do(httpReq)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to send request: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to read response: %w", err)
	}

	var geminiResp GeminiResponse
	if err := json.Unmarshal(respBody, &geminiResp); err != nil {
		return nil, nil, fmt.Errorf("failed to unmarshal response: %w", err)
	}

	if geminiResp.Error != nil {
		return nil, nil, fmt.Errorf("API error (%d): %s - %s", geminiResp.Error.Code, geminiResp.Error.Status, geminiResp.Error.Message)
	}

	// Log token usage and cost
	// Gemini 2.0 Flash pricing: $0.10/1M input tokens, $0.40/1M output tokens
	if geminiResp.UsageMetadata != nil {
		inputCost := float64(geminiResp.UsageMetadata.PromptTokenCount) * 0.10 / 1_000_000
		outputCost := float64(geminiResp.UsageMetadata.CandidatesTokenCount) * 0.40 / 1_000_000
		totalCost := inputCost + outputCost
		log.Printf("Gemini tokens: prompt=%d, response=%d, total=%d | cost: $%.6f",
			geminiResp.UsageMetadata.PromptTokenCount,
			geminiResp.UsageMetadata.CandidatesTokenCount,
			geminiResp.UsageMetadata.TotalTokenCount,
			totalCost)
	}

	if len(geminiResp.Candidates) == 0 {
		return nil, nil, fmt.Errorf("empty response from Gemini")
	}

	candidate := geminiResp.Candidates[0]

	// Store model response in history
	c.conversationHistory = append(c.conversationHistory, candidate.Content)

	// Check for function calls
	var toolCalls []ToolCall
	var textContent string

	for _, part := range candidate.Content.Parts {
		if part.FunctionCall != nil {
			toolCalls = append(toolCalls, ToolCall{
				ID:        part.FunctionCall.Name, // Gemini uses name as ID
				Name:      part.FunctionCall.Name,
				Arguments: part.FunctionCall.Args,
			})
		}
		if part.Text != "" {
			textContent += part.Text
		}
	}

	// If we have tool calls, return them for execution
	if len(toolCalls) > 0 {
		return nil, toolCalls, nil
	}

	// Otherwise parse the text response as extraction result
	if textContent == "" {
		return nil, nil, fmt.Errorf("no text content in response")
	}

	result, err := parseExtractionResult(textContent)
	if err != nil {
		return nil, nil, fmt.Errorf("failed to parse extraction result: %w", err)
	}

	return result, nil, nil
}
