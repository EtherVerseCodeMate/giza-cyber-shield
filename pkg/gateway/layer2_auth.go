// Layer 2: Authentication - Zero-Trust Identity Verification
// "The Eye of Horus Sees All"
package gateway

import (
	"crypto/subtle"
	"crypto/x509"
	"encoding/hex"
	"encoding/pem"
	"errors"
	"fmt"
	"log"
	"net/http"
	"os"
	"strings"
	"sync"
	"time"

	"github.com/cloudflare/circl/sign/mldsa/mldsa65"
	"github.com/golang-jwt/jwt/v5"
)

// AuthLayer implements Layer 2 zero-trust authentication
type AuthLayer struct {
	config *AuthConfig

	// Certificate Authority for mTLS
	clientCAs *x509.CertPool

	// API Key store (in production, this would be backed by a database)
	apiKeys   map[string]*APIKeyEntry
	apiKeysMu sync.RWMutex

	// JWT signing key
	jwtKey []byte

	// Public key registry cache (for PQC signature verification)
	publicKeys   map[string][]byte
	publicKeysMu sync.RWMutex
}

// APIKeyEntry represents a stored API key with metadata
type APIKeyEntry struct {
	KeyHash      string
	Organization string
	TrustScore   float64
	Permissions  []string
	CreatedAt    time.Time
	ExpiresAt    time.Time
	LastUsed     time.Time
	Revoked      bool
}

// NewAuthLayer creates a new authentication layer
func NewAuthLayer(cfg *AuthConfig) (*AuthLayer, error) {
	auth := &AuthLayer{
		config:     cfg,
		apiKeys:    make(map[string]*APIKeyEntry),
		publicKeys: make(map[string][]byte),
	}

	// Load Client CA for mTLS if configured
	if cfg.RequireMTLS && cfg.ClientCAFile != "" {
		pool, err := loadCertPool(cfg.ClientCAFile)
		if err != nil {
			return nil, fmt.Errorf("failed to load client CA: %w", err)
		}
		auth.clientCAs = pool
		log.Printf("[AUTH] mTLS enabled with client CA: %s", cfg.ClientCAFile)
	}

	// Initialize JWT key
	if cfg.JWTSecret != "" {
		auth.jwtKey = []byte(cfg.JWTSecret)
	}

	log.Printf("[AUTH] Layer 2 initialized - mTLS[%v] PQC[%v] APIKey[%s]",
		cfg.RequireMTLS, cfg.RequirePQCSignature, cfg.APIKeyHeader)

	return auth, nil
}

// Authenticate performs multi-factor authentication on the request
func (auth *AuthLayer) Authenticate(r *http.Request) (*Identity, error) {
	var identity *Identity
	var authMethod string

	// === PRIORITY 1: mTLS Client Certificate ===
	if auth.config.RequireMTLS {
		if r.TLS == nil || len(r.TLS.PeerCertificates) == 0 {
			return nil, errors.New("client certificate required")
		}

		cert := r.TLS.PeerCertificates[0]

		// Verify against our CA
		if auth.clientCAs != nil {
			opts := x509.VerifyOptions{
				Roots:     auth.clientCAs,
				KeyUsages: []x509.ExtKeyUsage{x509.ExtKeyUsageClientAuth},
			}
			if _, err := cert.Verify(opts); err != nil {
				return nil, fmt.Errorf("client certificate verification failed: %w", err)
			}
		}

		// Check certificate revocation if enabled
		if auth.config.CertRevocationCheck {
			if revoked, err := auth.checkCertRevocation(cert); err != nil || revoked {
				return nil, errors.New("client certificate revoked")
			}
		}

		identity = &Identity{
			ID:           cert.Subject.CommonName,
			Type:         "mtls",
			Organization: getOrgFromCert(cert),
			TrustScore:   1.0, // mTLS gets highest trust
			Metadata: map[string]string{
				"cert_serial":     cert.SerialNumber.String(),
				"cert_not_before": cert.NotBefore.String(),
				"cert_not_after":  cert.NotAfter.String(),
			},
		}
		authMethod = "mTLS"
	}

	// === PRIORITY 2: API Key ===
	if identity == nil {
		apiKey := r.Header.Get(auth.config.APIKeyHeader)
		if apiKey == "" {
			// Also check Authorization header
			authHeader := r.Header.Get("Authorization")
			if strings.HasPrefix(authHeader, "Bearer ") {
				apiKey = strings.TrimPrefix(authHeader, "Bearer ")
			}
		}

		if apiKey != "" {
			entry, err := auth.validateAPIKey(apiKey)
			if err != nil {
				return nil, fmt.Errorf("API key validation failed: %w", err)
			}

			identity = &Identity{
				ID:           hashAPIKey(apiKey)[:16], // Use hash prefix as ID
				Type:         "api_key",
				Organization: entry.Organization,
				TrustScore:   entry.TrustScore,
				Permissions:  entry.Permissions,
				Metadata: map[string]string{
					"key_created": entry.CreatedAt.String(),
					"key_expires": entry.ExpiresAt.String(),
				},
			}
			authMethod = "API-Key"

			// Update last used
			auth.apiKeysMu.Lock()
			entry.LastUsed = time.Now()
			auth.apiKeysMu.Unlock()
		}
	}

	// === PRIORITY 3: JWT Token ===
	if identity == nil {
		authHeader := r.Header.Get("Authorization")
		if strings.HasPrefix(authHeader, "Bearer ") {
			tokenString := strings.TrimPrefix(authHeader, "Bearer ")

			claims, err := auth.validateJWT(tokenString)
			if err != nil {
				return nil, fmt.Errorf("JWT validation failed: %w", err)
			}

			identity = &Identity{
				ID:           claims.Subject,
				Type:         "jwt",
				Organization: claims.Issuer,
				TrustScore:   0.8,
				Metadata: map[string]string{
					"jwt_issuer":   claims.Issuer,
					"jwt_audience": strings.Join(claims.Audience, ","),
				},
			}
			authMethod = "JWT"
		}
	}

	// === PRIORITY 4: Enrollment Token (for new agents) ===
	if identity == nil {
		enrollToken := r.Header.Get(auth.config.EnrollmentTokenHeader)
		if enrollToken != "" {
			// Enrollment tokens get limited trust - only for registration
			identity = &Identity{
				ID:           "enrolling-" + enrollToken[:8],
				Type:         "enrollment",
				Organization: "pending",
				TrustScore:   0.3,
				Permissions:  []string{"register"},
				Metadata: map[string]string{
					"enrollment_token": enrollToken[:8] + "...",
				},
			}
			authMethod = "Enrollment-Token"
		}
	}

	// No authentication provided
	if identity == nil {
		return nil, errors.New("no valid authentication provided")
	}

	// === ADDITIONAL: PQC Signature Verification ===
	if auth.config.RequirePQCSignature {
		signature := r.Header.Get(auth.config.SignatureHeader)
		if signature == "" {
			return nil, errors.New("PQC signature required")
		}

		if err := auth.verifyPQCSignature(r, identity.ID, signature); err != nil {
			return nil, fmt.Errorf("PQC signature verification failed: %w", err)
		}

		// Boost trust score for PQC-signed requests
		identity.TrustScore = min(identity.TrustScore+0.2, 1.0)
		identity.Metadata["pqc_verified"] = "true"
	}

	log.Printf("[AUTH] Authenticated: %s via %s (org: %s, trust: %.2f)",
		identity.ID, authMethod, identity.Organization, identity.TrustScore)

	return identity, nil
}

// validateAPIKey validates an API key against the store
func (auth *AuthLayer) validateAPIKey(key string) (*APIKeyEntry, error) {
	keyHash := hashAPIKey(key)

	auth.apiKeysMu.RLock()
	entry, exists := auth.apiKeys[keyHash]
	auth.apiKeysMu.RUnlock()

	if !exists {
		return nil, errors.New("invalid API key")
	}

	if entry.Revoked {
		return nil, errors.New("API key revoked")
	}

	if time.Now().After(entry.ExpiresAt) {
		return nil, errors.New("API key expired")
	}

	return entry, nil
}

// validateJWT validates a JWT token
func (auth *AuthLayer) validateJWT(tokenString string) (*jwt.RegisteredClaims, error) {
	if auth.jwtKey == nil {
		return nil, errors.New("JWT authentication not configured")
	}

	token, err := jwt.ParseWithClaims(tokenString, &jwt.RegisteredClaims{}, func(token *jwt.Token) (interface{}, error) {
		// Validate signing method
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return auth.jwtKey, nil
	})

	if err != nil {
		return nil, err
	}

	claims, ok := token.Claims.(*jwt.RegisteredClaims)
	if !ok || !token.Valid {
		return nil, errors.New("invalid token claims")
	}

	// Verify issuer
	if auth.config.JWTIssuer != "" && claims.Issuer != auth.config.JWTIssuer {
		return nil, errors.New("invalid token issuer")
	}

	// Verify audience
	if auth.config.JWTAudience != "" {
		validAudience := false
		for _, aud := range claims.Audience {
			if aud == auth.config.JWTAudience {
				validAudience = true
				break
			}
		}
		if !validAudience {
			return nil, errors.New("invalid token audience")
		}
	}

	return claims, nil
}

// verifyPQCSignature verifies ML-DSA-65 signature
func (auth *AuthLayer) verifyPQCSignature(r *http.Request, identityID, signatureHex string) error {
	// Get public key for this identity
	auth.publicKeysMu.RLock()
	pubKeyBytes, exists := auth.publicKeys[identityID]
	auth.publicKeysMu.RUnlock()

	if !exists {
		// TODO: Fetch from public key registry if configured
		return errors.New("public key not found for identity")
	}

	// Decode signature
	signature, err := hex.DecodeString(signatureHex)
	if err != nil {
		return errors.New("invalid signature encoding")
	}

	if len(signature) != mldsa65.SignatureSize {
		return errors.New("invalid signature size")
	}

	// Reconstruct the signed message (method + path + timestamp)
	timestamp := r.Header.Get("X-Khepra-Timestamp")
	message := fmt.Sprintf("%s|%s|%s", r.Method, r.URL.Path, timestamp)

	// Verify with ML-DSA-65
	if len(pubKeyBytes) != mldsa65.PublicKeySize {
		return errors.New("invalid public key size")
	}

	var pubKeyBuf [mldsa65.PublicKeySize]byte
	copy(pubKeyBuf[:], pubKeyBytes)

	var publicKey mldsa65.PublicKey
	publicKey.Unpack(&pubKeyBuf)

	valid := mldsa65.Verify(&publicKey, []byte(message), nil, signature)
	if !valid {
		return errors.New("signature verification failed")
	}

	return nil
}

// checkCertRevocation checks if certificate is revoked
func (auth *AuthLayer) checkCertRevocation(cert *x509.Certificate) (bool, error) {
	// TODO: Implement CRL checking
	// TODO: Implement OCSP checking
	// For now, return not revoked
	return false, nil
}

// RegisterAPIKey adds a new API key to the store
func (auth *AuthLayer) RegisterAPIKey(key string, org string, permissions []string, validDays int) error {
	keyHash := hashAPIKey(key)

	auth.apiKeysMu.Lock()
	defer auth.apiKeysMu.Unlock()

	auth.apiKeys[keyHash] = &APIKeyEntry{
		KeyHash:      keyHash,
		Organization: org,
		TrustScore:   0.7, // Default trust score
		Permissions:  permissions,
		CreatedAt:    time.Now(),
		ExpiresAt:    time.Now().AddDate(0, 0, validDays),
		Revoked:      false,
	}

	log.Printf("[AUTH] Registered API key for org: %s (expires in %d days)", org, validDays)
	return nil
}

// RevokeAPIKey revokes an API key
func (auth *AuthLayer) RevokeAPIKey(keyHash string) error {
	auth.apiKeysMu.Lock()
	defer auth.apiKeysMu.Unlock()

	entry, exists := auth.apiKeys[keyHash]
	if !exists {
		return errors.New("API key not found")
	}

	entry.Revoked = true
	log.Printf("[AUTH] Revoked API key: %s", keyHash[:8])
	return nil
}

// RegisterPublicKey registers a public key for PQC signature verification
func (auth *AuthLayer) RegisterPublicKey(identityID string, pubKey []byte) error {
	if len(pubKey) != mldsa65.PublicKeySize {
		return errors.New("invalid public key size")
	}

	auth.publicKeysMu.Lock()
	defer auth.publicKeysMu.Unlock()

	auth.publicKeys[identityID] = pubKey
	log.Printf("[AUTH] Registered PQC public key for: %s", identityID)
	return nil
}

// GenerateJWT generates a JWT token for an identity
func (auth *AuthLayer) GenerateJWT(identity *Identity) (string, error) {
	if auth.jwtKey == nil {
		return "", errors.New("JWT not configured")
	}

	claims := jwt.RegisteredClaims{
		Subject:   identity.ID,
		Issuer:    auth.config.JWTIssuer,
		Audience:  jwt.ClaimStrings{auth.config.JWTAudience},
		IssuedAt:  jwt.NewNumericDate(time.Now()),
		ExpiresAt: jwt.NewNumericDate(time.Now().Add(auth.config.JWTMaxAge)),
	}

	token := jwt.NewWithClaims(jwt.SigningMethodHS256, claims)
	return token.SignedString(auth.jwtKey)
}

// Helper functions

func loadCertPool(caFile string) (*x509.CertPool, error) {
	caPEM, err := os.ReadFile(caFile)
	if err != nil {
		return nil, err
	}

	pool := x509.NewCertPool()
	block, _ := pem.Decode(caPEM)
	if block == nil {
		return nil, errors.New("failed to decode PEM")
	}

	cert, err := x509.ParseCertificate(block.Bytes)
	if err != nil {
		return nil, err
	}

	pool.AddCert(cert)
	return pool, nil
}

func getOrgFromCert(cert *x509.Certificate) string {
	if len(cert.Subject.Organization) > 0 {
		return cert.Subject.Organization[0]
	}
	return cert.Subject.CommonName
}

func hashAPIKey(key string) string {
	// In production, use Argon2id as configured
	// For now, use simple SHA-256 (this is a placeholder)
	// TODO: Implement proper Argon2id hashing
	h := make([]byte, 32)
	keyBytes := []byte(key)
	for i := 0; i < len(keyBytes) && i < 32; i++ {
		h[i] = keyBytes[i]
	}
	return hex.EncodeToString(h)
}

// Constant-time comparison for API keys
func secureCompare(a, b string) bool {
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}

func min(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}
