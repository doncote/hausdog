package cmd

import (
	"archive/tar"
	"archive/zip"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"
	"time"

	"github.com/spf13/cobra"
)

const (
	githubOwner = "doncote"
	githubRepo  = "hausdog"
)

type githubRelease struct {
	TagName string        `json:"tag_name"`
	Name    string        `json:"name"`
	Assets  []githubAsset `json:"assets"`
}

type githubAsset struct {
	Name               string `json:"name"`
	BrowserDownloadURL string `json:"browser_download_url"`
}

var (
	checkOnly bool
	force     bool
)

var updateCmd = &cobra.Command{
	Use:   "update",
	Short: "Check for and install updates",
	Long:  `Check GitHub releases for a newer version and optionally install it.`,
	RunE: func(cmd *cobra.Command, args []string) error {
		return runUpdate()
	},
}

func init() {
	updateCmd.Flags().BoolVar(&checkOnly, "check", false, "Only check for updates, don't install")
	updateCmd.Flags().BoolVar(&force, "force", false, "Force update even if already on latest version")
	rootCmd.AddCommand(updateCmd)
}

func runUpdate() error {
	fmt.Printf("Current version: %s\n", Version)

	// Fetch latest release
	release, err := fetchLatestRelease()
	if err != nil {
		return fmt.Errorf("failed to check for updates: %w", err)
	}

	latestVersion := strings.TrimPrefix(release.TagName, "v")
	currentVersion := strings.TrimPrefix(Version, "v")

	fmt.Printf("Latest version: %s\n", latestVersion)

	if !force && currentVersion == latestVersion {
		fmt.Println("You are already on the latest version.")
		return nil
	}

	if currentVersion == "dev" && !force {
		fmt.Println("Running development version. Use --force to update.")
		return nil
	}

	if checkOnly {
		if compareVersions(currentVersion, latestVersion) < 0 {
			fmt.Printf("\nUpdate available: %s -> %s\n", currentVersion, latestVersion)
			fmt.Println("Run 'hausdog update' to install.")
		}
		return nil
	}

	// Find the right asset for this platform
	asset := findAssetForPlatform(release.Assets)
	if asset == nil {
		return fmt.Errorf("no release asset found for %s/%s", runtime.GOOS, runtime.GOARCH)
	}

	fmt.Printf("\nDownloading %s...\n", asset.Name)

	// Download to temp file
	tempDir, err := os.MkdirTemp("", "hausdog-update")
	if err != nil {
		return fmt.Errorf("failed to create temp directory: %w", err)
	}
	defer os.RemoveAll(tempDir)

	archivePath := filepath.Join(tempDir, asset.Name)
	if err := downloadFile(asset.BrowserDownloadURL, archivePath); err != nil {
		return fmt.Errorf("failed to download update: %w", err)
	}

	// Extract the binary
	binaryPath, err := extractBinary(archivePath, tempDir)
	if err != nil {
		return fmt.Errorf("failed to extract update: %w", err)
	}

	// Get current executable path
	execPath, err := os.Executable()
	if err != nil {
		return fmt.Errorf("failed to get executable path: %w", err)
	}
	execPath, err = filepath.EvalSymlinks(execPath)
	if err != nil {
		return fmt.Errorf("failed to resolve executable path: %w", err)
	}

	// Replace the binary
	fmt.Printf("Installing to %s...\n", execPath)
	if err := replaceBinary(binaryPath, execPath); err != nil {
		return fmt.Errorf("failed to install update: %w", err)
	}

	fmt.Printf("\nSuccessfully updated to version %s!\n", latestVersion)
	return nil
}

func fetchLatestRelease() (*githubRelease, error) {
	client := &http.Client{Timeout: 30 * time.Second}
	url := fmt.Sprintf("https://api.github.com/repos/%s/%s/releases/latest", githubOwner, githubRepo)

	resp, err := client.Get(url)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("GitHub API returned %d: %s", resp.StatusCode, string(body))
	}

	var release githubRelease
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		return nil, err
	}

	return &release, nil
}

func findAssetForPlatform(assets []githubAsset) *githubAsset {
	goos := runtime.GOOS
	goarch := runtime.GOARCH

	// Map Go arch names to common archive names
	archMap := map[string]string{
		"amd64": "x86_64",
		"arm64": "arm64",
	}
	if mapped, ok := archMap[goarch]; ok {
		goarch = mapped
	}

	// Also try the raw GOARCH
	archOptions := []string{goarch, runtime.GOARCH}

	for _, asset := range assets {
		name := strings.ToLower(asset.Name)

		// Skip checksums
		if strings.Contains(name, "checksum") {
			continue
		}

		// Check OS match
		osMatch := false
		switch goos {
		case "darwin":
			osMatch = strings.Contains(name, "darwin") || strings.Contains(name, "macos")
		case "linux":
			osMatch = strings.Contains(name, "linux")
		case "windows":
			osMatch = strings.Contains(name, "windows")
		}

		if !osMatch {
			continue
		}

		// Check arch match
		for _, arch := range archOptions {
			if strings.Contains(strings.ToLower(name), strings.ToLower(arch)) {
				return &asset
			}
		}
	}

	return nil
}

func downloadFile(url, destPath string) error {
	client := &http.Client{Timeout: 5 * time.Minute}

	resp, err := client.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("download failed with status %d", resp.StatusCode)
	}

	out, err := os.Create(destPath)
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, resp.Body)
	return err
}

func extractBinary(archivePath, destDir string) (string, error) {
	if strings.HasSuffix(archivePath, ".zip") {
		return extractZip(archivePath, destDir)
	} else if strings.HasSuffix(archivePath, ".tar.gz") || strings.HasSuffix(archivePath, ".tgz") {
		return extractTarGz(archivePath, destDir)
	}
	return "", fmt.Errorf("unsupported archive format: %s", archivePath)
}

func extractZip(archivePath, destDir string) (string, error) {
	r, err := zip.OpenReader(archivePath)
	if err != nil {
		return "", err
	}
	defer r.Close()

	var binaryPath string
	for _, f := range r.File {
		name := filepath.Base(f.Name)
		if name == "hausdog" || name == "hausdog.exe" {
			rc, err := f.Open()
			if err != nil {
				return "", err
			}

			binaryPath = filepath.Join(destDir, name)
			out, err := os.OpenFile(binaryPath, os.O_CREATE|os.O_WRONLY, 0755)
			if err != nil {
				rc.Close()
				return "", err
			}

			_, err = io.Copy(out, rc)
			out.Close()
			rc.Close()

			if err != nil {
				return "", err
			}
			break
		}
	}

	if binaryPath == "" {
		return "", fmt.Errorf("binary not found in archive")
	}
	return binaryPath, nil
}

func extractTarGz(archivePath, destDir string) (string, error) {
	file, err := os.Open(archivePath)
	if err != nil {
		return "", err
	}
	defer file.Close()

	gzr, err := gzip.NewReader(file)
	if err != nil {
		return "", err
	}
	defer gzr.Close()

	tr := tar.NewReader(gzr)

	var binaryPath string
	for {
		header, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return "", err
		}

		name := filepath.Base(header.Name)
		if name == "hausdog" || name == "hausdog.exe" {
			binaryPath = filepath.Join(destDir, name)
			out, err := os.OpenFile(binaryPath, os.O_CREATE|os.O_WRONLY, 0755)
			if err != nil {
				return "", err
			}

			_, err = io.Copy(out, tr)
			out.Close()

			if err != nil {
				return "", err
			}
			break
		}
	}

	if binaryPath == "" {
		return "", fmt.Errorf("binary not found in archive")
	}
	return binaryPath, nil
}

func replaceBinary(newPath, oldPath string) error {
	// On Windows, we can't replace a running executable directly
	// We need to rename it first
	if runtime.GOOS == "windows" {
		backupPath := oldPath + ".old"
		os.Remove(backupPath) // Remove any existing backup
		if err := os.Rename(oldPath, backupPath); err != nil {
			return fmt.Errorf("failed to backup old binary: %w", err)
		}
	}

	// Read new binary
	newBinary, err := os.ReadFile(newPath)
	if err != nil {
		return err
	}

	// Write to destination
	if err := os.WriteFile(oldPath, newBinary, 0755); err != nil {
		return err
	}

	return nil
}

// compareVersions compares two semver strings
// Returns -1 if v1 < v2, 0 if equal, 1 if v1 > v2
func compareVersions(v1, v2 string) int {
	// Simple comparison - split by dots and compare numerically
	parts1 := strings.Split(v1, ".")
	parts2 := strings.Split(v2, ".")

	for i := 0; i < len(parts1) && i < len(parts2); i++ {
		var n1, n2 int
		fmt.Sscanf(parts1[i], "%d", &n1)
		fmt.Sscanf(parts2[i], "%d", &n2)

		if n1 < n2 {
			return -1
		}
		if n1 > n2 {
			return 1
		}
	}

	if len(parts1) < len(parts2) {
		return -1
	}
	if len(parts1) > len(parts2) {
		return 1
	}
	return 0
}
