package database

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// CreateComponentParams contains parameters for creating a component.
type CreateComponentParams struct {
	SystemID        uuid.UUID
	Name            string
	Manufacturer    *string
	Model           *string
	SerialNumber    *string
	InstallDate     *time.Time
	WarrantyExpires *time.Time
	Notes           *string
}

// CreateComponent creates a new component.
func (db *DB) CreateComponent(ctx context.Context, params CreateComponentParams) (*Component, error) {
	comp := &Component{
		ID:              uuid.New(),
		SystemID:        params.SystemID,
		Name:            params.Name,
		Manufacturer:    params.Manufacturer,
		Model:           params.Model,
		SerialNumber:    params.SerialNumber,
		InstallDate:     params.InstallDate,
		WarrantyExpires: params.WarrantyExpires,
		Notes:           params.Notes,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	_, err := db.Pool.Exec(ctx, `
		INSERT INTO components (
			id, system_id, name, manufacturer, model,
			serial_number, install_date, warranty_expires, notes, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
	`, comp.ID, comp.SystemID, comp.Name, comp.Manufacturer, comp.Model,
		comp.SerialNumber, comp.InstallDate, comp.WarrantyExpires, comp.Notes, comp.CreatedAt, comp.UpdatedAt)

	if err != nil {
		return nil, fmt.Errorf("failed to create component: %w", err)
	}

	return comp, nil
}

// GetComponent retrieves a component by ID.
func (db *DB) GetComponent(ctx context.Context, id uuid.UUID) (*Component, error) {
	comp := &Component{}
	err := db.Pool.QueryRow(ctx, `
		SELECT id, system_id, name, manufacturer, model,
			serial_number, install_date, warranty_expires, notes, created_at, updated_at
		FROM components WHERE id = $1
	`, id).Scan(
		&comp.ID, &comp.SystemID, &comp.Name, &comp.Manufacturer, &comp.Model,
		&comp.SerialNumber, &comp.InstallDate, &comp.WarrantyExpires, &comp.Notes, &comp.CreatedAt, &comp.UpdatedAt,
	)

	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get component: %w", err)
	}

	return comp, nil
}

// ListComponentsBySystem retrieves all components for a system.
func (db *DB) ListComponentsBySystem(ctx context.Context, systemID uuid.UUID) ([]*Component, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT id, system_id, name, manufacturer, model,
			serial_number, install_date, warranty_expires, notes, created_at, updated_at
		FROM components
		WHERE system_id = $1
		ORDER BY name ASC
	`, systemID)

	if err != nil {
		return nil, fmt.Errorf("failed to list components: %w", err)
	}
	defer rows.Close()

	return scanComponents(rows)
}

// CountComponentsBySystem returns the count of components for a system.
func (db *DB) CountComponentsBySystem(ctx context.Context, systemID uuid.UUID) (int, error) {
	var count int
	err := db.Pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM components WHERE system_id = $1
	`, systemID).Scan(&count)
	if err != nil {
		return 0, fmt.Errorf("failed to count components: %w", err)
	}
	return count, nil
}

// UpdateComponent updates a component.
func (db *DB) UpdateComponent(ctx context.Context, id uuid.UUID, params CreateComponentParams) error {
	_, err := db.Pool.Exec(ctx, `
		UPDATE components SET
			name = $2, manufacturer = $3, model = $4, serial_number = $5,
			install_date = $6, warranty_expires = $7, notes = $8, updated_at = $9
		WHERE id = $1
	`, id, params.Name, params.Manufacturer, params.Model, params.SerialNumber,
		params.InstallDate, params.WarrantyExpires, params.Notes, time.Now())

	if err != nil {
		return fmt.Errorf("failed to update component: %w", err)
	}

	return nil
}

// DeleteComponent deletes a component.
func (db *DB) DeleteComponent(ctx context.Context, id uuid.UUID) error {
	_, err := db.Pool.Exec(ctx, `DELETE FROM components WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("failed to delete component: %w", err)
	}
	return nil
}

// scanComponents scans rows into components.
func scanComponents(rows pgx.Rows) ([]*Component, error) {
	var components []*Component
	for rows.Next() {
		comp := &Component{}
		err := rows.Scan(
			&comp.ID, &comp.SystemID, &comp.Name, &comp.Manufacturer, &comp.Model,
			&comp.SerialNumber, &comp.InstallDate, &comp.WarrantyExpires, &comp.Notes, &comp.CreatedAt, &comp.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan component: %w", err)
		}
		components = append(components, comp)
	}
	return components, nil
}
