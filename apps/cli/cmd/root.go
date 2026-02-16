package cmd

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

var (
	apiURL    string
	apiKey    string
	outputFmt string
)

// rootCmd represents the base command
var rootCmd = &cobra.Command{
	Use:   "hausdog",
	Short: "CLI for managing home documentation",
	Long: `Hausdog CLI provides programmatic access to your home documentation.

Manage properties, spaces, items, events, and documents through a simple
command-line interface. Designed for automation and LLM agent integration.

Configuration:
  Set HAUSDOG_API_URL and HAUSDOG_API_KEY environment variables, or use
  --api-url and --api-key flags.

Examples:
  hausdog properties list
  hausdog items create --property <id> --name "HVAC System" --category hvac
  hausdog documents upload --property <id> --file ./receipt.pdf`,
}

// Execute adds all child commands to the root command and sets flags appropriately.
func Execute() {
	if err := rootCmd.Execute(); err != nil {
		os.Exit(1)
	}
}

func init() {
	cobra.OnInitialize(initConfig)

	// Global flags
	rootCmd.PersistentFlags().StringVar(&apiURL, "api-url", "", "API base URL (env: HAUSDOG_API_URL)")
	rootCmd.PersistentFlags().StringVar(&apiKey, "api-key", "", "API key (env: HAUSDOG_API_KEY)")
	rootCmd.PersistentFlags().StringVarP(&outputFmt, "format", "f", "json", "Output format: json, table, yaml")

	// Bind to viper
	viper.BindPFlag("api_url", rootCmd.PersistentFlags().Lookup("api-url"))
	viper.BindPFlag("api_key", rootCmd.PersistentFlags().Lookup("api-key"))
}

func initConfig() {
	// Bind environment variables
	viper.SetEnvPrefix("HAUSDOG")
	viper.AutomaticEnv()

	// Set defaults
	viper.SetDefault("api_url", "http://localhost:3000/api/v1")
}

// getAPIURL returns the configured API URL
func getAPIURL() string {
	if apiURL != "" {
		return apiURL
	}
	return viper.GetString("api_url")
}

// getAPIKey returns the configured API key
func getAPIKey() string {
	if apiKey != "" {
		return apiKey
	}
	return viper.GetString("api_key")
}

// outputJSON prints data as JSON
func outputJSON(data interface{}) {
	enc := json.NewEncoder(os.Stdout)
	enc.SetIndent("", "  ")
	if err := enc.Encode(data); err != nil {
		fmt.Fprintf(os.Stderr, "Error encoding output: %v\n", err)
		os.Exit(1)
	}
}

// outputError prints an error message and exits
func outputError(msg string, err error) {
	if outputFmt == "json" {
		outputJSON(map[string]string{
			"error":   "cli_error",
			"message": fmt.Sprintf("%s: %v", msg, err),
		})
	} else {
		fmt.Fprintf(os.Stderr, "Error: %s: %v\n", msg, err)
	}
	os.Exit(1)
}

// requireAPIKey ensures an API key is configured
func requireAPIKey() string {
	key := getAPIKey()
	if key == "" {
		outputError("API key required", fmt.Errorf("set HAUSDOG_API_KEY or use --api-key"))
	}
	return key
}
