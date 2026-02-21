package cmd

import (
	"encoding/json"
	"fmt"

	"github.com/hausdog/cli/internal/client"
	"github.com/spf13/cobra"
)

var (
	catName string
	catSlug string
	catIcon string
)

var categoriesCmd = &cobra.Command{
	Use:   "categories",
	Short: "Manage item categories",
	Long:  `List, create, update, and delete item categories.`,
}

var categoriesListCmd = &cobra.Command{
	Use:   "list",
	Short: "List all categories",
	Run: func(cmd *cobra.Command, args []string) {
		c := client.NewSimple(getAPIURL(), requireAPIKey())

		data, err := c.Get("/categories")
		if err != nil {
			outputError("Failed to list categories", err)
		}

		var categories []map[string]interface{}
		if err := json.Unmarshal(data, &categories); err != nil {
			outputError("Failed to parse response", err)
		}

		outputJSON(categories)
	},
}

var categoriesCreateCmd = &cobra.Command{
	Use:   "create",
	Short: "Create a custom category",
	Run: func(cmd *cobra.Command, args []string) {
		c := client.NewSimple(getAPIURL(), requireAPIKey())

		body := map[string]interface{}{
			"slug": catSlug,
			"name": catName,
		}

		if catIcon != "" {
			body["icon"] = catIcon
		}

		data, err := c.Post("/categories", body)
		if err != nil {
			outputError("Failed to create category", err)
		}

		var category map[string]interface{}
		if err := json.Unmarshal(data, &category); err != nil {
			outputError("Failed to parse response", err)
		}

		outputJSON(category)
	},
}

var categoriesUpdateCmd = &cobra.Command{
	Use:   "update <id>",
	Short: "Update a custom category",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		c := client.NewSimple(getAPIURL(), requireAPIKey())

		body := make(map[string]interface{})
		if cmd.Flags().Changed("name") {
			body["name"] = catName
		}
		if cmd.Flags().Changed("icon") {
			body["icon"] = catIcon
		}

		if len(body) == 0 {
			outputError("No fields to update", fmt.Errorf("provide --name or --icon"))
		}

		data, err := c.Patch("/categories/"+args[0], body)
		if err != nil {
			outputError("Failed to update category", err)
		}

		var category map[string]interface{}
		if err := json.Unmarshal(data, &category); err != nil {
			outputError("Failed to parse response", err)
		}

		outputJSON(category)
	},
}

var categoriesDeleteCmd = &cobra.Command{
	Use:   "delete <id>",
	Short: "Delete a custom category",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		c := client.NewSimple(getAPIURL(), requireAPIKey())

		_, err := c.Delete("/categories/" + args[0])
		if err != nil {
			outputError("Failed to delete category", err)
		}

		outputJSON(map[string]string{
			"status":  "deleted",
			"id":      args[0],
			"message": "Category deleted successfully",
		})
	},
}

func init() {
	rootCmd.AddCommand(categoriesCmd)
	categoriesCmd.AddCommand(categoriesListCmd)
	categoriesCmd.AddCommand(categoriesCreateCmd)
	categoriesCmd.AddCommand(categoriesUpdateCmd)
	categoriesCmd.AddCommand(categoriesDeleteCmd)

	// Create flags
	categoriesCreateCmd.Flags().StringVar(&catName, "name", "", "Category name (required)")
	categoriesCreateCmd.Flags().StringVar(&catSlug, "slug", "", "Category slug, lowercase with hyphens (required)")
	categoriesCreateCmd.Flags().StringVar(&catIcon, "icon", "", "Lucide icon name")
	categoriesCreateCmd.MarkFlagRequired("name")
	categoriesCreateCmd.MarkFlagRequired("slug")

	// Update flags
	categoriesUpdateCmd.Flags().StringVar(&catName, "name", "", "Category name")
	categoriesUpdateCmd.Flags().StringVar(&catIcon, "icon", "", "Lucide icon name")
}
