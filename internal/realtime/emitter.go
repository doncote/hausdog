// Package realtime provides event emission for document processing updates.
package realtime

import (
	"context"
	"encoding/json"
	"log"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

// EventType represents the type of processing event.
type EventType string

const (
	EventStarted        EventType = "started"
	EventStep           EventType = "step"
	EventLLMChunk       EventType = "llm_chunk"
	EventExtractedField EventType = "extracted_field"
	EventToolCall       EventType = "tool_call"
	EventCompleted      EventType = "completed"
	EventError          EventType = "error"
)

// ChunkBuffer holds pending LLM chunks for a document.
type ChunkBuffer struct {
	UserID  uuid.UUID
	Chunks  []chunkData
	LastIdx int
}

type chunkData struct {
	Content string
	Index   int
	IsFinal bool
}

// EventEmitter handles emitting processing events to the database.
type EventEmitter struct {
	pool *pgxpool.Pool

	// Batching for LLM chunks
	chunkBuffers  map[uuid.UUID]*ChunkBuffer
	chunkMu       sync.Mutex
	flushInterval time.Duration
	maxBatchSize  int

	// Shutdown
	done chan struct{}
	wg   sync.WaitGroup
}

// NewEventEmitter creates a new event emitter.
func NewEventEmitter(pool *pgxpool.Pool) *EventEmitter {
	e := &EventEmitter{
		pool:          pool,
		chunkBuffers:  make(map[uuid.UUID]*ChunkBuffer),
		flushInterval: 50 * time.Millisecond,
		maxBatchSize:  10,
		done:          make(chan struct{}),
	}
	e.wg.Add(1)
	go e.flushLoop()
	return e
}

// Stop shuts down the emitter, flushing any pending chunks.
func (e *EventEmitter) Stop() {
	close(e.done)
	e.wg.Wait()
}

// Emit sends an event to the database.
func (e *EventEmitter) Emit(ctx context.Context, docID, userID uuid.UUID, eventType EventType, data any) error {
	eventData, err := json.Marshal(data)
	if err != nil {
		return err
	}

	_, err = e.pool.Exec(ctx, `
		INSERT INTO document_processing_events (document_id, user_id, event_type, event_data)
		VALUES ($1, $2, $3, $4)
	`, docID, userID, string(eventType), eventData)

	if err != nil {
		log.Printf("failed to emit event %s for doc %s: %v", eventType, docID, err)
	}
	return err
}

// EmitChunk buffers an LLM chunk for batched emission.
// Chunks are automatically flushed after flushInterval or when maxBatchSize is reached.
func (e *EventEmitter) EmitChunk(docID, userID uuid.UUID, content string, index int, isFinal bool) {
	e.chunkMu.Lock()
	defer e.chunkMu.Unlock()

	buf, ok := e.chunkBuffers[docID]
	if !ok {
		buf = &ChunkBuffer{
			UserID: userID,
			Chunks: make([]chunkData, 0, e.maxBatchSize),
		}
		e.chunkBuffers[docID] = buf
	}

	buf.Chunks = append(buf.Chunks, chunkData{
		Content: content,
		Index:   index,
		IsFinal: isFinal,
	})
	buf.LastIdx = index

	// Flush immediately if buffer is full or final chunk
	if len(buf.Chunks) >= e.maxBatchSize || isFinal {
		e.flushDocumentLocked(docID)
	}
}

// flushLoop periodically flushes chunk buffers.
func (e *EventEmitter) flushLoop() {
	defer e.wg.Done()

	ticker := time.NewTicker(e.flushInterval)
	defer ticker.Stop()

	for {
		select {
		case <-e.done:
			// Final flush on shutdown
			e.flushAll()
			return
		case <-ticker.C:
			e.flushAll()
		}
	}
}

// flushAll flushes all pending chunk buffers.
func (e *EventEmitter) flushAll() {
	e.chunkMu.Lock()
	defer e.chunkMu.Unlock()

	for docID := range e.chunkBuffers {
		e.flushDocumentLocked(docID)
	}
}

// flushDocumentLocked flushes chunks for a specific document.
// Must be called with chunkMu held.
func (e *EventEmitter) flushDocumentLocked(docID uuid.UUID) {
	buf, ok := e.chunkBuffers[docID]
	if !ok || len(buf.Chunks) == 0 {
		return
	}

	// Combine chunks into single content string
	var sb strings.Builder
	var isFinal bool
	startIdx := buf.Chunks[0].Index

	for _, c := range buf.Chunks {
		sb.WriteString(c.Content)
		if c.IsFinal {
			isFinal = true
		}
	}
	combined := sb.String()

	// Clear buffer
	chunks := buf.Chunks
	buf.Chunks = make([]chunkData, 0, e.maxBatchSize)

	// Delete buffer if final
	if isFinal {
		delete(e.chunkBuffers, docID)
	}

	// Emit combined chunk event
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	data := map[string]any{
		"content":  combined,
		"index":    startIdx,
		"count":    len(chunks),
		"is_final": isFinal,
	}

	if err := e.Emit(ctx, docID, buf.UserID, EventLLMChunk, data); err != nil {
		log.Printf("failed to flush chunks for doc %s: %v", docID, err)
	}
}

// Helper types for common event data structures

// StartedData is the payload for EventStarted.
type StartedData struct {
	Step string `json:"step"`
}

// StepData is the payload for EventStep.
type StepData struct {
	Step     string `json:"step"`
	Progress int    `json:"progress,omitempty"`
	Message  string `json:"message,omitempty"`
}

// ExtractedFieldData is the payload for EventExtractedField.
type ExtractedFieldData struct {
	Field      string  `json:"field"`
	Value      any     `json:"value"`
	Confidence float64 `json:"confidence,omitempty"`
}

// ToolCallData is the payload for EventToolCall.
type ToolCallData struct {
	Tool    string `json:"tool"`
	Args    any    `json:"args,omitempty"`
	Result  string `json:"result,omitempty"`
	IsError bool   `json:"is_error,omitempty"`
}

// CompletedData is the payload for EventCompleted.
type CompletedData struct {
	Result     any   `json:"result,omitempty"`
	DurationMs int64 `json:"duration_ms"`
}

// ErrorData is the payload for EventError.
type ErrorData struct {
	Error     string `json:"error"`
	Step      string `json:"step,omitempty"`
	Retriable bool   `json:"retriable"`
}
