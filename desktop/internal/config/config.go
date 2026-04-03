package config

// These values are injected at build time via -ldflags.
// Example: go build -ldflags "-X taskflow-desktop/internal/config.apiURL=https://..."
// In dev mode, they fall back to defaults (safe for local testing only).
var (
	apiURL          = "" // Injected at build time
	cognitoRegion   = "" // Injected at build time
	cognitoPoolID   = "" // Injected at build time
	cognitoClientID = "" // Injected at build time
	webDashboardURL = "" // Injected at build time
)

// Config holds all environment-specific settings.
type Config struct {
	APIURL          string
	CognitoRegion   string
	CognitoPoolID   string
	CognitoClientID string
	WebDashboardURL string
}

var loaded *Config

// Get returns the app configuration. Values are baked in at build time.
func Get() *Config {
	if loaded != nil {
		return loaded
	}

	loaded = &Config{
		APIURL:          apiURL,
		CognitoRegion:   cognitoRegion,
		CognitoPoolID:   cognitoPoolID,
		CognitoClientID: cognitoClientID,
		WebDashboardURL: webDashboardURL,
	}

	// Validate required fields
	if loaded.APIURL == "" || loaded.CognitoClientID == "" {
		panic("Config not injected at build time. Use build.ps1 or set -ldflags.")
	}

	return loaded
}
