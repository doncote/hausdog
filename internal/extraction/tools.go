package extraction

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/don/hausdog/internal/database"
	"github.com/google/uuid"
)

// parseFlexibleDate parses dates in multiple formats.
func parseFlexibleDate(s string) (time.Time, error) {
	formats := []string{
		time.RFC3339,
		"2006-01-02",
		"2006-01-02T15:04:05",
		"01/02/2006",
		"Jan 2, 2006",
		"January 2, 2006",
	}
	for _, format := range formats {
		if t, err := time.Parse(format, s); err == nil {
			return t, nil
		}
	}
	return time.Time{}, fmt.Errorf("unable to parse date: %s", s)
}

// Tool represents an LLM tool definition (provider-agnostic).
type Tool struct {
	Name        string           `json:"name"`
	Description string           `json:"description"`
	Parameters  []ToolParameter  `json:"parameters"`
}

// ToolParameter represents a parameter for a tool.
type ToolParameter struct {
	Name        string   `json:"name"`
	Type        string   `json:"type"` // string, number, boolean
	Description string   `json:"description"`
	Required    bool     `json:"required"`
	Enum        []string `json:"enum,omitempty"` // For constrained string values
}

// ToolCall represents a tool invocation from the LLM.
type ToolCall struct {
	ID        string            `json:"id"`
	Name      string            `json:"name"`
	Arguments map[string]any    `json:"arguments"`
}

// ToolResult represents the result of executing a tool.
type ToolResult struct {
	ToolCallID string `json:"tool_call_id"`
	Content    string `json:"content"`
	IsError    bool   `json:"is_error"`
}

// InventoryContext contains the user's home inventory for LLM context.
type InventoryContext struct {
	Properties []*PropertyWithSystems `json:"properties"`
	Categories []*database.Category   `json:"categories"`
}

// PropertyWithSystems contains a property and its systems/components.
type PropertyWithSystems struct {
	Property   *database.Property    `json:"property"`
	Systems    []*SystemWithComponents `json:"systems"`
}

// SystemWithComponents contains a system and its components.
type SystemWithComponents struct {
	System     *database.System      `json:"system"`
	Category   *database.Category    `json:"category"`
	Components []*database.Component `json:"components"`
}

// GetInventoryTools returns the tool definitions for inventory management.
func GetInventoryTools() []Tool {
	return []Tool{
		{
			Name:        "create_system",
			Description: "Create a new system (e.g., HVAC unit, water heater, appliance) under a property. Use this when the document shows equipment that doesn't match any existing system.",
			Parameters: []ToolParameter{
				{Name: "property_id", Type: "string", Description: "UUID of the property to add the system to", Required: true},
				{Name: "category", Type: "string", Description: "Category name: HVAC, Plumbing, Electrical, Appliances, Roofing, Exterior, Interior, Landscaping, Security, Other", Required: true},
				{Name: "name", Type: "string", Description: "Name for the system (e.g., 'Furnace', 'Water Heater', 'Well Tank')", Required: true},
				{Name: "manufacturer", Type: "string", Description: "Manufacturer/brand name", Required: false},
				{Name: "model", Type: "string", Description: "Model number", Required: false},
				{Name: "serial_number", Type: "string", Description: "Serial number", Required: false},
				{Name: "install_date", Type: "string", Description: "Installation or manufacture date (YYYY-MM-DD)", Required: false},
				{Name: "notes", Type: "string", Description: "Additional notes or specifications", Required: false},
			},
		},
		{
			Name:        "create_component",
			Description: "Create a new component (part/subsystem) under an existing system. Use this when the document shows a part of a larger system (e.g., a pump for a well system, a blower motor for HVAC).",
			Parameters: []ToolParameter{
				{Name: "system_id", Type: "string", Description: "UUID of the system to add the component to", Required: true},
				{Name: "name", Type: "string", Description: "Name for the component (e.g., 'Pressure Tank', 'Blower Motor')", Required: true},
				{Name: "manufacturer", Type: "string", Description: "Manufacturer/brand name", Required: false},
				{Name: "model", Type: "string", Description: "Model number", Required: false},
				{Name: "serial_number", Type: "string", Description: "Serial number", Required: false},
				{Name: "install_date", Type: "string", Description: "Installation or manufacture date (YYYY-MM-DD)", Required: false},
				{Name: "notes", Type: "string", Description: "Additional notes or specifications", Required: false},
			},
		},
		{
			Name:        "update_system",
			Description: "Update an existing system with new information from the document. Use this when the document provides additional details about an existing system.",
			Parameters: []ToolParameter{
				{Name: "system_id", Type: "string", Description: "UUID of the system to update", Required: true},
				{Name: "manufacturer", Type: "string", Description: "Manufacturer/brand name", Required: false},
				{Name: "model", Type: "string", Description: "Model number", Required: false},
				{Name: "serial_number", Type: "string", Description: "Serial number", Required: false},
				{Name: "install_date", Type: "string", Description: "Installation or manufacture date (YYYY-MM-DD)", Required: false},
				{Name: "notes", Type: "string", Description: "Additional notes to append", Required: false},
			},
		},
		{
			Name:        "update_component",
			Description: "Update an existing component with new information from the document.",
			Parameters: []ToolParameter{
				{Name: "component_id", Type: "string", Description: "UUID of the component to update", Required: true},
				{Name: "manufacturer", Type: "string", Description: "Manufacturer/brand name", Required: false},
				{Name: "model", Type: "string", Description: "Model number", Required: false},
				{Name: "serial_number", Type: "string", Description: "Serial number", Required: false},
				{Name: "install_date", Type: "string", Description: "Installation or manufacture date (YYYY-MM-DD)", Required: false},
				{Name: "notes", Type: "string", Description: "Additional notes to append", Required: false},
			},
		},
		{
			Name:        "link_document",
			Description: "Link the current document to a property, system, and/or component. Always call this to associate the document with the relevant inventory item.",
			Parameters: []ToolParameter{
				{Name: "property_id", Type: "string", Description: "UUID of the property", Required: false},
				{Name: "system_id", Type: "string", Description: "UUID of the system", Required: false},
				{Name: "component_id", Type: "string", Description: "UUID of the component", Required: false},
			},
		},
	}
}

// ToolExecutor handles executing tool calls against the database.
type ToolExecutor struct {
	db        *database.DB
	docID     uuid.UUID
	userID    uuid.UUID
}

// NewToolExecutor creates a new tool executor.
func NewToolExecutor(db *database.DB, docID, userID uuid.UUID) *ToolExecutor {
	return &ToolExecutor{
		db:     db,
		docID:  docID,
		userID: userID,
	}
}

// Execute runs a tool call and returns the result.
func (e *ToolExecutor) Execute(ctx context.Context, call ToolCall) ToolResult {
	var content string
	var isError bool

	switch call.Name {
	case "create_system":
		content, isError = e.createSystem(ctx, call.Arguments)
	case "create_component":
		content, isError = e.createComponent(ctx, call.Arguments)
	case "update_system":
		content, isError = e.updateSystem(ctx, call.Arguments)
	case "update_component":
		content, isError = e.updateComponent(ctx, call.Arguments)
	case "link_document":
		content, isError = e.linkDocument(ctx, call.Arguments)
	default:
		content = fmt.Sprintf("Unknown tool: %s", call.Name)
		isError = true
	}

	return ToolResult{
		ToolCallID: call.ID,
		Content:    content,
		IsError:    isError,
	}
}

func (e *ToolExecutor) createSystem(ctx context.Context, args map[string]any) (string, bool) {
	propertyIDStr, _ := args["property_id"].(string)
	propertyID, err := uuid.Parse(propertyIDStr)
	if err != nil {
		return "Invalid property_id", true
	}

	// Verify user owns property
	prop, err := e.db.GetProperty(ctx, propertyID)
	if err != nil || prop == nil || prop.UserID != e.userID {
		return "Property not found or access denied", true
	}

	categoryName, _ := args["category"].(string)
	category, err := e.db.GetCategoryByName(ctx, categoryName)
	if err != nil || category == nil {
		return fmt.Sprintf("Category '%s' not found", categoryName), true
	}

	name, _ := args["name"].(string)
	if name == "" {
		return "Name is required", true
	}

	params := database.CreateSystemParams{
		PropertyID: propertyID,
		CategoryID: category.ID,
		Name:       name,
	}

	if v, ok := args["manufacturer"].(string); ok && v != "" {
		params.Manufacturer = &v
	}
	if v, ok := args["model"].(string); ok && v != "" {
		params.Model = &v
	}
	if v, ok := args["serial_number"].(string); ok && v != "" {
		params.SerialNumber = &v
	}
	if v, ok := args["install_date"].(string); ok && v != "" {
		if t, err := parseFlexibleDate(v); err == nil {
			params.InstallDate = &t
		}
	}
	if v, ok := args["notes"].(string); ok && v != "" {
		params.Notes = &v
	}

	sys, err := e.db.CreateSystem(ctx, params)
	if err != nil {
		return fmt.Sprintf("Failed to create system: %v", err), true
	}

	// Automatically link the document to this new system
	if err := e.db.UpdateDocumentLinks(ctx, e.docID, &propertyID, &sys.ID); err != nil {
		return fmt.Sprintf("Created system '%s' but failed to link document: %v", sys.Name, err), true
	}

	return fmt.Sprintf("Created system '%s' (ID: %s) and linked document", sys.Name, sys.ID), false
}

func (e *ToolExecutor) createComponent(ctx context.Context, args map[string]any) (string, bool) {
	systemIDStr, _ := args["system_id"].(string)
	systemID, err := uuid.Parse(systemIDStr)
	if err != nil {
		return "Invalid system_id", true
	}

	// Verify user owns system (via property)
	sys, err := e.db.GetSystem(ctx, systemID)
	if err != nil || sys == nil {
		return "System not found", true
	}
	prop, err := e.db.GetProperty(ctx, sys.PropertyID)
	if err != nil || prop == nil || prop.UserID != e.userID {
		return "System not found or access denied", true
	}

	name, _ := args["name"].(string)
	if name == "" {
		return "Name is required", true
	}

	params := database.CreateComponentParams{
		SystemID: systemID,
		Name:     name,
	}

	if v, ok := args["manufacturer"].(string); ok && v != "" {
		params.Manufacturer = &v
	}
	if v, ok := args["model"].(string); ok && v != "" {
		params.Model = &v
	}
	if v, ok := args["serial_number"].(string); ok && v != "" {
		params.SerialNumber = &v
	}
	if v, ok := args["install_date"].(string); ok && v != "" {
		if t, err := parseFlexibleDate(v); err == nil {
			params.InstallDate = &t
		}
	}
	if v, ok := args["notes"].(string); ok && v != "" {
		params.Notes = &v
	}

	comp, err := e.db.CreateComponent(ctx, params)
	if err != nil {
		return fmt.Sprintf("Failed to create component: %v", err), true
	}

	// Automatically link the document to this component and its system/property
	if err := e.db.UpdateDocumentAllLinks(ctx, e.docID, &sys.PropertyID, &systemID, &comp.ID); err != nil {
		return fmt.Sprintf("Created component '%s' but failed to link document: %v", comp.Name, err), true
	}

	return fmt.Sprintf("Created component '%s' (ID: %s) and linked document", comp.Name, comp.ID), false
}

func (e *ToolExecutor) updateSystem(ctx context.Context, args map[string]any) (string, bool) {
	systemIDStr, _ := args["system_id"].(string)
	systemID, err := uuid.Parse(systemIDStr)
	if err != nil {
		return "Invalid system_id", true
	}

	sys, err := e.db.GetSystem(ctx, systemID)
	if err != nil || sys == nil {
		return "System not found", true
	}
	prop, err := e.db.GetProperty(ctx, sys.PropertyID)
	if err != nil || prop == nil || prop.UserID != e.userID {
		return "System not found or access denied", true
	}

	// Build update params, preserving existing values
	params := database.CreateSystemParams{
		PropertyID:      sys.PropertyID,
		CategoryID:      sys.CategoryID,
		Name:            sys.Name,
		Manufacturer:    sys.Manufacturer,
		Model:           sys.Model,
		SerialNumber:    sys.SerialNumber,
		InstallDate:     sys.InstallDate,
		WarrantyExpires: sys.WarrantyExpires,
		Notes:           sys.Notes,
	}

	if v, ok := args["manufacturer"].(string); ok && v != "" {
		params.Manufacturer = &v
	}
	if v, ok := args["model"].(string); ok && v != "" {
		params.Model = &v
	}
	if v, ok := args["serial_number"].(string); ok && v != "" {
		params.SerialNumber = &v
	}
	if v, ok := args["install_date"].(string); ok && v != "" {
		if t, err := parseFlexibleDate(v); err == nil {
			params.InstallDate = &t
		}
	}
	if v, ok := args["notes"].(string); ok && v != "" {
		// Append notes
		if params.Notes != nil && *params.Notes != "" {
			combined := *params.Notes + "\n" + v
			params.Notes = &combined
		} else {
			params.Notes = &v
		}
	}

	if err := e.db.UpdateSystem(ctx, systemID, params); err != nil {
		return fmt.Sprintf("Failed to update system: %v", err), true
	}

	return fmt.Sprintf("Updated system '%s'", sys.Name), false
}

func (e *ToolExecutor) updateComponent(ctx context.Context, args map[string]any) (string, bool) {
	componentIDStr, _ := args["component_id"].(string)
	componentID, err := uuid.Parse(componentIDStr)
	if err != nil {
		return "Invalid component_id", true
	}

	comp, err := e.db.GetComponent(ctx, componentID)
	if err != nil || comp == nil {
		return "Component not found", true
	}

	// Verify ownership via system -> property
	sys, err := e.db.GetSystem(ctx, comp.SystemID)
	if err != nil || sys == nil {
		return "Component's system not found", true
	}
	prop, err := e.db.GetProperty(ctx, sys.PropertyID)
	if err != nil || prop == nil || prop.UserID != e.userID {
		return "Component not found or access denied", true
	}

	params := database.CreateComponentParams{
		SystemID:        comp.SystemID,
		Name:            comp.Name,
		Manufacturer:    comp.Manufacturer,
		Model:           comp.Model,
		SerialNumber:    comp.SerialNumber,
		InstallDate:     comp.InstallDate,
		WarrantyExpires: comp.WarrantyExpires,
		Notes:           comp.Notes,
	}

	if v, ok := args["manufacturer"].(string); ok && v != "" {
		params.Manufacturer = &v
	}
	if v, ok := args["model"].(string); ok && v != "" {
		params.Model = &v
	}
	if v, ok := args["serial_number"].(string); ok && v != "" {
		params.SerialNumber = &v
	}
	if v, ok := args["install_date"].(string); ok && v != "" {
		if t, err := parseFlexibleDate(v); err == nil {
			params.InstallDate = &t
		}
	}
	if v, ok := args["notes"].(string); ok && v != "" {
		if params.Notes != nil && *params.Notes != "" {
			combined := *params.Notes + "\n" + v
			params.Notes = &combined
		} else {
			params.Notes = &v
		}
	}

	if err := e.db.UpdateComponent(ctx, componentID, params); err != nil {
		return fmt.Sprintf("Failed to update component: %v", err), true
	}

	return fmt.Sprintf("Updated component '%s'", comp.Name), false
}

func (e *ToolExecutor) linkDocument(ctx context.Context, args map[string]any) (string, bool) {
	var propertyID, systemID, componentID *uuid.UUID

	if v, ok := args["property_id"].(string); ok && v != "" {
		if id, err := uuid.Parse(v); err == nil {
			propertyID = &id
		}
	}
	if v, ok := args["system_id"].(string); ok && v != "" {
		if id, err := uuid.Parse(v); err == nil {
			systemID = &id
		}
	}
	if v, ok := args["component_id"].(string); ok && v != "" {
		if id, err := uuid.Parse(v); err == nil {
			componentID = &id
		}
	}

	if err := e.db.UpdateDocumentLinks(ctx, e.docID, propertyID, systemID); err != nil {
		return fmt.Sprintf("Failed to link document: %v", err), true
	}

	// Also update component link if provided
	if componentID != nil {
		if err := e.db.UpdateDocumentComponentLink(ctx, e.docID, componentID); err != nil {
			return fmt.Sprintf("Failed to link document to component: %v", err), true
		}
	}

	var links []string
	if propertyID != nil {
		links = append(links, "property")
	}
	if systemID != nil {
		links = append(links, "system")
	}
	if componentID != nil {
		links = append(links, "component")
	}

	if len(links) == 0 {
		return "Document links cleared", false
	}
	return fmt.Sprintf("Document linked to %s", strings.Join(links, ", ")), false
}

// BuildInventoryContext loads the user's complete inventory for LLM context.
func BuildInventoryContext(ctx context.Context, db *database.DB, userID uuid.UUID) (*InventoryContext, error) {
	inv := &InventoryContext{}

	// Load categories
	cats, err := db.ListCategories(ctx)
	if err != nil {
		return nil, fmt.Errorf("failed to load categories: %w", err)
	}
	inv.Categories = cats
	catMap := make(map[uuid.UUID]*database.Category)
	for _, c := range cats {
		catMap[c.ID] = c
	}

	// Load properties
	props, err := db.ListPropertiesByUser(ctx, userID)
	if err != nil {
		return nil, fmt.Errorf("failed to load properties: %w", err)
	}

	for _, prop := range props {
		pws := &PropertyWithSystems{
			Property: prop,
		}

		// Load systems for this property
		systems, err := db.ListSystemsByProperty(ctx, prop.ID)
		if err != nil {
			return nil, fmt.Errorf("failed to load systems: %w", err)
		}

		for _, sys := range systems {
			swc := &SystemWithComponents{
				System:   sys,
				Category: catMap[sys.CategoryID],
			}

			// Load components for this system
			comps, err := db.ListComponentsBySystem(ctx, sys.ID)
			if err != nil {
				return nil, fmt.Errorf("failed to load components: %w", err)
			}
			swc.Components = comps

			pws.Systems = append(pws.Systems, swc)
		}

		inv.Properties = append(inv.Properties, pws)
	}

	return inv, nil
}

// FormatInventoryContext formats the inventory as a string for the LLM prompt.
func FormatInventoryContext(inv *InventoryContext) string {
	if inv == nil || len(inv.Properties) == 0 {
		return "The user has no properties set up yet. You should create a system if the document shows equipment.\n"
	}

	var sb strings.Builder
	sb.WriteString("=== USER'S HOME INVENTORY ===\n\n")

	for _, pws := range inv.Properties {
		sb.WriteString(fmt.Sprintf("PROPERTY: %s (ID: %s)\n", pws.Property.Name, pws.Property.ID))
		if pws.Property.Address != nil {
			sb.WriteString(fmt.Sprintf("  Address: %s\n", *pws.Property.Address))
		}

		if len(pws.Systems) == 0 {
			sb.WriteString("  (No systems yet)\n")
		} else {
			for _, swc := range pws.Systems {
				catName := "Unknown"
				if swc.Category != nil {
					catName = swc.Category.Name
				}
				sb.WriteString(fmt.Sprintf("\n  SYSTEM: %s [%s] (ID: %s)\n", swc.System.Name, catName, swc.System.ID))
				if swc.System.Manufacturer != nil {
					sb.WriteString(fmt.Sprintf("    Manufacturer: %s\n", *swc.System.Manufacturer))
				}
				if swc.System.Model != nil {
					sb.WriteString(fmt.Sprintf("    Model: %s\n", *swc.System.Model))
				}
				if swc.System.SerialNumber != nil {
					sb.WriteString(fmt.Sprintf("    Serial: %s\n", *swc.System.SerialNumber))
				}

				if len(swc.Components) > 0 {
					sb.WriteString("    Components:\n")
					for _, comp := range swc.Components {
						sb.WriteString(fmt.Sprintf("      - %s (ID: %s)", comp.Name, comp.ID))
						if comp.Model != nil {
							sb.WriteString(fmt.Sprintf(" Model: %s", *comp.Model))
						}
						sb.WriteString("\n")
					}
				}
			}
		}
		sb.WriteString("\n")
	}

	sb.WriteString("=== AVAILABLE CATEGORIES ===\n")
	for _, cat := range inv.Categories {
		sb.WriteString(fmt.Sprintf("- %s\n", cat.Name))
	}

	return sb.String()
}
