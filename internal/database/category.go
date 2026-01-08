package database

import (
	"context"
	"fmt"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5"
)

// GetCategory retrieves a category by ID.
func (db *DB) GetCategory(ctx context.Context, id uuid.UUID) (*Category, error) {
	cat := &Category{}
	err := db.Pool.QueryRow(ctx, `
		SELECT id, name, icon, sort_order
		FROM categories WHERE id = $1
	`, id).Scan(&cat.ID, &cat.Name, &cat.Icon, &cat.SortOrder)

	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get category: %w", err)
	}

	return cat, nil
}

// GetCategoryByName retrieves a category by name.
func (db *DB) GetCategoryByName(ctx context.Context, name string) (*Category, error) {
	cat := &Category{}
	err := db.Pool.QueryRow(ctx, `
		SELECT id, name, icon, sort_order
		FROM categories WHERE name = $1
	`, name).Scan(&cat.ID, &cat.Name, &cat.Icon, &cat.SortOrder)

	if err == pgx.ErrNoRows {
		return nil, nil
	}
	if err != nil {
		return nil, fmt.Errorf("failed to get category by name: %w", err)
	}

	return cat, nil
}

// ListCategories retrieves all categories.
func (db *DB) ListCategories(ctx context.Context) ([]*Category, error) {
	rows, err := db.Pool.Query(ctx, `
		SELECT id, name, icon, sort_order
		FROM categories
		ORDER BY sort_order ASC
	`)

	if err != nil {
		return nil, fmt.Errorf("failed to list categories: %w", err)
	}
	defer rows.Close()

	var cats []*Category
	for rows.Next() {
		cat := &Category{}
		err := rows.Scan(&cat.ID, &cat.Name, &cat.Icon, &cat.SortOrder)
		if err != nil {
			return nil, fmt.Errorf("failed to scan category: %w", err)
		}
		cats = append(cats, cat)
	}

	return cats, nil
}
