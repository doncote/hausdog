package cmd

import (
	"encoding/json"
	"fmt"

	"github.com/hausdog/cli/internal/client"
	"github.com/spf13/cobra"
)

var (
	spacePropertyID string
	spaceName       string
)

var spacesCmd = &cobra.Command{
	Use:   "spaces",
	Short: "Manage spaces",
	Long:  `List, create, update, and delete spaces within properties.`,
}

var spacesListCmd = &cobra.Command{
	Use:   "list",
	Short: "List spaces for a property",
	Run: func(cmd *cobra.Command, args []string) {
		if spacePropertyID == "" {
			outputError("Property ID required", fmt.Errorf("use --property flag"))
		}

		c := client.NewSimple(getAPIURL(), requireAPIKey())

		data, err := c.Get(fmt.Sprintf("/properties/%s/spaces", spacePropertyID))
		if err != nil {
			outputError("Failed to list spaces", err)
		}

		var spaces []map[string]interface{}
		if err := json.Unmarshal(data, &spaces); err != nil {
			outputError("Failed to parse response", err)
		}

		outputJSON(spaces)
	},
}

var spacesGetCmd = &cobra.Command{
	Use:   "get <id>",
	Short: "Get a space by ID",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		c := client.NewSimple(getAPIURL(), requireAPIKey())

		data, err := c.Get("/spaces/" + args[0])
		if err != nil {
			outputError("Failed to get space", err)
		}

		var space map[string]interface{}
		if err := json.Unmarshal(data, &space); err != nil {
			outputError("Failed to parse response", err)
		}

		outputJSON(space)
	},
}

var spacesCreateCmd = &cobra.Command{
	Use:   "create",
	Short: "Create a new space",
	Run: func(cmd *cobra.Command, args []string) {
		if spacePropertyID == "" {
			outputError("Property ID required", fmt.Errorf("use --property flag"))
		}

		c := client.NewSimple(getAPIURL(), requireAPIKey())

		body := map[string]interface{}{
			"name": spaceName,
		}

		data, err := c.Post(fmt.Sprintf("/properties/%s/spaces", spacePropertyID), body)
		if err != nil {
			outputError("Failed to create space", err)
		}

		var space map[string]interface{}
		if err := json.Unmarshal(data, &space); err != nil {
			outputError("Failed to parse response", err)
		}

		outputJSON(space)
	},
}

var spacesUpdateCmd = &cobra.Command{
	Use:   "update <id>",
	Short: "Update a space",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		c := client.NewSimple(getAPIURL(), requireAPIKey())

		body := make(map[string]interface{})
		if cmd.Flags().Changed("name") {
			body["name"] = spaceName
		}

		if len(body) == 0 {
			outputError("No fields to update", fmt.Errorf("provide --name"))
		}

		data, err := c.Patch("/spaces/"+args[0], body)
		if err != nil {
			outputError("Failed to update space", err)
		}

		var space map[string]interface{}
		if err := json.Unmarshal(data, &space); err != nil {
			outputError("Failed to parse response", err)
		}

		outputJSON(space)
	},
}

var spacesDeleteCmd = &cobra.Command{
	Use:   "delete <id>",
	Short: "Delete a space",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		c := client.NewSimple(getAPIURL(), requireAPIKey())

		_, err := c.Delete("/spaces/" + args[0])
		if err != nil {
			outputError("Failed to delete space", err)
		}

		outputJSON(map[string]string{
			"status":  "deleted",
			"id":      args[0],
			"message": "Space deleted successfully",
		})
	},
}

func init() {
	rootCmd.AddCommand(spacesCmd)
	spacesCmd.AddCommand(spacesListCmd)
	spacesCmd.AddCommand(spacesGetCmd)
	spacesCmd.AddCommand(spacesCreateCmd)
	spacesCmd.AddCommand(spacesUpdateCmd)
	spacesCmd.AddCommand(spacesDeleteCmd)

	// List flags
	spacesListCmd.Flags().StringVar(&spacePropertyID, "property", "", "Property ID (required)")
	spacesListCmd.MarkFlagRequired("property")

	// Create flags
	spacesCreateCmd.Flags().StringVar(&spacePropertyID, "property", "", "Property ID (required)")
	spacesCreateCmd.Flags().StringVar(&spaceName, "name", "", "Space name (required)")
	spacesCreateCmd.MarkFlagRequired("property")
	spacesCreateCmd.MarkFlagRequired("name")

	// Update flags
	spacesUpdateCmd.Flags().StringVar(&spaceName, "name", "", "Space name")
}
