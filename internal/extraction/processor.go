package extraction

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"sync"
	"time"

	"github.com/don/hausdog/internal/database"
	"github.com/don/hausdog/internal/realtime"
	"github.com/don/hausdog/internal/storage"
	"github.com/google/uuid"
)

// Processor handles async document extraction.
type Processor struct {
	db       *database.DB
	storage  *storage.Client
	provider Provider
	emitter  *realtime.EventEmitter

	// Processing queue
	queue chan uuid.UUID
	wg    sync.WaitGroup

	// Shutdown
	ctx    context.Context
	cancel context.CancelFunc
}

// NewProcessor creates a new extraction processor.
func NewProcessor(db *database.DB, storage *storage.Client, provider Provider, emitter *realtime.EventEmitter) *Processor {
	ctx, cancel := context.WithCancel(context.Background())

	p := &Processor{
		db:       db,
		storage:  storage,
		provider: provider,
		emitter:  emitter,
		queue:    make(chan uuid.UUID, 100),
		ctx:      ctx,
		cancel:   cancel,
	}

	// Start worker goroutines
	numWorkers := 2
	for i := 0; i < numWorkers; i++ {
		p.wg.Add(1)
		go p.worker(i)
	}

	return p
}

// Enqueue adds a document to the processing queue.
func (p *Processor) Enqueue(docID uuid.UUID) {
	select {
	case p.queue <- docID:
		log.Printf("Document %s queued for extraction", docID)
	default:
		log.Printf("Warning: extraction queue full, document %s not queued", docID)
	}
}

// Stop gracefully shuts down the processor.
func (p *Processor) Stop() {
	p.cancel()
	close(p.queue)
	p.wg.Wait()
}

// emit safely emits an event if the emitter is configured.
func (p *Processor) emit(ctx context.Context, docID, userID uuid.UUID, eventType realtime.EventType, data any) {
	if p.emitter != nil {
		if err := p.emitter.Emit(ctx, docID, userID, eventType, data); err != nil {
			log.Printf("Failed to emit %s event for doc %s: %v", eventType, docID, err)
		}
	}
}

// worker processes documents from the queue.
func (p *Processor) worker(id int) {
	defer p.wg.Done()
	log.Printf("Extraction worker %d started", id)

	for {
		select {
		case <-p.ctx.Done():
			log.Printf("Extraction worker %d shutting down", id)
			return
		case docID, ok := <-p.queue:
			if !ok {
				return
			}
			p.processDocument(docID)
		}
	}
}

// processDocument extracts data from a single document.
func (p *Processor) processDocument(docID uuid.UUID) {
	ctx := context.Background()
	startTime := time.Now()
	log.Printf("Processing document %s", docID)

	// Update status to processing
	if err := p.db.UpdateDocumentStatus(ctx, docID, database.ProcessingStatusProcessing); err != nil {
		log.Printf("Failed to update document status: %v", err)
		return
	}

	// Get document details
	doc, err := p.db.GetDocument(ctx, docID)
	if err != nil {
		log.Printf("Failed to get document %s: %v", docID, err)
		p.markFailed(ctx, docID, uuid.Nil, "get_document", err.Error())
		return
	}

	if doc == nil {
		log.Printf("Document %s not found", docID)
		return
	}

	// Emit started event
	p.emit(ctx, docID, doc.UserID, realtime.EventStarted, realtime.StartedData{Step: "downloading"})

	// Download from storage
	reader, contentType, err := p.storage.Download(doc.StoragePath)
	if err != nil {
		log.Printf("Failed to download document %s: %v", docID, err)
		p.markFailed(ctx, docID, doc.UserID, "download", err.Error())
		return
	}
	defer reader.Close()

	data, err := io.ReadAll(reader)
	if err != nil {
		log.Printf("Failed to read document %s: %v", docID, err)
		p.markFailed(ctx, docID, doc.UserID, "read", err.Error())
		return
	}

	// Use stored content type if available
	if doc.ContentType != "" {
		contentType = doc.ContentType
	}

	// Emit extraction step
	p.emit(ctx, docID, doc.UserID, realtime.EventStep, realtime.StepData{
		Step:    "extracting",
		Message: "Analyzing document with AI",
	})

	// Try agentic extraction if provider supports it
	if p.provider.SupportsTools() {
		result, err := p.processDocumentWithTools(ctx, doc, data, contentType)
		if err != nil {
			log.Printf("Agentic extraction failed for document %s: %v, falling back to simple extraction", docID, err)
		} else {
			// Save extraction result
			resultJSON, err := json.Marshal(result)
			if err != nil {
				log.Printf("Failed to marshal extraction result: %v", err)
				p.markFailed(ctx, docID, doc.UserID, "marshal", err.Error())
				return
			}

			if err := p.db.UpdateDocumentExtraction(ctx, docID, resultJSON); err != nil {
				log.Printf("Failed to save extraction result: %v", err)
				p.markFailed(ctx, docID, doc.UserID, "save", err.Error())
				return
			}

			// Emit completed event
			p.emit(ctx, docID, doc.UserID, realtime.EventCompleted, realtime.CompletedData{
				Result:     result,
				DurationMs: time.Since(startTime).Milliseconds(),
			})

			log.Printf("Successfully extracted document %s with agentic processing (type: %s, confidence: %.2f)",
				docID, result.DocumentType, result.Confidence)
			return
		}
	}

	// Fall back to simple extraction (with streaming if supported)
	var result *ExtractionResult
	if p.provider.SupportsStreaming() && p.emitter != nil {
		// Use streaming extraction with chunk callback
		result, err = p.provider.ExtractStreaming(data, contentType, SystemPrompt, UserPrompt, func(chunk string, index int, isFinal bool) {
			p.emitter.EmitChunk(docID, doc.UserID, chunk, index, isFinal)
		})
	} else {
		// Non-streaming extraction
		result, err = p.provider.Extract(data, contentType, SystemPrompt, UserPrompt)
	}
	if err != nil {
		log.Printf("Failed to extract from document %s: %v", docID, err)
		p.markFailed(ctx, docID, doc.UserID, "extraction", err.Error())
		return
	}

	// Save extraction result
	resultJSON, err := json.Marshal(result)
	if err != nil {
		log.Printf("Failed to marshal extraction result: %v", err)
		p.markFailed(ctx, docID, doc.UserID, "marshal", err.Error())
		return
	}

	if err := p.db.UpdateDocumentExtraction(ctx, docID, resultJSON); err != nil {
		log.Printf("Failed to save extraction result: %v", err)
		p.markFailed(ctx, docID, doc.UserID, "save", err.Error())
		return
	}

	// Emit completed event
	p.emit(ctx, docID, doc.UserID, realtime.EventCompleted, realtime.CompletedData{
		Result:     result,
		DurationMs: time.Since(startTime).Milliseconds(),
	})

	log.Printf("Successfully extracted document %s (type: %s, confidence: %.2f)",
		docID, result.DocumentType, result.Confidence)
}

// processDocumentWithTools uses agentic extraction with tool calling.
func (p *Processor) processDocumentWithTools(ctx context.Context, doc *database.Document, data []byte, contentType string) (*ExtractionResult, error) {
	// Load user's inventory for context
	inventory, err := BuildInventoryContext(ctx, p.db, doc.UserID)
	if err != nil {
		return nil, fmt.Errorf("failed to build inventory context: %w", err)
	}

	// Format inventory as text for the prompt
	inventoryText := FormatInventoryContext(inventory)

	// Build user prompt with inventory context
	userPrompt := fmt.Sprintf(AgentUserPrompt, inventoryText)

	// Get tools
	tools := GetInventoryTools()

	// Create tool executor
	executor := NewToolExecutor(p.db, doc.ID, doc.UserID)

	// Initial extraction with tools
	result, toolCalls, err := p.provider.ExtractWithTools(data, contentType, AgentSystemPrompt, userPrompt, tools)
	if err != nil {
		return nil, fmt.Errorf("extraction failed: %w", err)
	}

	// Process tool calls in a loop (max 10 iterations to prevent infinite loops)
	for i := 0; i < 10 && len(toolCalls) > 0; i++ {
		log.Printf("Document %s: executing %d tool calls (iteration %d)", doc.ID, len(toolCalls), i+1)

		// Execute each tool call
		var results []ToolResult
		for _, call := range toolCalls {
			log.Printf("  Executing tool: %s", call.Name)
			result := executor.Execute(ctx, call)
			log.Printf("  Result: %s (error: %v)", result.Content, result.IsError)
			results = append(results, result)
		}

		// Continue conversation with tool results
		result, toolCalls, err = p.provider.ContinueWithToolResults(results)
		if err != nil {
			return nil, fmt.Errorf("failed to continue after tool calls: %w", err)
		}
	}

	if result == nil {
		return nil, fmt.Errorf("no extraction result after tool processing")
	}

	return result, nil
}

// markFailed marks a document as failed and increments retry count.
func (p *Processor) markFailed(ctx context.Context, docID, userID uuid.UUID, step, errMsg string) {
	if err := p.db.MarkDocumentFailed(ctx, docID); err != nil {
		log.Printf("Failed to mark document %s as failed: %v", docID, err)
	}

	// Emit error event if we have a user ID
	if userID != uuid.Nil {
		p.emit(ctx, docID, userID, realtime.EventError, realtime.ErrorData{
			Error:     errMsg,
			Step:      step,
			Retriable: true,
		})
	}
}

// RetryFailed requeues failed documents for retry.
func (p *Processor) RetryFailed(ctx context.Context, maxRetries int) error {
	count, err := p.db.RequeueFailedDocuments(ctx, maxRetries)
	if err != nil {
		return err
	}
	if count > 0 {
		log.Printf("Requeued %d failed documents for retry", count)
	}
	return nil
}

// ProcessPending processes all pending documents.
// This can be called on startup to resume processing.
func (p *Processor) ProcessPending(ctx context.Context) error {
	docs, err := p.db.ListPendingDocuments(ctx, 100)
	if err != nil {
		return err
	}

	for _, doc := range docs {
		p.Enqueue(doc.ID)
	}

	log.Printf("Queued %d pending documents for extraction", len(docs))
	return nil
}

// StartPeriodicCheck starts a goroutine that periodically checks for pending documents.
func (p *Processor) StartPeriodicCheck(interval time.Duration) {
	go func() {
		ticker := time.NewTicker(interval)
		defer ticker.Stop()

		for {
			select {
			case <-p.ctx.Done():
				return
			case <-ticker.C:
				if err := p.ProcessPending(p.ctx); err != nil {
					log.Printf("Failed to process pending documents: %v", err)
				}
			}
		}
	}()
}
