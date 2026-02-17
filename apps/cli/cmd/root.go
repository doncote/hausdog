package cmd

import (
	"encoding/json"
	"fmt"
	"os"

	"github.com/hausdog/cli/internal/config"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
)

var (
	apiURL      string
	apiKey      string
	profileName string
	outputFmt   string
	cfg         *config.Config
)

// rootCmd represents the base command
var rootCmd = &cobra.Command{
	Use:   "hausdog",
	Short: "CLI for managing home documentation",
	Long: `Hausdog CLI provides programmatic access to your home documentation.

Manage properties, spaces, items, events, and documents through a simple
command-line interface. Designed for automation and LLM agent integration.

Configuration (in order of precedence):
  1. Command-line flags (--api-url, --api-key)
  2. Environment variables (HAUSDOG_API_URL, HAUSDOG_API_KEY)
  3. Config file profile (~/.config/hausdog/config.yaml)

Examples:
  hausdog properties list
  hausdog --profile prod properties list
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
	rootCmd.PersistentFlags().StringVarP(&profileName, "profile", "p", "", "Config profile to use")
	rootCmd.PersistentFlags().StringVarP(&outputFmt, "format", "f", "json", "Output format: json, table")

	// Bind to viper
	viper.BindPFlag("api_url", rootCmd.PersistentFlags().Lookup("api-url"))
	viper.BindPFlag("api_key", rootCmd.PersistentFlags().Lookup("api-key"))
}

func initConfig() {
	// Bind environment variables
	viper.SetEnvPrefix("HAUSDOG")
	viper.AutomaticEnv()

	// Load config file
	var err error
	cfg, err = config.Load()
	if err != nil {
		// Don't fail if config can't be loaded, just use env/flags
		cfg = &config.Config{Profiles: make(map[string]config.Profile)}
	}
}

// getAPIURL returns the configured API URL with proper precedence
func getAPIURL() string {
	// 1. Command-line flag
	if apiURL != "" {
		return apiURL
	}

	// 2. Environment variable
	if envURL := viper.GetString("api_url"); envURL != "" {
		return envURL
	}

	// 3. Config file profile
	if cfg != nil {
		profile, err := cfg.GetProfile(profileName)
		if err == nil && profile != nil && profile.APIURL != "" {
			return profile.APIURL
		}
	}

	// 4. Default
	return "http://localhost:3000/api/v1"
}

// getAPIKey returns the configured API key with proper precedence
func getAPIKey() string {
	// 1. Command-line flag
	if apiKey != "" {
		return apiKey
	}

	// 2. Environment variable
	if envKey := viper.GetString("api_key"); envKey != "" {
		return envKey
	}

	// 3. Config file profile
	if cfg != nil {
		profile, err := cfg.GetProfile(profileName)
		if err == nil && profile != nil && profile.APIKey != "" {
			return profile.APIKey
		}
	}

	return ""
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
		outputError("API key required", fmt.Errorf("set HAUSDOG_API_KEY, use --api-key, or configure a profile"))
	}
	return key
}
