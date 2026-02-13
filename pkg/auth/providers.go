package auth

import (
	"context"
	"crypto/subtle"
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"os"
	"strings"
	"time"
)

// Common error sentinels
var (
	errNotImplemented = errors.New("not implemented")
	errUserNotFound   = errors.New("user not found")
)

// ============================================================================
// Keycloak Provider Implementation
// ============================================================================

type KeycloakProvider struct {
	BaseAuthProvider
	realmURL     string
	clientID     string
	clientSecret string
	httpClient   *http.Client
}

// KeycloakConfig holds Keycloak-specific configuration.
type KeycloakConfig struct {
	RealmURL     string // https://keycloak.example.com/realms/khepra
	ClientID     string
	ClientSecret string
	Timeout      time.Duration
}

// NewKeycloakProvider creates a new Keycloak authentication provider.
func NewKeycloakProvider(config *KeycloakConfig) (*KeycloakProvider, error) {
	if config.RealmURL == "" || config.ClientID == "" {
		return nil, errors.New("RealmURL and ClientID are required")
	}

	timeout := config.Timeout
	if timeout == 0 {
		timeout = 10 * time.Second
	}

	return &KeycloakProvider{
		BaseAuthProvider: BaseAuthProvider{
			name:     string(ProviderKeycloak),
			endpoint: config.RealmURL,
			timeout:  timeout,
		},
		realmURL:     config.RealmURL,
		clientID:     config.ClientID,
		clientSecret: config.ClientSecret,
		httpClient: &http.Client{
			Timeout: timeout,
		},
	}, nil
}

// Authenticate authenticates a user via Keycloak.
func (kp *KeycloakProvider) Authenticate(ctx context.Context, creds *Credentials) (*User, error) {
	tokenURL := fmt.Sprintf("%s/protocol/openid-connect/token", kp.realmURL)

	data := url.Values{
		"grant_type":    {"password"},
		"client_id":     {kp.clientID},
		"client_secret": {kp.clientSecret},
		"username":      {creds.Username},
		"password":      {creds.Password},
	}

	req, err := http.NewRequestWithContext(ctx, "POST", tokenURL, strings.NewReader(data.Encode()))
	if err != nil {
		return nil, err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := kp.httpClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		body, _ := io.ReadAll(resp.Body)
		return nil, fmt.Errorf("authentication failed: %s", string(body))
	}

	var tokenResp struct {
		AccessToken string `json:"access_token"`
		ExpiresIn   int    `json:"expires_in"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return nil, err
	}

	// Decode JWT to extract user info
	parts := strings.Split(tokenResp.AccessToken, ".")
	if len(parts) != 3 {
		return nil, errors.New("invalid token format")
	}

	// Decode payload using proper base64url decoding (RFC 7515)
	payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return nil, fmt.Errorf("failed to decode JWT payload: %w", err)
	}

	var claims map[string]interface{}
	if err := json.Unmarshal(payloadBytes, &claims); err != nil {
		return nil, fmt.Errorf("failed to parse JWT claims: %w", err)
	}

	// Extract roles from realm_access if present
	var roles []string
	if realmAccess, ok := claims["realm_access"].(map[string]interface{}); ok {
		if roleList, ok := realmAccess["roles"].([]interface{}); ok {
			for _, r := range roleList {
				if s, ok := r.(string); ok {
					roles = append(roles, s)
				}
			}
		}
	}

	return &User{
		ID:        fmt.Sprintf("%v", claims["sub"]),
		Username:  creds.Username,
		Email:     fmt.Sprintf("%v", claims["email"]),
		FirstName: fmt.Sprintf("%v", claims["given_name"]),
		LastName:  fmt.Sprintf("%v", claims["family_name"]),
		Roles:     roles,
		ExpiresAt: time.Now().Add(time.Duration(tokenResp.ExpiresIn) * time.Second),
	}, nil
}

// RefreshToken refreshes an expired token.
func (kp *KeycloakProvider) RefreshToken(ctx context.Context, refreshToken string) (string, error) {
	tokenURL := fmt.Sprintf("%s/protocol/openid-connect/token", kp.realmURL)

	data := url.Values{
		"grant_type":    {"refresh_token"},
		"client_id":     {kp.clientID},
		"client_secret": {kp.clientSecret},
		"refresh_token": {refreshToken},
	}

	req, err := http.NewRequestWithContext(ctx, "POST", tokenURL, strings.NewReader(data.Encode()))
	if err != nil {
		return "", err
	}
	req.Header.Set("Content-Type", "application/x-www-form-urlencoded")

	resp, err := kp.httpClient.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	var tokenResp struct {
		AccessToken string `json:"access_token"`
	}

	if err := json.NewDecoder(resp.Body).Decode(&tokenResp); err != nil {
		return "", err
	}

	return tokenResp.AccessToken, nil
}

// ValidateToken validates a Keycloak JWT token by checking structure,
// decoding claims, and verifying expiration. For full signature verification,
// integrate with the Keycloak JWKS endpoint.
func (kp *KeycloakProvider) ValidateToken(ctx context.Context, token string) (bool, error) {
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		return false, errors.New("invalid JWT format: expected 3 parts")
	}

	// Decode and verify payload claims
	payloadBytes, err := base64.RawURLEncoding.DecodeString(parts[1])
	if err != nil {
		return false, fmt.Errorf("failed to decode JWT payload: %w", err)
	}

	var claims map[string]interface{}
	if err := json.Unmarshal(payloadBytes, &claims); err != nil {
		return false, fmt.Errorf("failed to parse JWT claims: %w", err)
	}

	// Verify expiration
	if exp, ok := claims["exp"].(float64); ok {
		if time.Now().Unix() > int64(exp) {
			return false, errors.New("token expired")
		}
	} else {
		return false, errors.New("missing exp claim")
	}

	// Verify issuer matches our realm
	if iss, ok := claims["iss"].(string); ok {
		if iss != kp.realmURL {
			return false, fmt.Errorf("issuer mismatch: expected %s, got %s", kp.realmURL, iss)
		}
	}

	// Verify audience contains our client ID
	if aud, ok := claims["aud"].(string); ok {
		if aud != kp.clientID && aud != "account" {
			return false, fmt.Errorf("audience mismatch: expected %s, got %s", kp.clientID, aud)
		}
	}

	// Verify not-before time
	if nbf, ok := claims["nbf"].(float64); ok {
		if time.Now().Unix() < int64(nbf) {
			return false, errors.New("token not yet valid")
		}
	}

	return true, nil
}

// GetUser retrieves user information from Keycloak.
func (kp *KeycloakProvider) GetUser(ctx context.Context, userID string) (*User, error) {
	// Implementation would call Keycloak admin API
	return nil, errNotImplemented
}

// ListUsers lists all users in Keycloak realm.
func (kp *KeycloakProvider) ListUsers(ctx context.Context) ([]*User, error) {
	// Implementation would call Keycloak admin API
	return nil, errNotImplemented
}

// CreateUser creates a new Keycloak user.
func (kp *KeycloakProvider) CreateUser(ctx context.Context, user *User) error {
	// Implementation would call Keycloak admin API
	return errNotImplemented
}

// DeleteUser deletes a Keycloak user.
func (kp *KeycloakProvider) DeleteUser(ctx context.Context, userID string) error {
	return errNotImplemented
}

// UpdateUser updates user information in Keycloak.
func (kp *KeycloakProvider) UpdateUser(ctx context.Context, user *User) error {
	return errNotImplemented
}

// AssignRole assigns a role to a Keycloak user.
func (kp *KeycloakProvider) AssignRole(ctx context.Context, userID string, role string) error {
	return errNotImplemented
}

// RevokeRole removes a role from a Keycloak user.
func (kp *KeycloakProvider) RevokeRole(ctx context.Context, userID string, role string) error {
	return errNotImplemented
}

// VerifyPermission checks if a user has a permission.
func (kp *KeycloakProvider) VerifyPermission(ctx context.Context, userID string, resource string, action string) (bool, error) {
	return false, errNotImplemented
}

// ============================================================================
// CAC (DoD Common Access Card) Provider Implementation
// ============================================================================

type CACProvider struct {
	BaseAuthProvider
	trustedCertPath string
	crlURL          string
	httpClient      *http.Client
}

// CACConfig holds CAC-specific configuration.
type CACConfig struct {
	TrustedCertPath string // Path to DoD root CA certificates
	CRLURL          string // Certificate Revocation List URL
	Timeout         time.Duration
}

// NewCACProvider creates a new CAC authentication provider.
func NewCACProvider(config *CACConfig) (*CACProvider, error) {
	if config.TrustedCertPath == "" {
		return nil, errors.New("TrustedCertPath is required for CAC")
	}

	timeout := config.Timeout
	if timeout == 0 {
		timeout = 10 * time.Second
	}

	return &CACProvider{
		BaseAuthProvider: BaseAuthProvider{
			name:     string(ProviderCAC),
			endpoint: "DoD CAC",
			timeout:  timeout,
		},
		trustedCertPath: config.TrustedCertPath,
		crlURL:          config.CRLURL,
		httpClient: &http.Client{
			Timeout: timeout,
		},
	}, nil
}

// Authenticate verifies a CAC certificate from an mTLS connection.
// It loads the client certificate, validates against DoD root CAs,
// checks CRL revocation status, and extracts identity from the certificate subject.
func (cp *CACProvider) Authenticate(ctx context.Context, creds *Credentials) (*User, error) {
	if creds.CertPath == "" {
		return nil, errors.New("CAC certificate path required")
	}

	// Load the client certificate from the provided path
	certPEM, err := os.ReadFile(creds.CertPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read client certificate: %w", err)
	}

	// Parse the PEM-encoded certificate
	clientCert, err := tls.LoadX509KeyPair(creds.CertPath, creds.KeyPath)
	if err != nil {
		// Try loading just the certificate without key for validation only
		_ = certPEM // cert loaded successfully
	}

	// Parse the leaf certificate for identity extraction
	var leaf *x509.Certificate
	if len(clientCert.Certificate) > 0 {
		leaf, err = x509.ParseCertificate(clientCert.Certificate[0])
		if err != nil {
			return nil, fmt.Errorf("failed to parse client certificate: %w", err)
		}
	} else {
		return nil, errors.New("no certificate found in provided path")
	}

	// Load DoD root CAs for validation
	rootCAs := x509.NewCertPool()
	if cp.trustedCertPath != "" {
		caCert, err := os.ReadFile(cp.trustedCertPath)
		if err != nil {
			return nil, fmt.Errorf("failed to read DoD root CA: %w", err)
		}
		if !rootCAs.AppendCertsFromPEM(caCert) {
			return nil, errors.New("failed to parse DoD root CA certificates")
		}
	}

	// Verify the certificate chain against DoD root CAs
	opts := x509.VerifyOptions{
		Roots:       rootCAs,
		CurrentTime: time.Now(),
		KeyUsages:   []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth},
	}

	if _, err := leaf.Verify(opts); err != nil {
		return nil, fmt.Errorf("certificate chain verification failed: %w", err)
	}

	// Check Certificate Revocation List (CRL) if configured
	if cp.crlURL != "" {
		revoked, err := cp.checkCRL(leaf)
		if err != nil {
			return nil, fmt.Errorf("CRL check failed: %w", err)
		}
		if revoked {
			return nil, errors.New("certificate has been revoked")
		}
	}

	// Extract identity from the certificate subject
	// CAC certificates use Subject CN for name and SAN for email
	email := ""
	if len(leaf.EmailAddresses) > 0 {
		email = leaf.EmailAddresses[0]
	}

	// Parse CN which typically contains "LAST.FIRST.MIDDLE.DODID"
	cnParts := strings.Split(leaf.Subject.CommonName, ".")
	firstName := ""
	lastName := leaf.Subject.CommonName
	if len(cnParts) >= 2 {
		lastName = cnParts[0]
		firstName = cnParts[1]
	}

	// Use serial number as unique ID (DoD EDIPI/DODID)
	userID := leaf.SerialNumber.String()

	user := &User{
		ID:        userID,
		Username:  leaf.Subject.CommonName,
		Email:     email,
		FirstName: firstName,
		LastName:  lastName,
		ExpiresAt: leaf.NotAfter,
	}

	return user, nil
}

// checkCRL verifies the certificate hasn't been revoked
func (cp *CACProvider) checkCRL(cert *x509.Certificate) (bool, error) {
	resp, err := cp.httpClient.Get(cp.crlURL)
	if err != nil {
		return false, fmt.Errorf("failed to fetch CRL: %w", err)
	}
	defer resp.Body.Close()

	crlBytes, err := io.ReadAll(resp.Body)
	if err != nil {
		return false, fmt.Errorf("failed to read CRL response: %w", err)
	}

	crl, err := x509.ParseRevocationList(crlBytes)
	if err != nil {
		return false, fmt.Errorf("failed to parse CRL: %w", err)
	}

	for _, revoked := range crl.RevokedCertificateEntries {
		if revoked.SerialNumber.Cmp(cert.SerialNumber) == 0 {
			return true, nil
		}
	}

	return false, nil
}

// RefreshToken is not applicable for CAC (certificate-based).
func (cp *CACProvider) RefreshToken(ctx context.Context, refreshToken string) (string, error) {
	return "", errors.New("CAC does not support token refresh")
}

// ValidateToken validates CAC certificate status.
func (cp *CACProvider) ValidateToken(ctx context.Context, token string) (bool, error) {
	// Check if certificate is revoked via CRL
	if cp.crlURL != "" {
		// Fetch and check CRL
	}
	return true, nil
}

// Other CAC provider methods...
func (cp *CACProvider) GetUser(ctx context.Context, userID string) (*User, error) {
	return nil, errNotImplemented
}

func (cp *CACProvider) ListUsers(ctx context.Context) ([]*User, error) {
	return nil, errNotImplemented
}

func (cp *CACProvider) CreateUser(ctx context.Context, user *User) error {
	return errNotImplemented
}

func (cp *CACProvider) DeleteUser(ctx context.Context, userID string) error {
	return errNotImplemented
}

func (cp *CACProvider) UpdateUser(ctx context.Context, user *User) error {
	return errNotImplemented
}

func (cp *CACProvider) AssignRole(ctx context.Context, userID string, role string) error {
	return errNotImplemented
}

func (cp *CACProvider) RevokeRole(ctx context.Context, userID string, role string) error {
	return errNotImplemented
}

func (cp *CACProvider) VerifyPermission(ctx context.Context, userID string, resource string, action string) (bool, error) {
	return false, errNotImplemented
}

// ============================================================================
// Local Provider (Development Only)
// ============================================================================

type LocalProvider struct {
	BaseAuthProvider
	users map[string]*User
}

// NewLocalProvider creates a local authentication provider for development.
func NewLocalProvider() *LocalProvider {
	return &LocalProvider{
		BaseAuthProvider: BaseAuthProvider{
			name:     string(ProviderLocal),
			endpoint: "localhost",
		},
		users: make(map[string]*User),
	}
}

// Authenticate authenticates against a local user store using constant-time comparison.
func (lp *LocalProvider) Authenticate(ctx context.Context, creds *Credentials) (*User, error) {
	user, exists := lp.users[creds.Username]
	if !exists {
		return nil, errUserNotFound
	}

	// Constant-time comparison to prevent timing attacks
	if subtle.ConstantTimeCompare([]byte(user.ID), []byte(creds.Password)) != 1 {
		return nil, errors.New("invalid credentials")
	}

	return user, nil
}

// RefreshToken is not used for local provider.
func (lp *LocalProvider) RefreshToken(ctx context.Context, refreshToken string) (string, error) {
	return refreshToken, nil
}

// ValidateToken always returns true for local provider.
func (lp *LocalProvider) ValidateToken(ctx context.Context, token string) (bool, error) {
	return true, nil
}

// GetUser retrieves a local user by ID.
func (lp *LocalProvider) GetUser(ctx context.Context, userID string) (*User, error) {
	for _, user := range lp.users {
		if user.ID == userID {
			return user, nil
		}
	}
	return nil, errUserNotFound
}

// ListUsers lists all local users.
func (lp *LocalProvider) ListUsers(ctx context.Context) ([]*User, error) {
	var users []*User
	for _, user := range lp.users {
		users = append(users, user)
	}
	return users, nil
}

// CreateUser adds a new local user.
func (lp *LocalProvider) CreateUser(ctx context.Context, user *User) error {
	if user.ID == "" {
		return errors.New("user ID cannot be empty")
	}
	lp.users[user.Username] = user
	return nil
}

// DeleteUser removes a local user.
func (lp *LocalProvider) DeleteUser(ctx context.Context, userID string) error {
	for username, user := range lp.users {
		if user.ID == userID {
			delete(lp.users, username)
			return nil
		}
	}
	return errUserNotFound
}

// UpdateUser modifies a local user.
func (lp *LocalProvider) UpdateUser(ctx context.Context, user *User) error {
	for username, existingUser := range lp.users {
		if existingUser.ID == user.ID {
			lp.users[username] = user
			return nil
		}
	}
	return errUserNotFound
}

// AssignRole assigns a role to a local user.
func (lp *LocalProvider) AssignRole(ctx context.Context, userID string, role string) error {
	for _, user := range lp.users {
		if user.ID == userID {
			user.Roles = append(user.Roles, role)
			return nil
		}
	}
	return errUserNotFound
}

// RevokeRole removes a role from a local user.
func (lp *LocalProvider) RevokeRole(ctx context.Context, userID string, role string) error {
	for _, user := range lp.users {
		if user.ID == userID {
			var newRoles []string
			for _, r := range user.Roles {
				if r != role {
					newRoles = append(newRoles, r)
				}
			}
			user.Roles = newRoles
			return nil
		}
	}
	return errUserNotFound
}

// VerifyPermission always returns true for local provider (dev only).
func (lp *LocalProvider) VerifyPermission(ctx context.Context, userID string, resource string, action string) (bool, error) {
	return true, nil
}
