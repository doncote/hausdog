package database

import (
	"encoding/json"
	"time"

	"github.com/google/uuid"
)

// Property represents a house or building.
type Property struct {
	ID        uuid.UUID `json:"id"`
	UserID    uuid.UUID `json:"user_id"`
	Name      string    `json:"name"`
	Address   *string   `json:"address,omitempty"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`
}

// Category represents a system category (HVAC, Plumbing, etc.).
type Category struct {
	ID        uuid.UUID `json:"id"`
	Name      string    `json:"name"`
	Icon      *string   `json:"icon,omitempty"`
	SortOrder int       `json:"sort_order"`
}

// System represents a specific system in a property.
type System struct {
	ID              uuid.UUID  `json:"id"`
	PropertyID      uuid.UUID  `json:"property_id"`
	CategoryID      uuid.UUID  `json:"category_id"`
	Name            string     `json:"name"`
	Manufacturer    *string    `json:"manufacturer,omitempty"`
	Model           *string    `json:"model,omitempty"`
	SerialNumber    *string    `json:"serial_number,omitempty"`
	InstallDate     *time.Time `json:"install_date,omitempty"`
	WarrantyExpires *time.Time `json:"warranty_expires,omitempty"`
	Notes           *string    `json:"notes,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

// Component represents a part of a system.
type Component struct {
	ID              uuid.UUID  `json:"id"`
	SystemID        uuid.UUID  `json:"system_id"`
	Name            string     `json:"name"`
	Manufacturer    *string    `json:"manufacturer,omitempty"`
	Model           *string    `json:"model,omitempty"`
	SerialNumber    *string    `json:"serial_number,omitempty"`
	InstallDate     *time.Time `json:"install_date,omitempty"`
	WarrantyExpires *time.Time `json:"warranty_expires,omitempty"`
	Notes           *string    `json:"notes,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
}

// Document represents an uploaded file.
type Document struct {
	ID               uuid.UUID        `json:"id"`
	UserID           uuid.UUID        `json:"user_id"`
	PropertyID       *uuid.UUID       `json:"property_id,omitempty"`
	SystemID         *uuid.UUID       `json:"system_id,omitempty"`
	ComponentID      *uuid.UUID       `json:"component_id,omitempty"`
	Filename         string           `json:"filename"`
	StoragePath      string           `json:"storage_path"`
	ContentType      string           `json:"content_type"`
	SizeBytes        int64            `json:"size_bytes"`
	ExtractedData    *json.RawMessage `json:"extracted_data,omitempty"`
	ProcessingStatus string           `json:"processing_status"`
	RetryCount       int              `json:"retry_count"`
	ProcessedAt      *time.Time       `json:"processed_at,omitempty"`
	CreatedAt        time.Time        `json:"created_at"`
	UpdatedAt        time.Time        `json:"updated_at"`
}

// ProcessingStatus constants for documents.
const (
	ProcessingStatusPending    = "pending"
	ProcessingStatusProcessing = "processing"
	ProcessingStatusComplete   = "complete"
	ProcessingStatusFailed     = "failed"
)

// ServiceRecord represents a maintenance or service event.
type ServiceRecord struct {
	ID          uuid.UUID  `json:"id"`
	SystemID    *uuid.UUID `json:"system_id,omitempty"`
	ComponentID *uuid.UUID `json:"component_id,omitempty"`
	DocumentID  *uuid.UUID `json:"document_id,omitempty"`
	ServiceDate time.Time  `json:"service_date"`
	ServiceType string     `json:"service_type"`
	Provider    *string    `json:"provider,omitempty"`
	Cost        *float64   `json:"cost,omitempty"`
	Notes       *string    `json:"notes,omitempty"`
	CreatedAt   time.Time  `json:"created_at"`
	UpdatedAt   time.Time  `json:"updated_at"`
}
