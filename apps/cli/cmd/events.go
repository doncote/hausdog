package cmd

import (
	"encoding/json"
	"fmt"

	"github.com/hausdog/cli/internal/client"
	"github.com/spf13/cobra"
)

var (
	eventItemID     string
	eventType       string
	eventDate       string
	eventDesc       string
	eventCost       float64
	eventPerformedBy string
)

var eventsCmd = &cobra.Command{
	Use:   "events",
	Short: "Manage events",
	Long:  `List, create, update, and delete maintenance events.`,
}

var eventsListCmd = &cobra.Command{
	Use:   "list",
	Short: "List events for an item",
	Run: func(cmd *cobra.Command, args []string) {
		if eventItemID == "" {
			outputError("Item ID required", fmt.Errorf("use --item flag"))
		}

		c := client.NewSimple(getAPIURL(), requireAPIKey())

		data, err := c.Get(fmt.Sprintf("/items/%s/events", eventItemID))
		if err != nil {
			outputError("Failed to list events", err)
		}

		var events []map[string]interface{}
		if err := json.Unmarshal(data, &events); err != nil {
			outputError("Failed to parse response", err)
		}

		outputJSON(events)
	},
}

var eventsGetCmd = &cobra.Command{
	Use:   "get <id>",
	Short: "Get an event by ID",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		c := client.NewSimple(getAPIURL(), requireAPIKey())

		data, err := c.Get("/events/" + args[0])
		if err != nil {
			outputError("Failed to get event", err)
		}

		var event map[string]interface{}
		if err := json.Unmarshal(data, &event); err != nil {
			outputError("Failed to parse response", err)
		}

		outputJSON(event)
	},
}

var eventsCreateCmd = &cobra.Command{
	Use:   "create",
	Short: "Create a new event",
	Long: `Create a new maintenance event for an item.

Event types: installation, maintenance, repair, inspection, replacement, observation

Examples:
  hausdog events create --item <id> --type maintenance --date 2024-01-15T10:00:00Z --description "Annual filter replacement"
  hausdog events create --item <id> --type repair --date 2024-01-15T10:00:00Z --cost 150.00 --performed-by "HVAC Co"`,
	Run: func(cmd *cobra.Command, args []string) {
		if eventItemID == "" {
			outputError("Item ID required", fmt.Errorf("use --item flag"))
		}

		c := client.NewSimple(getAPIURL(), requireAPIKey())

		body := map[string]interface{}{
			"type": eventType,
			"date": eventDate,
		}

		if eventDesc != "" {
			body["description"] = eventDesc
		}
		if eventCost > 0 {
			body["cost"] = eventCost
		}
		if eventPerformedBy != "" {
			body["performedBy"] = eventPerformedBy
		}

		data, err := c.Post(fmt.Sprintf("/items/%s/events", eventItemID), body)
		if err != nil {
			outputError("Failed to create event", err)
		}

		var event map[string]interface{}
		if err := json.Unmarshal(data, &event); err != nil {
			outputError("Failed to parse response", err)
		}

		outputJSON(event)
	},
}

var eventsUpdateCmd = &cobra.Command{
	Use:   "update <id>",
	Short: "Update an event",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		c := client.NewSimple(getAPIURL(), requireAPIKey())

		body := make(map[string]interface{})
		if cmd.Flags().Changed("type") {
			body["type"] = eventType
		}
		if cmd.Flags().Changed("date") {
			body["date"] = eventDate
		}
		if cmd.Flags().Changed("description") {
			body["description"] = eventDesc
		}
		if cmd.Flags().Changed("cost") {
			body["cost"] = eventCost
		}
		if cmd.Flags().Changed("performed-by") {
			body["performedBy"] = eventPerformedBy
		}

		if len(body) == 0 {
			outputError("No fields to update", fmt.Errorf("provide at least one field"))
		}

		data, err := c.Patch("/events/"+args[0], body)
		if err != nil {
			outputError("Failed to update event", err)
		}

		var event map[string]interface{}
		if err := json.Unmarshal(data, &event); err != nil {
			outputError("Failed to parse response", err)
		}

		outputJSON(event)
	},
}

var eventsDeleteCmd = &cobra.Command{
	Use:   "delete <id>",
	Short: "Delete an event",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		c := client.NewSimple(getAPIURL(), requireAPIKey())

		_, err := c.Delete("/events/" + args[0])
		if err != nil {
			outputError("Failed to delete event", err)
		}

		outputJSON(map[string]string{
			"status":  "deleted",
			"id":      args[0],
			"message": "Event deleted successfully",
		})
	},
}

func init() {
	rootCmd.AddCommand(eventsCmd)
	eventsCmd.AddCommand(eventsListCmd)
	eventsCmd.AddCommand(eventsGetCmd)
	eventsCmd.AddCommand(eventsCreateCmd)
	eventsCmd.AddCommand(eventsUpdateCmd)
	eventsCmd.AddCommand(eventsDeleteCmd)

	// List flags
	eventsListCmd.Flags().StringVar(&eventItemID, "item", "", "Item ID (required)")
	eventsListCmd.MarkFlagRequired("item")

	// Create flags
	eventsCreateCmd.Flags().StringVar(&eventItemID, "item", "", "Item ID (required)")
	eventsCreateCmd.Flags().StringVar(&eventType, "type", "", "Event type: installation, maintenance, repair, inspection, replacement, observation (required)")
	eventsCreateCmd.Flags().StringVar(&eventDate, "date", "", "Event date in ISO8601 format (required)")
	eventsCreateCmd.Flags().StringVar(&eventDesc, "description", "", "Event description")
	eventsCreateCmd.Flags().Float64Var(&eventCost, "cost", 0, "Event cost")
	eventsCreateCmd.Flags().StringVar(&eventPerformedBy, "performed-by", "", "Who performed the work")
	eventsCreateCmd.MarkFlagRequired("item")
	eventsCreateCmd.MarkFlagRequired("type")
	eventsCreateCmd.MarkFlagRequired("date")

	// Update flags
	eventsUpdateCmd.Flags().StringVar(&eventType, "type", "", "Event type")
	eventsUpdateCmd.Flags().StringVar(&eventDate, "date", "", "Event date in ISO8601 format")
	eventsUpdateCmd.Flags().StringVar(&eventDesc, "description", "", "Event description")
	eventsUpdateCmd.Flags().Float64Var(&eventCost, "cost", 0, "Event cost")
	eventsUpdateCmd.Flags().StringVar(&eventPerformedBy, "performed-by", "", "Who performed the work")
}
