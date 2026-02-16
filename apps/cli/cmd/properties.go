package cmd

import (
	"encoding/json"
	"fmt"

	"github.com/hausdog/cli/internal/client"
	"github.com/spf13/cobra"
)

var propertiesCmd = &cobra.Command{
	Use:   "properties",
	Short: "Manage properties",
	Long:  `List, create, update, and delete properties.`,
}

var propertiesListCmd = &cobra.Command{
	Use:   "list",
	Short: "List all properties",
	Run: func(cmd *cobra.Command, args []string) {
		c := client.New(getAPIURL(), requireAPIKey())

		data, err := c.Get("/properties")
		if err != nil {
			outputError("Failed to list properties", err)
		}

		var properties []map[string]interface{}
		if err := json.Unmarshal(data, &properties); err != nil {
			outputError("Failed to parse response", err)
		}

		outputJSON(properties)
	},
}

var propertiesGetCmd = &cobra.Command{
	Use:   "get <id>",
	Short: "Get a property by ID",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		c := client.New(getAPIURL(), requireAPIKey())

		data, err := c.Get("/properties/" + args[0])
		if err != nil {
			outputError("Failed to get property", err)
		}

		var property map[string]interface{}
		if err := json.Unmarshal(data, &property); err != nil {
			outputError("Failed to parse response", err)
		}

		outputJSON(property)
	},
}

var (
	propertyName           string
	propertyStreetAddress  string
	propertyCity           string
	propertyState          string
	propertyPostalCode     string
	propertyCountry        string
	propertyYearBuilt      int
	propertySquareFeet     int
	propertyBedrooms       int
	propertyBathrooms      float64
	propertyType           string
	propertyFormattedAddr  string
)

var propertiesCreateCmd = &cobra.Command{
	Use:   "create",
	Short: "Create a new property",
	Run: func(cmd *cobra.Command, args []string) {
		c := client.New(getAPIURL(), requireAPIKey())

		body := map[string]interface{}{
			"name": propertyName,
		}

		// Add optional fields
		if propertyStreetAddress != "" {
			body["streetAddress"] = propertyStreetAddress
		}
		if propertyCity != "" {
			body["city"] = propertyCity
		}
		if propertyState != "" {
			body["state"] = propertyState
		}
		if propertyPostalCode != "" {
			body["postalCode"] = propertyPostalCode
		}
		if propertyCountry != "" {
			body["country"] = propertyCountry
		}
		if propertyFormattedAddr != "" {
			body["formattedAddress"] = propertyFormattedAddr
		}
		if propertyYearBuilt > 0 {
			body["yearBuilt"] = propertyYearBuilt
		}
		if propertySquareFeet > 0 {
			body["squareFeet"] = propertySquareFeet
		}
		if propertyBedrooms > 0 {
			body["bedrooms"] = propertyBedrooms
		}
		if propertyBathrooms > 0 {
			body["bathrooms"] = propertyBathrooms
		}
		if propertyType != "" {
			body["propertyType"] = propertyType
		}

		data, err := c.Post("/properties", body)
		if err != nil {
			outputError("Failed to create property", err)
		}

		var property map[string]interface{}
		if err := json.Unmarshal(data, &property); err != nil {
			outputError("Failed to parse response", err)
		}

		outputJSON(property)
	},
}

var propertiesUpdateCmd = &cobra.Command{
	Use:   "update <id>",
	Short: "Update a property",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		c := client.New(getAPIURL(), requireAPIKey())

		body := make(map[string]interface{})

		// Only include changed fields
		if cmd.Flags().Changed("name") {
			body["name"] = propertyName
		}
		if cmd.Flags().Changed("street-address") {
			body["streetAddress"] = propertyStreetAddress
		}
		if cmd.Flags().Changed("city") {
			body["city"] = propertyCity
		}
		if cmd.Flags().Changed("state") {
			body["state"] = propertyState
		}
		if cmd.Flags().Changed("postal-code") {
			body["postalCode"] = propertyPostalCode
		}
		if cmd.Flags().Changed("country") {
			body["country"] = propertyCountry
		}
		if cmd.Flags().Changed("formatted-address") {
			body["formattedAddress"] = propertyFormattedAddr
		}
		if cmd.Flags().Changed("year-built") {
			body["yearBuilt"] = propertyYearBuilt
		}
		if cmd.Flags().Changed("square-feet") {
			body["squareFeet"] = propertySquareFeet
		}
		if cmd.Flags().Changed("bedrooms") {
			body["bedrooms"] = propertyBedrooms
		}
		if cmd.Flags().Changed("bathrooms") {
			body["bathrooms"] = propertyBathrooms
		}
		if cmd.Flags().Changed("property-type") {
			body["propertyType"] = propertyType
		}

		if len(body) == 0 {
			outputError("No fields to update", fmt.Errorf("provide at least one field to update"))
		}

		data, err := c.Patch("/properties/"+args[0], body)
		if err != nil {
			outputError("Failed to update property", err)
		}

		var property map[string]interface{}
		if err := json.Unmarshal(data, &property); err != nil {
			outputError("Failed to parse response", err)
		}

		outputJSON(property)
	},
}

var propertiesDeleteCmd = &cobra.Command{
	Use:   "delete <id>",
	Short: "Delete a property",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		c := client.New(getAPIURL(), requireAPIKey())

		_, err := c.Delete("/properties/" + args[0])
		if err != nil {
			outputError("Failed to delete property", err)
		}

		outputJSON(map[string]string{
			"status":  "deleted",
			"id":      args[0],
			"message": "Property deleted successfully",
		})
	},
}

func init() {
	rootCmd.AddCommand(propertiesCmd)
	propertiesCmd.AddCommand(propertiesListCmd)
	propertiesCmd.AddCommand(propertiesGetCmd)
	propertiesCmd.AddCommand(propertiesCreateCmd)
	propertiesCmd.AddCommand(propertiesUpdateCmd)
	propertiesCmd.AddCommand(propertiesDeleteCmd)

	// Create flags
	propertiesCreateCmd.Flags().StringVar(&propertyName, "name", "", "Property name (required)")
	propertiesCreateCmd.Flags().StringVar(&propertyStreetAddress, "street-address", "", "Street address")
	propertiesCreateCmd.Flags().StringVar(&propertyCity, "city", "", "City")
	propertiesCreateCmd.Flags().StringVar(&propertyState, "state", "", "State")
	propertiesCreateCmd.Flags().StringVar(&propertyPostalCode, "postal-code", "", "Postal code")
	propertiesCreateCmd.Flags().StringVar(&propertyCountry, "country", "", "Country")
	propertiesCreateCmd.Flags().StringVar(&propertyFormattedAddr, "formatted-address", "", "Full formatted address")
	propertiesCreateCmd.Flags().IntVar(&propertyYearBuilt, "year-built", 0, "Year built")
	propertiesCreateCmd.Flags().IntVar(&propertySquareFeet, "square-feet", 0, "Square footage")
	propertiesCreateCmd.Flags().IntVar(&propertyBedrooms, "bedrooms", 0, "Number of bedrooms")
	propertiesCreateCmd.Flags().Float64Var(&propertyBathrooms, "bathrooms", 0, "Number of bathrooms")
	propertiesCreateCmd.Flags().StringVar(&propertyType, "property-type", "", "Property type")
	propertiesCreateCmd.MarkFlagRequired("name")

	// Update flags (same as create)
	propertiesUpdateCmd.Flags().StringVar(&propertyName, "name", "", "Property name")
	propertiesUpdateCmd.Flags().StringVar(&propertyStreetAddress, "street-address", "", "Street address")
	propertiesUpdateCmd.Flags().StringVar(&propertyCity, "city", "", "City")
	propertiesUpdateCmd.Flags().StringVar(&propertyState, "state", "", "State")
	propertiesUpdateCmd.Flags().StringVar(&propertyPostalCode, "postal-code", "", "Postal code")
	propertiesUpdateCmd.Flags().StringVar(&propertyCountry, "country", "", "Country")
	propertiesUpdateCmd.Flags().StringVar(&propertyFormattedAddr, "formatted-address", "", "Full formatted address")
	propertiesUpdateCmd.Flags().IntVar(&propertyYearBuilt, "year-built", 0, "Year built")
	propertiesUpdateCmd.Flags().IntVar(&propertySquareFeet, "square-feet", 0, "Square footage")
	propertiesUpdateCmd.Flags().IntVar(&propertyBedrooms, "bedrooms", 0, "Number of bedrooms")
	propertiesUpdateCmd.Flags().Float64Var(&propertyBathrooms, "bathrooms", 0, "Number of bathrooms")
	propertiesUpdateCmd.Flags().StringVar(&propertyType, "property-type", "", "Property type")
}
