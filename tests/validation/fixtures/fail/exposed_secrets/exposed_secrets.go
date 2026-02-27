// Exposed secrets - should FAIL validation
package config

// ❌ FAIL: Hardcoded API keys and tokens
const (
	StripeAPIKey      = "sk_live_1234567890abcdefghijklmnop"
	TwilioAuthToken   = "ACabcdef1234567890abcdef1234567890"
	SupabaseSecretKey = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.secret"
	AWSSecretKey      = "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
)

// ❌ FAIL: Hardcoded passwords
var (
	DatabasePassword = "postgres_prod_password_123!"
	AdminPassword    = "SuperSecretAdmin2024"
)

// ❌ FAIL: Private keys embedded in code
func GetPrivateKey() string {
	privateKey := `-----BEGIN PRIVATE KEY-----
MIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC7VJT...
-----END PRIVATE KEY-----`
	return privateKey
}

// ❌ FAIL: API token in function
func InitializeServices() {
	apiToken := "ghp_1234567890abcdefghijklmnopqrstuvwxyz"
	_ = apiToken
}
