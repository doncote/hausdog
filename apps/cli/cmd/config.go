package cmd

import (
	"bufio"
	"fmt"
	"os"
	"strings"

	"github.com/hausdog/cli/internal/config"
	"github.com/spf13/cobra"
)

var configCmd = &cobra.Command{
	Use:   "config",
	Short: "Manage CLI configuration",
	Long: `Manage CLI configuration profiles.

Profiles are stored in ~/.config/hausdog/config.yaml and contain
API URL and API key settings for different environments.

Examples:
  hausdog config set local --api-url http://localhost:3333/api/v1 --api-key hd_xxx
  hausdog config set prod --api-url https://hausdog.app/api/v1 --api-key hd_yyy
  hausdog config use local
  hausdog config list
  hausdog config show local`,
}

var configSetCmd = &cobra.Command{
	Use:   "set <profile>",
	Short: "Create or update a profile",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		name := args[0]

		url, _ := cmd.Flags().GetString("api-url")
		key, _ := cmd.Flags().GetString("api-key")

		// Load existing config
		cfg, err := config.Load()
		if err != nil {
			outputError("Failed to load config", err)
		}

		// Get existing profile if it exists
		existing, _ := cfg.GetProfile(name)

		// Merge with existing values
		profile := config.Profile{}
		if existing != nil {
			profile = *existing
		}
		if url != "" {
			profile.APIURL = url
		}
		if key != "" {
			profile.APIKey = key
		}

		// Validate
		if profile.APIURL == "" {
			outputError("API URL required", fmt.Errorf("use --api-url flag"))
		}
		if profile.APIKey == "" {
			outputError("API key required", fmt.Errorf("use --api-key flag"))
		}

		// Save
		cfg.SetProfile(name, profile)
		if err := config.Save(cfg); err != nil {
			outputError("Failed to save config", err)
		}

		if outputFmt == "json" {
			outputJSON(map[string]interface{}{
				"status":  "created",
				"profile": name,
				"api_url": profile.APIURL,
			})
		} else {
			fmt.Printf("Profile %q saved\n", name)
			fmt.Printf("  API URL: %s\n", profile.APIURL)
			fmt.Printf("  API Key: %s...%s\n", profile.APIKey[:6], profile.APIKey[len(profile.APIKey)-4:])
		}
	},
}

var configListCmd = &cobra.Command{
	Use:   "list",
	Short: "List all profiles",
	Run: func(cmd *cobra.Command, args []string) {
		cfg, err := config.Load()
		if err != nil {
			outputError("Failed to load config", err)
		}

		if outputFmt == "json" {
			result := map[string]interface{}{
				"default":  cfg.Default,
				"profiles": []map[string]string{},
			}
			profiles := []map[string]string{}
			for name, p := range cfg.Profiles {
				profiles = append(profiles, map[string]string{
					"name":    name,
					"api_url": p.APIURL,
				})
			}
			result["profiles"] = profiles
			outputJSON(result)
		} else {
			if len(cfg.Profiles) == 0 {
				fmt.Println("No profiles configured")
				fmt.Println("\nCreate one with:")
				fmt.Println("  hausdog config set local --api-url http://localhost:3333/api/v1 --api-key <key>")
				return
			}

			fmt.Printf("Default: %s\n\n", cfg.Default)
			fmt.Println("Profiles:")
			for name, p := range cfg.Profiles {
				marker := "  "
				if name == cfg.Default {
					marker = "* "
				}
				fmt.Printf("%s%s\n", marker, name)
				fmt.Printf("    API URL: %s\n", p.APIURL)
			}
		}
	},
}

var configShowCmd = &cobra.Command{
	Use:   "show [profile]",
	Short: "Show profile details",
	Args:  cobra.MaximumNArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		cfg, err := config.Load()
		if err != nil {
			outputError("Failed to load config", err)
		}

		name := cfg.Default
		if len(args) > 0 {
			name = args[0]
		}

		if name == "" {
			outputError("No profile specified", fmt.Errorf("provide a profile name or set a default with 'config use'"))
		}

		profile, err := cfg.GetProfile(name)
		if err != nil {
			outputError("Profile not found", err)
		}

		if outputFmt == "json" {
			outputJSON(map[string]interface{}{
				"name":    name,
				"api_url": profile.APIURL,
				"api_key": profile.APIKey[:6] + "..." + profile.APIKey[len(profile.APIKey)-4:],
			})
		} else {
			fmt.Printf("Profile: %s\n", name)
			fmt.Printf("  API URL: %s\n", profile.APIURL)
			fmt.Printf("  API Key: %s...%s\n", profile.APIKey[:6], profile.APIKey[len(profile.APIKey)-4:])
		}
	},
}

var configUseCmd = &cobra.Command{
	Use:   "use <profile>",
	Short: "Set the default profile",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		name := args[0]

		cfg, err := config.Load()
		if err != nil {
			outputError("Failed to load config", err)
		}

		// Verify profile exists
		if _, err := cfg.GetProfile(name); err != nil {
			outputError("Profile not found", err)
		}

		cfg.Default = name
		if err := config.Save(cfg); err != nil {
			outputError("Failed to save config", err)
		}

		if outputFmt == "json" {
			outputJSON(map[string]string{
				"status":  "updated",
				"default": name,
			})
		} else {
			fmt.Printf("Default profile set to %q\n", name)
		}
	},
}

var configDeleteCmd = &cobra.Command{
	Use:   "delete <profile>",
	Short: "Delete a profile",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		name := args[0]

		cfg, err := config.Load()
		if err != nil {
			outputError("Failed to load config", err)
		}

		if _, err := cfg.GetProfile(name); err != nil {
			outputError("Profile not found", err)
		}

		// Confirm deletion
		if !forceDelete {
			fmt.Printf("Delete profile %q? [y/N] ", name)
			reader := bufio.NewReader(os.Stdin)
			response, _ := reader.ReadString('\n')
			if strings.ToLower(strings.TrimSpace(response)) != "y" {
				fmt.Println("Cancelled")
				return
			}
		}

		cfg.DeleteProfile(name)
		if err := config.Save(cfg); err != nil {
			outputError("Failed to save config", err)
		}

		if outputFmt == "json" {
			outputJSON(map[string]string{
				"status":  "deleted",
				"profile": name,
			})
		} else {
			fmt.Printf("Profile %q deleted\n", name)
		}
	},
}

var configPathCmd = &cobra.Command{
	Use:   "path",
	Short: "Show config file path",
	Run: func(cmd *cobra.Command, args []string) {
		path := config.ConfigPath()
		if outputFmt == "json" {
			outputJSON(map[string]string{"path": path})
		} else {
			fmt.Println(path)
		}
	},
}

var forceDelete bool

func init() {
	rootCmd.AddCommand(configCmd)
	configCmd.AddCommand(configSetCmd)
	configCmd.AddCommand(configListCmd)
	configCmd.AddCommand(configShowCmd)
	configCmd.AddCommand(configUseCmd)
	configCmd.AddCommand(configDeleteCmd)
	configCmd.AddCommand(configPathCmd)

	// Set flags
	configSetCmd.Flags().String("api-url", "", "API base URL")
	configSetCmd.Flags().String("api-key", "", "API key")

	// Delete flags
	configDeleteCmd.Flags().BoolVarP(&forceDelete, "force", "f", false, "Skip confirmation")
}
