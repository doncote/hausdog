package config

import (
	"fmt"
	"os"
	"path/filepath"

	"gopkg.in/yaml.v3"
)

// Profile represents a named configuration profile
type Profile struct {
	APIURL string `yaml:"api_url"`
	APIKey string `yaml:"api_key"`
}

// Config represents the CLI configuration file
type Config struct {
	Default  string             `yaml:"default"`
	Profiles map[string]Profile `yaml:"profiles"`
}

// ConfigPath returns the path to the config file
func ConfigPath() string {
	// Check XDG_CONFIG_HOME first
	if xdgConfig := os.Getenv("XDG_CONFIG_HOME"); xdgConfig != "" {
		return filepath.Join(xdgConfig, "hausdog", "config.yaml")
	}

	// Fall back to ~/.config/hausdog/config.yaml
	home, err := os.UserHomeDir()
	if err != nil {
		return ""
	}
	return filepath.Join(home, ".config", "hausdog", "config.yaml")
}

// Load reads the config file from disk
func Load() (*Config, error) {
	path := ConfigPath()
	if path == "" {
		return nil, fmt.Errorf("could not determine config path")
	}

	data, err := os.ReadFile(path)
	if err != nil {
		if os.IsNotExist(err) {
			// Return empty config if file doesn't exist
			return &Config{
				Profiles: make(map[string]Profile),
			}, nil
		}
		return nil, fmt.Errorf("failed to read config: %w", err)
	}

	var cfg Config
	if err := yaml.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("failed to parse config: %w", err)
	}

	if cfg.Profiles == nil {
		cfg.Profiles = make(map[string]Profile)
	}

	return &cfg, nil
}

// Save writes the config file to disk
func Save(cfg *Config) error {
	path := ConfigPath()
	if path == "" {
		return fmt.Errorf("could not determine config path")
	}

	// Ensure directory exists
	dir := filepath.Dir(path)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("failed to create config directory: %w", err)
	}

	data, err := yaml.Marshal(cfg)
	if err != nil {
		return fmt.Errorf("failed to marshal config: %w", err)
	}

	if err := os.WriteFile(path, data, 0600); err != nil {
		return fmt.Errorf("failed to write config: %w", err)
	}

	return nil
}

// GetProfile returns the named profile, or the default if name is empty
func (c *Config) GetProfile(name string) (*Profile, error) {
	if name == "" {
		name = c.Default
	}

	if name == "" {
		return nil, nil // No profile configured
	}

	profile, ok := c.Profiles[name]
	if !ok {
		return nil, fmt.Errorf("profile %q not found", name)
	}

	return &profile, nil
}

// SetProfile creates or updates a profile
func (c *Config) SetProfile(name string, profile Profile) {
	c.Profiles[name] = profile
}

// DeleteProfile removes a profile
func (c *Config) DeleteProfile(name string) {
	delete(c.Profiles, name)
	if c.Default == name {
		c.Default = ""
	}
}

// ListProfiles returns all profile names
func (c *Config) ListProfiles() []string {
	names := make([]string, 0, len(c.Profiles))
	for name := range c.Profiles {
		names = append(names, name)
	}
	return names
}
