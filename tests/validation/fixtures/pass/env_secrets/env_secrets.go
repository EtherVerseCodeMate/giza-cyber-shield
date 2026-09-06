// Secrets sourced from the environment - should PASS (no hardcoded material).
package config

import "os"

var (
	StripeKey  = os.Getenv("STRIPE_API_KEY")
	DBPassword = os.Getenv("DATABASE_PASSWORD")
	AuthToken  = os.Getenv("AUTH_TOKEN")
)

// LoadAPIKey reads a key from the environment; no literal secret in source.
func LoadAPIKey() string {
	key := os.Getenv("KHEPRA_API_KEY")
	if key == "" {
		return ""
	}
	return key
}
