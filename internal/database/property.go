package database

import (
	"context"
	"fmt"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// CreatePropertyParams contains parameters for creating a property.
type CreatePropertyParams struct {
	UserID  uuid.UUID
	Name    string
	Address *string
}

// CreateProperty creates a new property.
func (db *DB) CreateProperty(ctx context.Context, params CreatePropertyParams) (*Property, error) {
	prop := &Property{
		ID:        uuid.New(),
		UserID:    params.UserID,
		Name:      params.Name,
		Address:   params.Address,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
	}

	_, err := db.Pool.Exec(ctx, `
		INSERT INTO properties (id, user_id, name, address, created_at, updated_at)
		VALUES ($1, $2, $3, $4, $5, $6)
	`, prop.ID, prop.UserID, prop.Name, prop.Address, prop.CreatedAt, prop.UpdatedAt)

	if err != nil {
		return nil, fmt.Errorf("failed to create property: %w", err)
	}

	return prop, nil
}

// GetProperty retrieves a property by ID.
func (db *DB) GetProperty(ctx context.Context, id uuid.UUID) (*Property, error) {
	prop := &Property{}
	err := db.Pool.QueryRow(ctx, `
		SELECT id, user_id, name, address, created_at, updated_at
		FROM properties WHERE id = $1
	`, id).Scan(&prop.ID, &prop.UserID, &prop.Name, &prop.Address, &prop.CreatedAt, &prop.UpdatedAt)

	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get property: %w", err)
	}

	return prop, nil
}

// ListPropertiesByUser retrieves all properties for a user.
func (db *DB) ListPropertiesByUser(ctx context.Context, userID uuid.UUID) ([]*Property, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT id, user_id, name, address, created_at, updated_at
		FROM properties
		WHERE user_id = $1
		ORDER BY name ASC
	`, userID)

	if err != nil {
		return nil, fmt.Errorf("failed to list properties: %w", err)
	}
	defer rows.Close()

	var props []*Property
	for rows.Next() {
		prop := &Property{}
		err := rows.Scan(&prop.ID, &prop.UserID, &prop.Name, &prop.Address, &prop.CreatedAt, &prop.UpdatedAt)
		if err != nil {
			return nil, fmt.Errorf("failed to scan property: %w", err)
		}
		props = append(props, prop)
	}

	return props, nil
}

// UpdateProperty updates a property.
func (db *DB) UpdateProperty(ctx context.Context, id uuid.UUID, name string, address *string) error {
	_, err := db.Pool.Exec(ctx, `
		UPDATE properties SET name = $2, address = $3, updated_at = $4 WHERE id = $1
	`, id, name, address, time.Now())

	if err != nil {
		return fmt.Errorf("failed to update property: %w", err)
	}

	return nil
}

// DeleteProperty deletes a property.
func (db *DB) DeleteProperty(ctx context.Context, id uuid.UUID) error {
	_, err := db.Pool.Exec(ctx, `DELETE FROM properties WHERE id = $1`, id)
	if err != nil {
		return fmt.Errorf("failed to delete property: %w", err)
	}
	return nil
}
