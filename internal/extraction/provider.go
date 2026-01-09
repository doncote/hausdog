package extraction

// StreamCallback is called for each chunk of streamed text.
type StreamCallback func(chunk string, index int, isFinal bool)

// Provider defines the interface for LLM extraction providers.
// Implementations handle the actual API calls to different LLM services.
type Provider interface {
	// Extract sends document data to the LLM and returns extracted information.
	Extract(data []byte, contentType string, systemPrompt, userPrompt string) (*ExtractionResult, error)

	// ExtractStreaming sends document data and streams the response via callback.
	// The callback is called for each chunk of text received.
	// Returns the final parsed extraction result.
	ExtractStreaming(data []byte, contentType string, systemPrompt, userPrompt string, callback StreamCallback) (*ExtractionResult, error)

	// ExtractWithTools sends document data with inventory context and tools for agentic extraction.
	// Returns the extraction result and any tool calls the LLM wants to make.
	ExtractWithTools(data []byte, contentType string, systemPrompt, userPrompt string, tools []Tool) (*ExtractionResult, []ToolCall, error)

	// ContinueWithToolResults continues the conversation after tool execution.
	// Returns updated extraction result and any additional tool calls.
	ContinueWithToolResults(results []ToolResult) (*ExtractionResult, []ToolCall, error)

	// Name returns the provider name for logging.
	Name() string

	// SupportsTools returns whether this provider supports tool calling.
	SupportsTools() bool

	// SupportsStreaming returns whether this provider supports streaming responses.
	SupportsStreaming() bool
}

// ProviderType represents supported LLM providers.
type ProviderType string

const (
	ProviderClaude ProviderType = "claude"
	ProviderGemini ProviderType = "gemini"
)

// NewProvider creates a provider based on the type and API key.
func NewProvider(providerType ProviderType, apiKey string) Provider {
	switch providerType {
	case ProviderGemini:
		return NewGeminiClient(apiKey)
	case ProviderClaude:
		fallthrough
	default:
		return NewClaudeClient(apiKey)
	}
}
