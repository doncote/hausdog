package cmd

import (
	"encoding/json"
	"fmt"

	"github.com/hausdog/cli/internal/client"
	"github.com/spf13/cobra"
)

var (
	itemPropertyID   string
	itemSpaceID      string
	itemParentID     string
	itemName         string
	itemDescription  string
	itemCategory     string
	itemManufacturer string
	itemModel        string
	itemSerialNumber string
	itemNotes        string
)

var itemsCmd = &cobra.Command{
	Use:   "items",
	Short: "Manage items",
	Long:  `List, create, update, and delete items (appliances, systems, etc).`,
}

var itemsListCmd = &cobra.Command{
	Use:   "list",
	Short: "List items for a property",
	Run: func(cmd *cobra.Command, args []string) {
		if itemPropertyID == "" {
			outputError("Property ID required", fmt.Errorf("use --property flag"))
		}

		c := client.NewSimple(getAPIURL(), requireAPIKey())

		path := fmt.Sprintf("/properties/%s/items", itemPropertyID)
		if itemSpaceID != "" {
			path += "?spaceId=" + itemSpaceID
		}

		data, err := c.Get(path)
		if err != nil {
			outputError("Failed to list items", err)
		}

		var items []map[string]interface{}
		if err := json.Unmarshal(data, &items); err != nil {
			outputError("Failed to parse response", err)
		}

		outputJSON(items)
	},
}

var itemsGetCmd = &cobra.Command{
	Use:   "get <id>",
	Short: "Get an item by ID",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		c := client.NewSimple(getAPIURL(), requireAPIKey())

		data, err := c.Get("/items/" + args[0])
		if err != nil {
			outputError("Failed to get item", err)
		}

		var item map[string]interface{}
		if err := json.Unmarshal(data, &item); err != nil {
			outputError("Failed to parse response", err)
		}

		outputJSON(item)
	},
}

var itemsChildrenCmd = &cobra.Command{
	Use:   "children <id>",
	Short: "List child items",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		c := client.NewSimple(getAPIURL(), requireAPIKey())

		data, err := c.Get("/items/" + args[0] + "/children")
		if err != nil {
			outputError("Failed to list children", err)
		}

		var items []map[string]interface{}
		if err := json.Unmarshal(data, &items); err != nil {
			outputError("Failed to parse response", err)
		}

		outputJSON(items)
	},
}

var itemsCreateCmd = &cobra.Command{
	Use:   "create",
	Short: "Create a new item",
	Run: func(cmd *cobra.Command, args []string) {
		if itemPropertyID == "" {
			outputError("Property ID required", fmt.Errorf("use --property flag"))
		}

		c := client.NewSimple(getAPIURL(), requireAPIKey())

		body := map[string]interface{}{
			"name":     itemName,
			"category": itemCategory,
		}

		if itemDescription != "" {
			body["description"] = itemDescription
		}
		if itemSpaceID != "" {
			body["spaceId"] = itemSpaceID
		}
		if itemParentID != "" {
			body["parentId"] = itemParentID
		}
		if itemManufacturer != "" {
			body["manufacturer"] = itemManufacturer
		}
		if itemModel != "" {
			body["model"] = itemModel
		}
		if itemSerialNumber != "" {
			body["serialNumber"] = itemSerialNumber
		}
		if itemNotes != "" {
			body["notes"] = itemNotes
		}

		data, err := c.Post(fmt.Sprintf("/properties/%s/items", itemPropertyID), body)
		if err != nil {
			outputError("Failed to create item", err)
		}

		var item map[string]interface{}
		if err := json.Unmarshal(data, &item); err != nil {
			outputError("Failed to parse response", err)
		}

		outputJSON(item)
	},
}

var itemsUpdateCmd = &cobra.Command{
	Use:   "update <id>",
	Short: "Update an item",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		c := client.NewSimple(getAPIURL(), requireAPIKey())

		body := make(map[string]interface{})
		if cmd.Flags().Changed("name") {
			body["name"] = itemName
		}
		if cmd.Flags().Changed("description") {
			body["description"] = itemDescription
		}
		if cmd.Flags().Changed("category") {
			body["category"] = itemCategory
		}
		if cmd.Flags().Changed("space") {
			body["spaceId"] = itemSpaceID
		}
		if cmd.Flags().Changed("parent") {
			body["parentId"] = itemParentID
		}
		if cmd.Flags().Changed("manufacturer") {
			body["manufacturer"] = itemManufacturer
		}
		if cmd.Flags().Changed("model") {
			body["model"] = itemModel
		}
		if cmd.Flags().Changed("serial-number") {
			body["serialNumber"] = itemSerialNumber
		}
		if cmd.Flags().Changed("notes") {
			body["notes"] = itemNotes
		}

		if len(body) == 0 {
			outputError("No fields to update", fmt.Errorf("provide at least one field"))
		}

		data, err := c.Patch("/items/"+args[0], body)
		if err != nil {
			outputError("Failed to update item", err)
		}

		var item map[string]interface{}
		if err := json.Unmarshal(data, &item); err != nil {
			outputError("Failed to parse response", err)
		}

		outputJSON(item)
	},
}

var itemsDeleteCmd = &cobra.Command{
	Use:   "delete <id>",
	Short: "Delete an item",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		c := client.NewSimple(getAPIURL(), requireAPIKey())

		_, err := c.Delete("/items/" + args[0])
		if err != nil {
			outputError("Failed to delete item", err)
		}

		outputJSON(map[string]string{
			"status":  "deleted",
			"id":      args[0],
			"message": "Item deleted successfully",
		})
	},
}

func init() {
	rootCmd.AddCommand(itemsCmd)
	itemsCmd.AddCommand(itemsListCmd)
	itemsCmd.AddCommand(itemsGetCmd)
	itemsCmd.AddCommand(itemsChildrenCmd)
	itemsCmd.AddCommand(itemsCreateCmd)
	itemsCmd.AddCommand(itemsUpdateCmd)
	itemsCmd.AddCommand(itemsDeleteCmd)

	// List flags
	itemsListCmd.Flags().StringVar(&itemPropertyID, "property", "", "Property ID (required)")
	itemsListCmd.Flags().StringVar(&itemSpaceID, "space", "", "Filter by space ID")
	itemsListCmd.MarkFlagRequired("property")

	// Create flags
	itemsCreateCmd.Flags().StringVar(&itemPropertyID, "property", "", "Property ID (required)")
	itemsCreateCmd.Flags().StringVar(&itemName, "name", "", "Item name (required)")
	itemsCreateCmd.Flags().StringVar(&itemCategory, "category", "", "Category: appliance, automotive, hvac, plumbing, electrical, etc (required)")
	itemsCreateCmd.Flags().StringVar(&itemSpaceID, "space", "", "Space ID")
	itemsCreateCmd.Flags().StringVar(&itemParentID, "parent", "", "Parent item ID")
	itemsCreateCmd.Flags().StringVar(&itemManufacturer, "manufacturer", "", "Manufacturer")
	itemsCreateCmd.Flags().StringVar(&itemModel, "model", "", "Model")
	itemsCreateCmd.Flags().StringVar(&itemSerialNumber, "serial-number", "", "Serial number")
	itemsCreateCmd.Flags().StringVar(&itemDescription, "description", "", "Item description")
	itemsCreateCmd.Flags().StringVar(&itemNotes, "notes", "", "Notes")
	itemsCreateCmd.MarkFlagRequired("property")
	itemsCreateCmd.MarkFlagRequired("name")
	itemsCreateCmd.MarkFlagRequired("category")

	// Update flags
	itemsUpdateCmd.Flags().StringVar(&itemName, "name", "", "Item name")
	itemsUpdateCmd.Flags().StringVar(&itemCategory, "category", "", "Category")
	itemsUpdateCmd.Flags().StringVar(&itemSpaceID, "space", "", "Space ID")
	itemsUpdateCmd.Flags().StringVar(&itemParentID, "parent", "", "Parent item ID")
	itemsUpdateCmd.Flags().StringVar(&itemManufacturer, "manufacturer", "", "Manufacturer")
	itemsUpdateCmd.Flags().StringVar(&itemModel, "model", "", "Model")
	itemsUpdateCmd.Flags().StringVar(&itemSerialNumber, "serial-number", "", "Serial number")
	itemsUpdateCmd.Flags().StringVar(&itemDescription, "description", "", "Item description")
	itemsUpdateCmd.Flags().StringVar(&itemNotes, "notes", "", "Notes")
}
