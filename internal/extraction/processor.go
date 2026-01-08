package extraction

import (
	"context"
	"encoding/json"
	"io"
	"log"
	"sync"
	"time"

	"github.com/don/hausdog/internal/database"
	"github.com/don/hausdog/internal/storage"
	"github.com/google/uuid"
)

// Processor handles async document extraction.
type Processor struct {
	db      *database.DB
	storage *storage.Client
	claude  *Client

	// Processing queue
	queue chan uuid.UUID
	wg    sync.WaitGroup

	// Shutdown
	ctx    context.Context
	cancel context.CancelFunc
}

// NewProcessor creates a new extraction processor.
func NewProcessor(db *database.DB, storage *storage.Client, claudeAPIKey string) *Processor {
	ctx, cancel := context.WithCancel(context.Background())

	p := &Processor{
		db:      db,
		storage: storage,
		claude:  NewClient(claudeAPIKey),
		queue:   make(chan uuid.UUID, 100),
		ctx:     ctx,
		cancel:  cancel,
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
		p.markFailed(ctx, docID)
		return
	}

	if doc == nil {
		log.Printf("Document %s not found", docID)
		return
	}

	// Download from storage
	reader, contentType, err := p.storage.Download(doc.StoragePath)
	if err != nil {
		log.Printf("Failed to download document %s: %v", docID, err)
		p.markFailed(ctx, docID)
		return
	}
	defer reader.Close()

	data, err := io.ReadAll(reader)
	if err != nil {
		log.Printf("Failed to read document %s: %v", docID, err)
		p.markFailed(ctx, docID)
		return
	}

	// Use stored content type if available
	if doc.ContentType != "" {
		contentType = doc.ContentType
	}

	// Extract data using Claude
	result, err := p.claude.Extract(data, contentType, SystemPrompt, UserPrompt)
	if err != nil {
		log.Printf("Failed to extract from document %s: %v", docID, err)
		p.markFailed(ctx, docID)
		return
	}

	// Save extraction result
	resultJSON, err := json.Marshal(result)
	if err != nil {
		log.Printf("Failed to marshal extraction result: %v", err)
		p.markFailed(ctx, docID)
		return
	}

	if err := p.db.UpdateDocumentExtraction(ctx, docID, resultJSON); err != nil {
		log.Printf("Failed to save extraction result: %v", err)
		p.markFailed(ctx, docID)
		return
	}

	log.Printf("Successfully extracted document %s (type: %s, confidence: %.2f)",
		docID, result.DocumentType, result.Confidence)
}

// markFailed marks a document as failed and increments retry count.
func (p *Processor) markFailed(ctx context.Context, docID uuid.UUID) {
	if err := p.db.MarkDocumentFailed(ctx, docID); err != nil {
		log.Printf("Failed to mark document %s as failed: %v", docID, err)
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
