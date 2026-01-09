package database

import (
	"context"
	"encoding/json"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// CreateDocumentParams contains parameters for creating a document.
type CreateDocumentParams struct {
	UserID      uuid.UUID
	PropertyID  *uuid.UUID
	SystemID    *uuid.UUID
	ComponentID *uuid.UUID
	Filename    string
	StoragePath string
	ContentType string
	SizeBytes   int64
}

// CreateDocument creates a new document record.
func (db *DB) CreateDocument(ctx context.Context, params CreateDocumentParams) (*Document, error) {
	doc := &Document{
		ID:               uuid.New(),
		UserID:           params.UserID,
		PropertyID:       params.PropertyID,
		SystemID:         params.SystemID,
		ComponentID:      params.ComponentID,
		Filename:         params.Filename,
		StoragePath:      params.StoragePath,
		ContentType:      params.ContentType,
		SizeBytes:        params.SizeBytes,
		ProcessingStatus: ProcessingStatusPending,
		CreatedAt:        time.Now(),
		UpdatedAt:        time.Now(),
	}

	_, err := db.Pool.Exec(ctx, `
		INSERT INTO documents (
			id, user_id, property_id, system_id, component_id,
			filename, storage_path, content_type, size_bytes,
			processing_status, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	`, doc.ID, doc.UserID, doc.PropertyID, doc.SystemID, doc.ComponentID,
		doc.Filename, doc.StoragePath, doc.ContentType, doc.SizeBytes,
		doc.ProcessingStatus, doc.CreatedAt, doc.UpdatedAt)

	if err != nil {
		return nil, fmt.Errorf("failed to create document: %w", err)
	}

	return doc, nil
}

// GetDocument retrieves a document by ID.
func (db *DB) GetDocument(ctx context.Context, id uuid.UUID) (*Document, error) {
	doc := &Document{}
	err := db.Pool.QueryRow(ctx, `
		SELECT id, user_id, property_id, system_id, component_id,
			filename, storage_path, content_type, size_bytes,
			extracted_data, processing_status, created_at, updated_at
		FROM documents WHERE id = $1
	`, id).Scan(
		&doc.ID, &doc.UserID, &doc.PropertyID, &doc.SystemID, &doc.ComponentID,
		&doc.Filename, &doc.StoragePath, &doc.ContentType, &doc.SizeBytes,
		&doc.ExtractedData, &doc.ProcessingStatus, &doc.CreatedAt, &doc.UpdatedAt,
	)

	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get document: %w", err)
	}

	return doc, nil
}

// GetDocumentByUser retrieves a document by ID, ensuring it belongs to the user.
func (db *DB) GetDocumentByUser(ctx context.Context, id, userID uuid.UUID) (*Document, error) {
	doc := &Document{}
	err := db.Pool.QueryRow(ctx, `
		SELECT id, user_id, property_id, system_id, component_id,
			filename, storage_path, content_type, size_bytes,
			extracted_data, processing_status, created_at, updated_at
		FROM documents WHERE id = $1 AND user_id = $2
	`, id, userID).Scan(
		&doc.ID, &doc.UserID, &doc.PropertyID, &doc.SystemID, &doc.ComponentID,
		&doc.Filename, &doc.StoragePath, &doc.ContentType, &doc.SizeBytes,
		&doc.ExtractedData, &doc.ProcessingStatus, &doc.CreatedAt, &doc.UpdatedAt,
	)

	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get document: %w", err)
	}

	return doc, nil
}

// UpdateDocumentStatus updates a document's processing status.
func (db *DB) UpdateDocumentStatus(ctx context.Context, id uuid.UUID, status string) error {
	_, err := db.Pool.Exec(ctx, `
		UPDATE documents SET processing_status = $2, updated_at = $3 WHERE id = $1
	`, id, status, time.Now())

	if err != nil {
		return fmt.Errorf("failed to update document status: %w", err)
	}

	return nil
}

// UpdateDocumentExtraction updates a document's extracted data and sets status to complete.
func (db *DB) UpdateDocumentExtraction(ctx context.Context, id uuid.UUID, extractedData json.RawMessage) error {
	now := time.Now()
	_, err := db.Pool.Exec(ctx, `
		UPDATE documents
		SET extracted_data = $2, processing_status = $3, processed_at = $4, updated_at = $4
		WHERE id = $1
	`, id, extractedData, ProcessingStatusComplete, now)

	if err != nil {
		return fmt.Errorf("failed to update document extraction: %w", err)
	}

	return nil
}

// MarkDocumentFailed marks a document as failed and increments retry count.
func (db *DB) MarkDocumentFailed(ctx context.Context, id uuid.UUID) error {
	_, err := db.Pool.Exec(ctx, `
		UPDATE documents
		SET processing_status = $2, retry_count = retry_count + 1, updated_at = $3
		WHERE id = $1
	`, id, ProcessingStatusFailed, time.Now())

	if err != nil {
		return fmt.Errorf("failed to mark document as failed: %w", err)
	}

	return nil
}

// RequeueFailedDocuments requeues failed documents for retry (up to maxRetries).
func (db *DB) RequeueFailedDocuments(ctx context.Context, maxRetries int) (int64, error) {
	result, err := db.Pool.Exec(ctx, `
		UPDATE documents
		SET processing_status = $1, updated_at = $3
		WHERE processing_status = $2 AND retry_count < $4
	`, ProcessingStatusPending, ProcessingStatusFailed, time.Now(), maxRetries)

	if err != nil {
		return 0, fmt.Errorf("failed to requeue documents: %w", err)
	}

	return result.RowsAffected(), nil
}

// ListDocumentsByUser retrieves all documents for a user.
func (db *DB) ListDocumentsByUser(ctx context.Context, userID uuid.UUID, limit, offset int) ([]*Document, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT id, user_id, property_id, system_id, component_id,
			filename, storage_path, content_type, size_bytes,
			extracted_data, processing_status, created_at, updated_at
		FROM documents
		WHERE user_id = $1
		ORDER BY created_at DESC
		LIMIT $2 OFFSET $3
	`, userID, limit, offset)

	if err != nil {
		return nil, fmt.Errorf("failed to list documents: %w", err)
	}
	defer rows.Close()

	var docs []*Document
	for rows.Next() {
		doc := &Document{}
		err := rows.Scan(
			&doc.ID, &doc.UserID, &doc.PropertyID, &doc.SystemID, &doc.ComponentID,
			&doc.Filename, &doc.StoragePath, &doc.ContentType, &doc.SizeBytes,
			&doc.ExtractedData, &doc.ProcessingStatus, &doc.CreatedAt, &doc.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan document: %w", err)
		}
		docs = append(docs, doc)
	}

	return docs, nil
}

// ListPendingDocuments retrieves documents waiting to be processed.
func (db *DB) ListPendingDocuments(ctx context.Context, limit int) ([]*Document, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT id, user_id, property_id, system_id, component_id,
			filename, storage_path, content_type, size_bytes,
			extracted_data, processing_status, created_at, updated_at
		FROM documents
		WHERE processing_status = $1
		ORDER BY created_at ASC
		LIMIT $2
	`, ProcessingStatusPending, limit)

	if err != nil {
		return nil, fmt.Errorf("failed to list pending documents: %w", err)
	}
	defer rows.Close()

	var docs []*Document
	for rows.Next() {
		doc := &Document{}
		err := rows.Scan(
			&doc.ID, &doc.UserID, &doc.PropertyID, &doc.SystemID, &doc.ComponentID,
			&doc.Filename, &doc.StoragePath, &doc.ContentType, &doc.SizeBytes,
			&doc.ExtractedData, &doc.ProcessingStatus, &doc.CreatedAt, &doc.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan document: %w", err)
		}
		docs = append(docs, doc)
	}

	return docs, nil
}

// CountDocumentsByStatus returns counts of documents by status for a user.
func (db *DB) CountDocumentsByStatus(ctx context.Context, userID uuid.UUID) (map[string]int, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT processing_status, COUNT(*) as count
		FROM documents
		WHERE user_id = $1
		GROUP BY processing_status
	`, userID)

	if err != nil {
		return nil, fmt.Errorf("failed to count documents: %w", err)
	}
	defer rows.Close()

	counts := make(map[string]int)
	for rows.Next() {
		var status string
		var count int
		if err := rows.Scan(&status, &count); err != nil {
			return nil, fmt.Errorf("failed to scan count: %w", err)
		}
		counts[status] = count
	}

	return counts, nil
}

// DeleteDocument deletes a document by ID.
func (db *DB) DeleteDocument(ctx context.Context, id uuid.UUID) error {
	_, err := db.Pool.Exec(ctx, `DELETE FROM documents WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("failed to delete document: %w", err)
	}
	return nil
}

// ListDocumentsByStatus retrieves documents by status for a user.
func (db *DB) ListDocumentsByStatus(ctx context.Context, userID uuid.UUID, status string, limit, offset int) ([]*Document, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT id, user_id, property_id, system_id, component_id,
			filename, storage_path, content_type, size_bytes,
			extracted_data, processing_status, created_at, updated_at
		FROM documents
		WHERE user_id = $1 AND processing_status = $2
		ORDER BY created_at DESC
		LIMIT $3 OFFSET $4
	`, userID, status, limit, offset)

	if err != nil {
		return nil, fmt.Errorf("failed to list documents by status: %w", err)
	}
	defer rows.Close()

	var docs []*Document
	for rows.Next() {
		doc := &Document{}
		err := rows.Scan(
			&doc.ID, &doc.UserID, &doc.PropertyID, &doc.SystemID, &doc.ComponentID,
			&doc.Filename, &doc.StoragePath, &doc.ContentType, &doc.SizeBytes,
			&doc.ExtractedData, &doc.ProcessingStatus, &doc.CreatedAt, &doc.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan document: %w", err)
		}
		docs = append(docs, doc)
	}

	return docs, nil
}

// LinkDocumentToSystem links a document to a system.
func (db *DB) LinkDocumentToSystem(ctx context.Context, docID, systemID uuid.UUID) error {
	_, err := db.Pool.Exec(ctx, `
		UPDATE documents SET system_id = $2, updated_at = $3 WHERE id = $1
	`, docID, systemID, time.Now())

	if err != nil {
		return fmt.Errorf("failed to link document to system: %w", err)
	}

	return nil
}

// ListDocumentsBySystem retrieves documents linked to a system.
func (db *DB) ListDocumentsBySystem(ctx context.Context, systemID uuid.UUID) ([]*Document, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT id, user_id, property_id, system_id, component_id,
			filename, storage_path, content_type, size_bytes,
			extracted_data, processing_status, created_at, updated_at
		FROM documents
		WHERE system_id = $1
		ORDER BY created_at DESC
	`, systemID)

	if err != nil {
		return nil, fmt.Errorf("failed to list documents by system: %w", err)
	}
	defer rows.Close()

	var docs []*Document
	for rows.Next() {
		doc := &Document{}
		err := rows.Scan(
			&doc.ID, &doc.UserID, &doc.PropertyID, &doc.SystemID, &doc.ComponentID,
			&doc.Filename, &doc.StoragePath, &doc.ContentType, &doc.SizeBytes,
			&doc.ExtractedData, &doc.ProcessingStatus, &doc.CreatedAt, &doc.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan document: %w", err)
		}
		docs = append(docs, doc)
	}

	return docs, nil
}

// UpdateDocumentLinks updates the property and system links for a document.
func (db *DB) UpdateDocumentLinks(ctx context.Context, id uuid.UUID, propertyID, systemID *uuid.UUID) error {
	_, err := db.Pool.Exec(ctx, `
		UPDATE documents SET property_id = $2, system_id = $3, updated_at = $4 WHERE id = $1
	`, id, propertyID, systemID, time.Now())
	if err != nil {
		return fmt.Errorf("failed to update document links: %w", err)
	}
	return nil
}

// UpdateDocumentComponentLink updates the component link for a document.
func (db *DB) UpdateDocumentComponentLink(ctx context.Context, id uuid.UUID, componentID *uuid.UUID) error {
	_, err := db.Pool.Exec(ctx, `
		UPDATE documents SET component_id = $2, updated_at = $3 WHERE id = $1
	`, id, componentID, time.Now())
	if err != nil {
		return fmt.Errorf("failed to update document component link: %w", err)
	}
	return nil
}

// UpdateDocumentAllLinks updates property, system, and component links for a document.
func (db *DB) UpdateDocumentAllLinks(ctx context.Context, id uuid.UUID, propertyID, systemID, componentID *uuid.UUID) error {
	_, err := db.Pool.Exec(ctx, `
		UPDATE documents SET property_id = $2, system_id = $3, component_id = $4, updated_at = $5 WHERE id = $1
	`, id, propertyID, systemID, componentID, time.Now())
	if err != nil {
		return fmt.Errorf("failed to update document links: %w", err)
	}
	return nil
}

// ListDocumentsByComponent retrieves documents linked to a component.
func (db *DB) ListDocumentsByComponent(ctx context.Context, componentID uuid.UUID) ([]*Document, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT id, user_id, property_id, system_id, component_id,
			filename, storage_path, content_type, size_bytes,
			extracted_data, processing_status, created_at, updated_at
		FROM documents
		WHERE component_id = $1
		ORDER BY created_at DESC
	`, componentID)

	if err != nil {
		return nil, fmt.Errorf("failed to list documents by component: %w", err)
	}
	defer rows.Close()

	var docs []*Document
	for rows.Next() {
		doc := &Document{}
		err := rows.Scan(
			&doc.ID, &doc.UserID, &doc.PropertyID, &doc.SystemID, &doc.ComponentID,
			&doc.Filename, &doc.StoragePath, &doc.ContentType, &doc.SizeBytes,
			&doc.ExtractedData, &doc.ProcessingStatus, &doc.CreatedAt, &doc.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan document: %w", err)
		}
		docs = append(docs, doc)
	}

	return docs, nil
}
