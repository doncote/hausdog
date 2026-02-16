package cmd

import (
	"fmt"
	"io"
	"net/http"
	"time"

	"github.com/spf13/cobra"
)

var (
	// Version is set at build time
	Version = "dev"
	// Commit is set at build time
	Commit = "unknown"
)

var versionCmd = &cobra.Command{
	Use:   "version",
	Short: "Print version information",
	Long:  `Print the CLI version and check API health.`,
	Run: func(cmd *cobra.Command, args []string) {
		info := map[string]interface{}{
			"version": Version,
			"commit":  Commit,
		}

		// Check API health
		apiURL := getAPIURL()
		client := &http.Client{Timeout: 5 * time.Second}

		resp, err := client.Get(apiURL + "/health")
		if err != nil {
			info["api_status"] = "unreachable"
			info["api_error"] = err.Error()
		} else {
			defer resp.Body.Close()
			body, _ := io.ReadAll(resp.Body)
			if resp.StatusCode == 200 {
				info["api_status"] = "healthy"
				info["api_url"] = apiURL
			} else {
				info["api_status"] = "unhealthy"
				info["api_code"] = resp.StatusCode
				info["api_body"] = string(body)
			}
		}

		if outputFmt == "json" {
			outputJSON(info)
		} else {
			fmt.Printf("hausdog version %s (commit: %s)\n", Version, Commit)
			if info["api_status"] == "healthy" {
				fmt.Printf("API: %s (healthy)\n", apiURL)
			} else {
				fmt.Printf("API: %s (%s)\n", apiURL, info["api_status"])
			}
		}
	},
}

func init() {
	rootCmd.AddCommand(versionCmd)
}
