package cmd

import (
	"encoding/json"
	"fmt"

	"github.com/hausdog/cli/internal/client"
	"github.com/spf13/cobra"
)

var (
	maintItemID       string
	maintName         string
	maintDesc         string
	maintInterval     int
	maintNextDueDate  string
	maintStatus       string
	maintDate         string
	maintCost         float64
	maintPerformedBy  string
	maintCompletionDesc string
	maintUpcomingLimit int
)

var maintenanceCmd = &cobra.Command{
	Use:     "maintenance",
	Aliases: []string{"maint"},
	Short:   "Manage maintenance tasks",
	Long:    `List, create, update, complete, and delete recurring maintenance tasks.`,
}

var maintenanceListCmd = &cobra.Command{
	Use:   "list",
	Short: "List maintenance tasks for an item",
	Long: `List all maintenance tasks for a specific item.

Examples:
  hausdog maintenance list --item <id>`,
	Run: func(cmd *cobra.Command, args []string) {
		if maintItemID == "" {
			outputError("Item ID required", fmt.Errorf("use --item flag"))
		}

		c := client.NewSimple(getAPIURL(), requireAPIKey())

		data, err := c.Get(fmt.Sprintf("/items/%s/maintenance", maintItemID))
		if err != nil {
			outputError("Failed to list maintenance tasks", err)
		}

		var tasks []map[string]interface{}
		if err := json.Unmarshal(data, &tasks); err != nil {
			outputError("Failed to parse response", err)
		}

		outputJSON(tasks)
	},
}

var maintenanceUpcomingCmd = &cobra.Command{
	Use:   "upcoming",
	Short: "List upcoming maintenance tasks across all properties",
	Long: `List upcoming maintenance tasks sorted by due date.
Returns tasks across all your properties, ordered by urgency.

Examples:
  hausdog maintenance upcoming
  hausdog maintenance upcoming --limit 50`,
	Run: func(cmd *cobra.Command, args []string) {
		c := client.NewSimple(getAPIURL(), requireAPIKey())

		path := "/maintenance/upcoming"
		if maintUpcomingLimit > 0 {
			path = fmt.Sprintf("/maintenance/upcoming?limit=%d", maintUpcomingLimit)
		}

		data, err := c.Get(path)
		if err != nil {
			outputError("Failed to list upcoming maintenance", err)
		}

		var tasks []map[string]interface{}
		if err := json.Unmarshal(data, &tasks); err != nil {
			outputError("Failed to parse response", err)
		}

		outputJSON(tasks)
	},
}

var maintenanceGetCmd = &cobra.Command{
	Use:   "get <id>",
	Short: "Get a maintenance task by ID",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		c := client.NewSimple(getAPIURL(), requireAPIKey())

		data, err := c.Get("/maintenance/" + args[0])
		if err != nil {
			outputError("Failed to get maintenance task", err)
		}

		var task map[string]interface{}
		if err := json.Unmarshal(data, &task); err != nil {
			outputError("Failed to parse response", err)
		}

		outputJSON(task)
	},
}

var maintenanceCreateCmd = &cobra.Command{
	Use:   "create",
	Short: "Create a maintenance task",
	Long: `Create a new recurring maintenance task for an item.

Examples:
  hausdog maintenance create --item <id> --name "Replace air filter" --interval 3 --next-due 2026-03-01T00:00:00Z
  hausdog maintenance create --item <id> --name "Annual inspection" --interval 12 --next-due 2026-06-01T00:00:00Z --description "Full system check"`,
	Run: func(cmd *cobra.Command, args []string) {
		if maintItemID == "" {
			outputError("Item ID required", fmt.Errorf("use --item flag"))
		}

		c := client.NewSimple(getAPIURL(), requireAPIKey())

		body := map[string]interface{}{
			"name":           maintName,
			"intervalMonths": maintInterval,
			"nextDueDate":    maintNextDueDate,
		}

		if maintDesc != "" {
			body["description"] = maintDesc
		}

		data, err := c.Post(fmt.Sprintf("/items/%s/maintenance", maintItemID), body)
		if err != nil {
			outputError("Failed to create maintenance task", err)
		}

		var task map[string]interface{}
		if err := json.Unmarshal(data, &task); err != nil {
			outputError("Failed to parse response", err)
		}

		outputJSON(task)
	},
}

var maintenanceUpdateCmd = &cobra.Command{
	Use:   "update <id>",
	Short: "Update a maintenance task",
	Long: `Update fields on an existing maintenance task.

Examples:
  hausdog maintenance update <id> --name "New name"
  hausdog maintenance update <id> --interval 6 --next-due 2026-06-01T00:00:00Z
  hausdog maintenance update <id> --status paused`,
	Args: cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		c := client.NewSimple(getAPIURL(), requireAPIKey())

		body := make(map[string]interface{})
		if cmd.Flags().Changed("name") {
			body["name"] = maintName
		}
		if cmd.Flags().Changed("description") {
			body["description"] = maintDesc
		}
		if cmd.Flags().Changed("interval") {
			body["intervalMonths"] = maintInterval
		}
		if cmd.Flags().Changed("next-due") {
			body["nextDueDate"] = maintNextDueDate
		}
		if cmd.Flags().Changed("status") {
			body["status"] = maintStatus
		}

		if len(body) == 0 {
			outputError("No fields to update", fmt.Errorf("provide at least one field"))
		}

		data, err := c.Patch("/maintenance/"+args[0], body)
		if err != nil {
			outputError("Failed to update maintenance task", err)
		}

		var task map[string]interface{}
		if err := json.Unmarshal(data, &task); err != nil {
			outputError("Failed to parse response", err)
		}

		outputJSON(task)
	},
}

var maintenanceCompleteCmd = &cobra.Command{
	Use:   "complete <id>",
	Short: "Complete a maintenance task",
	Long: `Mark a maintenance task as completed. Records an event and advances
the next due date by the task's interval.

Examples:
  hausdog maintenance complete <id> --date 2026-02-18T00:00:00Z
  hausdog maintenance complete <id> --date 2026-02-18T00:00:00Z --cost 75.50 --performed-by "HVAC Co"
  hausdog maintenance complete <id> --date 2026-02-18T00:00:00Z --description "Replaced filter, cleaned coils"`,
	Args: cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		c := client.NewSimple(getAPIURL(), requireAPIKey())

		body := map[string]interface{}{
			"date": maintDate,
		}

		if maintCost > 0 {
			body["cost"] = maintCost
		}
		if maintPerformedBy != "" {
			body["performedBy"] = maintPerformedBy
		}
		if maintCompletionDesc != "" {
			body["description"] = maintCompletionDesc
		}

		data, err := c.Post("/maintenance/"+args[0]+"/complete", body)
		if err != nil {
			outputError("Failed to complete maintenance task", err)
		}

		var task map[string]interface{}
		if err := json.Unmarshal(data, &task); err != nil {
			outputError("Failed to parse response", err)
		}

		outputJSON(task)
	},
}

var maintenanceSnoozeCmd = &cobra.Command{
	Use:   "snooze <id>",
	Short: "Snooze a maintenance task",
	Long: `Snooze a maintenance task by advancing its due date by one interval.

Examples:
  hausdog maintenance snooze <id>`,
	Args: cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		c := client.NewSimple(getAPIURL(), requireAPIKey())

		data, err := c.Post("/maintenance/"+args[0]+"/snooze", nil)
		if err != nil {
			outputError("Failed to snooze maintenance task", err)
		}

		var task map[string]interface{}
		if err := json.Unmarshal(data, &task); err != nil {
			outputError("Failed to parse response", err)
		}

		outputJSON(task)
	},
}

var maintenanceGenerateCmd = &cobra.Command{
	Use:   "generate",
	Short: "Generate AI maintenance suggestions for an item",
	Long: `Use AI to suggest recurring maintenance tasks based on the item's details.
Tasks are created with their due date set to now (needs immediate attention or completion).

Examples:
  hausdog maintenance generate --item <id>`,
	Run: func(cmd *cobra.Command, args []string) {
		if maintItemID == "" {
			outputError("Item ID required", fmt.Errorf("use --item flag"))
		}

		c := client.NewSimple(getAPIURL(), requireAPIKey())

		data, err := c.Post(fmt.Sprintf("/items/%s/maintenance/generate", maintItemID), nil)
		if err != nil {
			outputError("Failed to generate maintenance suggestions", err)
		}

		var result map[string]interface{}
		if err := json.Unmarshal(data, &result); err != nil {
			outputError("Failed to parse response", err)
		}

		outputJSON(result)
	},
}

var maintenanceDeleteCmd = &cobra.Command{
	Use:   "delete <id>",
	Short: "Delete a maintenance task",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		c := client.NewSimple(getAPIURL(), requireAPIKey())

		_, err := c.Delete("/maintenance/" + args[0])
		if err != nil {
			outputError("Failed to delete maintenance task", err)
		}

		outputJSON(map[string]string{
			"status":  "deleted",
			"id":      args[0],
			"message": "Maintenance task deleted successfully",
		})
	},
}

func init() {
	rootCmd.AddCommand(maintenanceCmd)
	maintenanceCmd.AddCommand(maintenanceListCmd)
	maintenanceCmd.AddCommand(maintenanceUpcomingCmd)
	maintenanceCmd.AddCommand(maintenanceGetCmd)
	maintenanceCmd.AddCommand(maintenanceCreateCmd)
	maintenanceCmd.AddCommand(maintenanceUpdateCmd)
	maintenanceCmd.AddCommand(maintenanceCompleteCmd)
	maintenanceCmd.AddCommand(maintenanceSnoozeCmd)
	maintenanceCmd.AddCommand(maintenanceGenerateCmd)
	maintenanceCmd.AddCommand(maintenanceDeleteCmd)

	// Generate flags
	maintenanceGenerateCmd.Flags().StringVar(&maintItemID, "item", "", "Item ID (required)")
	maintenanceGenerateCmd.MarkFlagRequired("item")

	// List flags
	maintenanceListCmd.Flags().StringVar(&maintItemID, "item", "", "Item ID (required)")
	maintenanceListCmd.MarkFlagRequired("item")

	// Upcoming flags
	maintenanceUpcomingCmd.Flags().IntVar(&maintUpcomingLimit, "limit", 20, "Max number of tasks to return")

	// Create flags
	maintenanceCreateCmd.Flags().StringVar(&maintItemID, "item", "", "Item ID (required)")
	maintenanceCreateCmd.Flags().StringVar(&maintName, "name", "", "Task name (required)")
	maintenanceCreateCmd.Flags().StringVar(&maintDesc, "description", "", "Task description")
	maintenanceCreateCmd.Flags().IntVar(&maintInterval, "interval", 0, "Interval in months (required)")
	maintenanceCreateCmd.Flags().StringVar(&maintNextDueDate, "next-due", "", "Next due date in ISO8601 format (required)")
	maintenanceCreateCmd.MarkFlagRequired("item")
	maintenanceCreateCmd.MarkFlagRequired("name")
	maintenanceCreateCmd.MarkFlagRequired("interval")
	maintenanceCreateCmd.MarkFlagRequired("next-due")

	// Update flags
	maintenanceUpdateCmd.Flags().StringVar(&maintName, "name", "", "Task name")
	maintenanceUpdateCmd.Flags().StringVar(&maintDesc, "description", "", "Task description")
	maintenanceUpdateCmd.Flags().IntVar(&maintInterval, "interval", 0, "Interval in months")
	maintenanceUpdateCmd.Flags().StringVar(&maintNextDueDate, "next-due", "", "Next due date in ISO8601 format")
	maintenanceUpdateCmd.Flags().StringVar(&maintStatus, "status", "", "Status: active, paused, dismissed")

	// Complete flags
	maintenanceCompleteCmd.Flags().StringVar(&maintDate, "date", "", "Completion date in ISO8601 format (required)")
	maintenanceCompleteCmd.Flags().Float64Var(&maintCost, "cost", 0, "Cost of maintenance")
	maintenanceCompleteCmd.Flags().StringVar(&maintPerformedBy, "performed-by", "", "Who performed the work")
	maintenanceCompleteCmd.Flags().StringVar(&maintCompletionDesc, "description", "", "Description of work done")
	maintenanceCompleteCmd.MarkFlagRequired("date")
}
