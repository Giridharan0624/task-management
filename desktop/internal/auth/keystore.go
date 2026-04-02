package auth

import (
	"encoding/json"
	"fmt"

	"github.com/zalando/go-keyring"
)

const (
	keyIdToken      = "id_token"
	keyAccessToken  = "access_token"
	keyRefreshToken = "refresh_token"
	keyMeta         = "meta" // stores ExpiresAt
)

// tokenMeta holds non-token metadata that fits in a single keyring entry.
type tokenMeta struct {
	ExpiresAt int64 `json:"expiresAt"`
}

// saveTokensToKeyring persists tokens to the OS keychain.
// Each token is stored separately to stay under the Windows Credential Manager
// size limit (~2560 bytes per entry).
func (s *Service) saveTokensToKeyring() error {
	entries := map[string]string{
		keyIdToken:      s.tokens.IDToken,
		keyAccessToken:  s.tokens.AccessToken,
		keyRefreshToken: s.tokens.RefreshToken,
	}

	for key, val := range entries {
		if err := keyring.Set(KeyringService, key, val); err != nil {
			return fmt.Errorf("failed to save %s to keyring: %w", key, err)
		}
	}

	// Store metadata separately
	meta, _ := json.Marshal(tokenMeta{ExpiresAt: s.tokens.ExpiresAt})
	if err := keyring.Set(KeyringService, keyMeta, string(meta)); err != nil {
		return fmt.Errorf("failed to save meta to keyring: %w", err)
	}

	return nil
}

// loadTokensFromKeyring reads tokens from the OS keychain.
func (s *Service) loadTokensFromKeyring() (*Tokens, error) {
	idToken, err := keyring.Get(KeyringService, keyIdToken)
	if err != nil {
		return nil, fmt.Errorf("no stored tokens: %w", err)
	}

	accessToken, err := keyring.Get(KeyringService, keyAccessToken)
	if err != nil {
		return nil, fmt.Errorf("no stored access token: %w", err)
	}

	refreshToken, err := keyring.Get(KeyringService, keyRefreshToken)
	if err != nil {
		return nil, fmt.Errorf("no stored refresh token: %w", err)
	}

	metaStr, err := keyring.Get(KeyringService, keyMeta)
	if err != nil {
		return nil, fmt.Errorf("no stored meta: %w", err)
	}

	var meta tokenMeta
	if err := json.Unmarshal([]byte(metaStr), &meta); err != nil {
		return nil, fmt.Errorf("failed to parse meta: %w", err)
	}

	return &Tokens{
		IDToken:      idToken,
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresAt:    meta.ExpiresAt,
	}, nil
}

// deleteTokensFromKeyring removes all tokens from the OS keychain.
func (s *Service) deleteTokensFromKeyring() {
	_ = keyring.Delete(KeyringService, keyIdToken)
	_ = keyring.Delete(KeyringService, keyAccessToken)
	_ = keyring.Delete(KeyringService, keyRefreshToken)
	_ = keyring.Delete(KeyringService, keyMeta)
}
