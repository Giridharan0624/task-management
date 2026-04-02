package config

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
)

// Config holds all environment-specific settings loaded from config.json.
type Config struct {
	APIURL          string `json:"api_url"`
	CognitoRegion   string `json:"cognito_region"`
	CognitoPoolID   string `json:"cognito_user_pool_id"`
	CognitoClientID string `json:"cognito_client_id"`
	WebDashboardURL string `json:"web_dashboard_url"`
}

var loaded *Config

// Load reads config.json from the executable's directory.
func Load() (*Config, error) {
	if loaded != nil {
		return loaded, nil
	}

	// Look for config.json next to the executable
	exePath, err := os.Executable()
	if err != nil {
		return nil, fmt.Errorf("failed to get executable path: %w", err)
	}
	dir := filepath.Dir(exePath)
	path := filepath.Join(dir, "config.json")

	// Fallback: look in current working directory (for dev mode)
	if _, err := os.Stat(path); os.IsNotExist(err) {
		path = "config.json"
	}

	data, err := os.ReadFile(path)
	if err != nil {
		return nil, fmt.Errorf("failed to read config.json: %w", err)
	}

	var cfg Config
	if err := json.Unmarshal(data, &cfg); err != nil {
		return nil, fmt.Errorf("failed to parse config.json: %w", err)
	}

	loaded = &cfg
	return loaded, nil
}

// Get returns the loaded config. Panics if not loaded yet.
func Get() *Config {
	if loaded == nil {
		cfg, err := Load()
		if err != nil {
			panic(fmt.Sprintf("config not loaded: %v", err))
		}
		return cfg
	}
	return loaded
}
