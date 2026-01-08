package database

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// CreateSystemParams contains parameters for creating a system.
type CreateSystemParams struct {
	PropertyID      uuid.UUID
	CategoryID      uuid.UUID
	Name            string
	Manufacturer    *string
	Model           *string
	SerialNumber    *string
	InstallDate     *time.Time
	WarrantyExpires *time.Time
	Notes           *string
}

// CreateSystem creates a new system.
func (db *DB) CreateSystem(ctx context.Context, params CreateSystemParams) (*System, error) {
	sys := &System{
		ID:              uuid.New(),
		PropertyID:      params.PropertyID,
		CategoryID:      params.CategoryID,
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
		INSERT INTO systems (
			id, property_id, category_id, name, manufacturer, model,
			serial_number, install_date, warranty_expires, notes, created_at, updated_at
		) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
	`, sys.ID, sys.PropertyID, sys.CategoryID, sys.Name, sys.Manufacturer, sys.Model,
		sys.SerialNumber, sys.InstallDate, sys.WarrantyExpires, sys.Notes, sys.CreatedAt, sys.UpdatedAt)

	if err != nil {
		return nil, fmt.Errorf("failed to create system: %w", err)
	}

	return sys, nil
}

// GetSystem retrieves a system by ID.
func (db *DB) GetSystem(ctx context.Context, id uuid.UUID) (*System, error) {
	sys := &System{}
	err := db.Pool.QueryRow(ctx, `
		SELECT id, property_id, category_id, name, manufacturer, model,
			serial_number, install_date, warranty_expires, notes, created_at, updated_at
		FROM systems WHERE id = $1
	`, id).Scan(
		&sys.ID, &sys.PropertyID, &sys.CategoryID, &sys.Name, &sys.Manufacturer, &sys.Model,
		&sys.SerialNumber, &sys.InstallDate, &sys.WarrantyExpires, &sys.Notes, &sys.CreatedAt, &sys.UpdatedAt,
	)

	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get system: %w", err)
	}

	return sys, nil
}

// ListSystemsByProperty retrieves all systems for a property.
func (db *DB) ListSystemsByProperty(ctx context.Context, propertyID uuid.UUID) ([]*System, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT id, property_id, category_id, name, manufacturer, model,
			serial_number, install_date, warranty_expires, notes, created_at, updated_at
		FROM systems
		WHERE property_id = $1
		ORDER BY name ASC
	`, propertyID)

	if err != nil {
		return nil, fmt.Errorf("failed to list systems: %w", err)
	}
	defer rows.Close()

	return scanSystems(rows)
}

// ListSystemsByCategory retrieves systems by category for a user's properties.
func (db *DB) ListSystemsByCategory(ctx context.Context, userID, categoryID uuid.UUID) ([]*System, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT s.id, s.property_id, s.category_id, s.name, s.manufacturer, s.model,
			s.serial_number, s.install_date, s.warranty_expires, s.notes, s.created_at, s.updated_at
		FROM systems s
		JOIN properties p ON s.property_id = p.id
		WHERE p.user_id = $1 AND s.category_id = $2
		ORDER BY s.name ASC
	`, userID, categoryID)

	if err != nil {
		return nil, fmt.Errorf("failed to list systems by category: %w", err)
	}
	defer rows.Close()

	return scanSystems(rows)
}

// ListSystemsByUser retrieves all systems for a user across all properties.
func (db *DB) ListSystemsByUser(ctx context.Context, userID uuid.UUID) ([]*System, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT s.id, s.property_id, s.category_id, s.name, s.manufacturer, s.model,
			s.serial_number, s.install_date, s.warranty_expires, s.notes, s.created_at, s.updated_at
		FROM systems s
		JOIN properties p ON s.property_id = p.id
		WHERE p.user_id = $1
		ORDER BY s.name ASC
	`, userID)

	if err != nil {
		return nil, fmt.Errorf("failed to list systems: %w", err)
	}
	defer rows.Close()

	return scanSystems(rows)
}

// CountSystemsByCategory returns counts of systems by category for a user.
func (db *DB) CountSystemsByCategory(ctx context.Context, userID uuid.UUID) (map[string]int, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT s.category_id::text, COUNT(*) as count
		FROM systems s
		JOIN properties p ON s.property_id = p.id
		WHERE p.user_id = $1
		GROUP BY s.category_id
	`, userID)

	if err != nil {
		return nil, fmt.Errorf("failed to count systems: %w", err)
	}
	defer rows.Close()

	counts := make(map[string]int)
	for rows.Next() {
		var categoryID string
		var count int
		if err := rows.Scan(&categoryID, &count); err != nil {
			return nil, fmt.Errorf("failed to scan count: %w", err)
		}
		counts[categoryID] = count
	}

	return counts, nil
}

// UpdateSystem updates a system.
func (db *DB) UpdateSystem(ctx context.Context, id uuid.UUID, params CreateSystemParams) error {
	_, err := db.Pool.Exec(ctx, `
		UPDATE systems SET
			name = $2, manufacturer = $3, model = $4, serial_number = $5,
			install_date = $6, warranty_expires = $7, notes = $8, updated_at = $9
		WHERE id = $1
	`, id, params.Name, params.Manufacturer, params.Model, params.SerialNumber,
		params.InstallDate, params.WarrantyExpires, params.Notes, time.Now())

	if err != nil {
		return fmt.Errorf("failed to update system: %w", err)
	}

	return nil
}

// DeleteSystem deletes a system.
func (db *DB) DeleteSystem(ctx context.Context, id uuid.UUID) error {
	_, err := db.Pool.Exec(ctx, `DELETE FROM systems WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("failed to delete system: %w", err)
	}
	return nil
}

// scanSystems scans rows into systems.
func scanSystems(rows pgx.Rows) ([]*System, error) {
	var systems []*System
	for rows.Next() {
		sys := &System{}
		err := rows.Scan(
			&sys.ID, &sys.PropertyID, &sys.CategoryID, &sys.Name, &sys.Manufacturer, &sys.Model,
			&sys.SerialNumber, &sys.InstallDate, &sys.WarrantyExpires, &sys.Notes, &sys.CreatedAt, &sys.UpdatedAt,
		)
		if err != nil {
			return nil, fmt.Errorf("failed to scan system: %w", err)
		}
		systems = append(systems, sys)
	}
	return systems, nil
}
