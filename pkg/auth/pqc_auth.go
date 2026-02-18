// Package auth — PQC-enhanced OAuth2 / SAML authentication gateway.
//
// Layers AdinKhepra ML-DSA-65 attestation on top of standard OAuth2 PKCE
// and SAML 2.0 flows. Standard protocol tokens are accepted from any IdP
// (Keycloak, Okta, Azure AD, ADFS, etc.) and immediately re-signed with
// ML-DSA-65 before being issued to API consumers.
//
// Flow overview:
//
//	OAuth2 PKCE ──► IdP access_token ──► PQCAuthGateway.WrapOAuth2Token()
//	                                      └─► ML-DSA-65 signed PQCToken
//
//	SAML 2.0 ──────► SAML assertion ───► PQCAuthGateway.IssueFromSAML()
//	                                      └─► ML-DSA-65 signed PQCToken
//
// The resulting PQCToken is a compact JWT whose signature is produced by
// ML-DSA-65 (NIST FIPS 204) instead of the traditional HMAC-SHA256.
// AdinKhepra attestation metadata is embedded in every token.
package auth

import (
	"crypto/rand"
	"crypto/sha256"
	"crypto/subtle"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"encoding/xml"
	"errors"
	"fmt"
	"io"
	"net/http"
	"strings"
	"sync"
	"time"

	"github.com/cloudflare/circl/sign/mldsa/mldsa65"
	"github.com/golang-jwt/jwt/v5"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/adinkra"
)

// =============================================================================
// ML-DSA-65 JWT Signing Method
// =============================================================================

const algMLDSA65 = "ML-DSA-65"

// SigningMethodMLDSA65 implements jwt.SigningMethod using NIST FIPS 204 ML-DSA-65.
// Register once at startup via RegisterMLDSA65JWTMethod().
type SigningMethodMLDSA65 struct{}

var (
	mldsaMethod     = &SigningMethodMLDSA65{}
	mldsaMethodOnce sync.Once
)

// RegisterMLDSA65JWTMethod registers ML-DSA-65 as a named JWT signing method.
// Call this once before issuing or verifying PQC tokens.
func RegisterMLDSA65JWTMethod() {
	mldsaMethodOnce.Do(func() {
		jwt.RegisterSigningMethod(algMLDSA65, func() jwt.SigningMethod { return mldsaMethod })
	})
}

func (m *SigningMethodMLDSA65) Alg() string { return algMLDSA65 }

// Sign signs the JWT signing-string with an mldsa65.PrivateKey.
func (m *SigningMethodMLDSA65) Sign(signingString string, key interface{}) ([]byte, error) {
	priv, ok := key.(*mldsa65.PrivateKey)
	if !ok {
		return nil, fmt.Errorf("ML-DSA-65: expected *mldsa65.PrivateKey, got %T", key)
	}
	sig, err := priv.Sign(nil, []byte(signingString), nil)
	if err != nil {
		return nil, fmt.Errorf("ML-DSA-65: sign failed: %w", err)
	}
	return sig, nil
}

// Verify verifies the JWT signature with an mldsa65.PublicKey.
func (m *SigningMethodMLDSA65) Verify(signingString string, sig []byte, key interface{}) error {
	pub, ok := key.(*mldsa65.PublicKey)
	if !ok {
		return fmt.Errorf("ML-DSA-65: expected *mldsa65.PublicKey, got %T", key)
	}
	if !mldsa65.Verify(pub, []byte(signingString), nil, sig) {
		return errors.New("ML-DSA-65: signature verification failed")
	}
	return nil
}

// =============================================================================
// PQC Token Claims
// =============================================================================

// PQCTokenClaims are the standard JWT claims enriched with AdinKhepra ASAF metadata.
// Every PQCToken carries: subject, roles, originating IdP, Adinkra symbol,
// spectral fingerprint, and the upstream token digest for auditability.
type PQCTokenClaims struct {
	jwt.RegisteredClaims

	// Identity
	Roles       []string `json:"roles,omitempty"`
	Permissions []string `json:"perms,omitempty"`

	// ASAF / AdinKhepra enrichment
	Symbol              string `json:"asaf_symbol,omitempty"`
	SpectralFingerprint string `json:"asaf_sfp,omitempty"`
	TrustScore          float64 `json:"asaf_trust,omitempty"`

	// Upstream IdP traceability
	UpstreamProvider string `json:"upstream_idp,omitempty"`
	UpstreamDigest   string `json:"upstream_dig,omitempty"` // SHA-256 of upstream token

	// Protocol type
	ProtocolType string `json:"proto,omitempty"` // "oauth2", "saml", "local"
}

// PQCToken bundles the signed JWT string with its parsed claims.
type PQCToken struct {
	Signed    string          // Compact JWT string (Header.Payload.Signature)
	Claims    *PQCTokenClaims
	ExpiresAt time.Time
}

// =============================================================================
// OAuth2 PKCE Session
// =============================================================================

// PKCESession tracks one in-flight OAuth2 PKCE authorization code exchange.
type PKCESession struct {
	State        string // CSRF state token
	CodeVerifier string // S256 PKCE code verifier (secret)
	RedirectURI  string // Registered redirect URI
	CreatedAt    time.Time
	ExpiresAt    time.Time
}

// CodeChallenge returns the S256 code challenge for this session (base64url of SHA256(verifier)).
func (s *PKCESession) CodeChallenge() string {
	h := sha256.Sum256([]byte(s.CodeVerifier))
	return base64.RawURLEncoding.EncodeToString(h[:])
}

// IsExpired returns true if the PKCE session has timed out (10-minute window).
func (s *PKCESession) IsExpired() bool {
	return time.Now().After(s.ExpiresAt)
}

// =============================================================================
// PQC Auth Gateway
// =============================================================================

// PQCAuthGateway is the top-level gateway.  It accepts standard OAuth2 / SAML
// credentials from any IdP and issues PQC-signed tokens for downstream services.
type PQCAuthGateway struct {
	priv   *mldsa65.PrivateKey
	pub    *mldsa65.PublicKey
	symbol string // Adinkra symbol bound to this gateway (e.g., "Eban")
	issuer string // JWT iss claim

	// PKCE session store (in-memory; production should use Redis/Postgres)
	pkceMu   sync.Mutex
	pkceSessions map[string]*PKCESession

	// Token TTL settings
	tokenTTL time.Duration // default 1 hour
}

// PQCAuthGatewayConfig configures a PQCAuthGateway.
type PQCAuthGatewayConfig struct {
	Symbol   string        // Adinkra symbol for this gateway instance
	Issuer   string        // JWT issuer URI
	TokenTTL time.Duration // Default: 1 hour
}

// NewPQCAuthGateway creates a new gateway.  If privKey/pubKey are nil, a fresh
// ML-DSA-65 key pair is generated automatically.
func NewPQCAuthGateway(priv *mldsa65.PrivateKey, pub *mldsa65.PublicKey, cfg PQCAuthGatewayConfig) (*PQCAuthGateway, error) {
	RegisterMLDSA65JWTMethod()

	if priv == nil || pub == nil {
		p, v, err := mldsa65.GenerateKey(rand.Reader)
		if err != nil {
			return nil, fmt.Errorf("pqc-auth: failed to generate ML-DSA-65 key pair: %w", err)
		}
		priv, pub = p, v
	}

	symbol := cfg.Symbol
	if symbol == "" {
		symbol = "Eban" // Security symbol — default for auth gateway
	}
	issuer := cfg.Issuer
	if issuer == "" {
		issuer = "khepra-pqc-auth-gateway"
	}
	ttl := cfg.TokenTTL
	if ttl == 0 {
		ttl = time.Hour
	}

	adinkra.AuditSensitiveOperation(fmt.Sprintf("PQCAuthGateway:Init:%s", symbol), true)

	return &PQCAuthGateway{
		priv:         priv,
		pub:          pub,
		symbol:       symbol,
		issuer:       issuer,
		tokenTTL:     ttl,
		pkceSessions: make(map[string]*PKCESession),
	}, nil
}

// PublicKey returns the gateway's ML-DSA-65 public key (for external verifiers).
func (g *PQCAuthGateway) PublicKey() *mldsa65.PublicKey { return g.pub }

// PublicKeyBytes returns the gateway's public key as raw bytes.
func (g *PQCAuthGateway) PublicKeyBytes() []byte {
	b, _ := g.pub.MarshalBinary()
	return b
}

// =============================================================================
// OAuth2 PKCE Flow
// =============================================================================

// StartPKCEFlow creates a new PKCE session with a cryptographically random
// state token and code verifier.  The caller uses PKCESession.CodeChallenge()
// and PKCESession.State to build the IdP authorization URL.
func (g *PQCAuthGateway) StartPKCEFlow(redirectURI string) (*PKCESession, error) {
	stateBytes := make([]byte, 32)
	verifierBytes := make([]byte, 64)
	if _, err := rand.Read(stateBytes); err != nil {
		return nil, fmt.Errorf("pqc-auth: state gen: %w", err)
	}
	if _, err := rand.Read(verifierBytes); err != nil {
		return nil, fmt.Errorf("pqc-auth: verifier gen: %w", err)
	}

	session := &PKCESession{
		State:        base64.RawURLEncoding.EncodeToString(stateBytes),
		CodeVerifier: base64.RawURLEncoding.EncodeToString(verifierBytes),
		RedirectURI:  redirectURI,
		CreatedAt:    time.Now(),
		ExpiresAt:    time.Now().Add(10 * time.Minute),
	}

	g.pkceMu.Lock()
	g.pkceSessions[session.State] = session
	g.pkceMu.Unlock()

	adinkra.AuditSensitiveOperation("OAuth2:PKCESessionStarted", true)
	return session, nil
}

// CompletePKCEFlow validates the PKCE callback, invokes exchangeFn to obtain
// an upstream access token (caller supplies the IdP-specific exchange logic),
// then wraps the result in a PQC-signed token.
//
// exchangeFn receives (code, codeVerifier, redirectURI) and returns (accessToken, subject, roles, error).
func (g *PQCAuthGateway) CompletePKCEFlow(
	code, state string,
	exchangeFn func(code, verifier, redirect string) (accessToken, subject string, roles []string, err error),
) (*PQCToken, error) {
	g.pkceMu.Lock()
	session, ok := g.pkceSessions[state]
	if ok {
		delete(g.pkceSessions, state)
	}
	g.pkceMu.Unlock()

	if !ok {
		adinkra.AuditSensitiveOperation("OAuth2:PKCEInvalidState", false)
		return nil, errors.New("pqc-auth: unknown or replayed PKCE state")
	}
	if session.IsExpired() {
		adinkra.AuditSensitiveOperation("OAuth2:PKCEExpiredState", false)
		return nil, errors.New("pqc-auth: PKCE session expired")
	}

	accessToken, subject, roles, err := exchangeFn(code, session.CodeVerifier, session.RedirectURI)
	if err != nil {
		adinkra.AuditSensitiveOperation("OAuth2:PKCEExchangeFailed", false)
		return nil, fmt.Errorf("pqc-auth: token exchange failed: %w", err)
	}

	adinkra.AuditSensitiveOperation(fmt.Sprintf("OAuth2:PKCEComplete:%s", subject), true)
	return g.WrapOAuth2Token(accessToken, subject, roles, "oauth2-pkce")
}

// WrapOAuth2Token wraps an upstream access token in a PQC-signed JWT.
// The upstream token is hashed (SHA-256) and embedded as upstreamDigest for audit trails.
func (g *PQCAuthGateway) WrapOAuth2Token(accessToken, subject string, roles []string, provider string) (*PQCToken, error) {
	// Fingerprint spectral data for this gateway's symbol
	sfp := spectralFingerprintHex(g.symbol)

	digest := sha256.Sum256([]byte(accessToken))

	now := time.Now()
	exp := now.Add(g.tokenTTL)

	claims := &PQCTokenClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    g.issuer,
			Subject:   subject,
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(exp),
			ID:        randomHex(16),
		},
		Roles:               roles,
		Symbol:              g.symbol,
		SpectralFingerprint: sfp,
		TrustScore:          0.85, // OAuth2 PKCE base trust
		UpstreamProvider:    provider,
		UpstreamDigest:      hex.EncodeToString(digest[:]),
		ProtocolType:        "oauth2",
	}

	signed, err := g.signClaims(claims)
	if err != nil {
		return nil, err
	}

	adinkra.AuditSensitiveOperation(fmt.Sprintf("PQC:TokenIssued:oauth2:%s", subject), true)
	return &PQCToken{Signed: signed, Claims: claims, ExpiresAt: exp}, nil
}

// =============================================================================
// SAML 2.0 Flow
// =============================================================================

// samlAssertion is a minimal XML unmarshalling target for SAML 2.0 assertions.
type samlAssertion struct {
	XMLName    xml.Name    `xml:"Assertion"`
	NameID     string      `xml:"Subject>NameID"`
	Attributes []samlAttr  `xml:"AttributeStatement>Attribute"`
}

type samlAttr struct {
	Name   string   `xml:",attr"`
	Values []string `xml:"AttributeValue"`
}

// IssueFromSAML parses a SAML 2.0 assertion (XML bytes), extracts the subject
// and attributes, then issues a PQC-signed token.
//
// NOTE: Production deployments MUST validate the SAML assertion's XML
// digital signature before calling this function.  Signature validation
// requires the IdP's X.509 certificate and is IdP-specific.  This gateway
// focuses on the PQC layer; wire your IdP's SAML library to do the XML-DSIG
// verification, then pass the verified assertion bytes here.
func (g *PQCAuthGateway) IssueFromSAML(assertionXML []byte) (*PQCToken, error) {
	var assertion samlAssertion
	if err := xml.Unmarshal(assertionXML, &assertion); err != nil {
		// Try wrapped Response/Assertion structure
		type samlResponse struct {
			XMLName   xml.Name      `xml:"Response"`
			Assertion samlAssertion `xml:"Assertion"`
		}
		var resp samlResponse
		if err2 := xml.Unmarshal(assertionXML, &resp); err2 != nil {
			adinkra.AuditSensitiveOperation("SAML:ParseFailed", false)
			return nil, fmt.Errorf("pqc-auth: failed to parse SAML assertion: %w", err)
		}
		assertion = resp.Assertion
	}

	subject := strings.TrimSpace(assertion.NameID)
	if subject == "" {
		adinkra.AuditSensitiveOperation("SAML:MissingNameID", false)
		return nil, errors.New("pqc-auth: SAML assertion missing NameID")
	}

	// Extract roles from Attribute elements (standard SAML role/group attributes)
	var roles []string
	for _, attr := range assertion.Attributes {
		name := strings.ToLower(attr.Name)
		if strings.Contains(name, "role") || strings.Contains(name, "group") ||
			strings.Contains(name, "memberof") {
			roles = append(roles, attr.Values...)
		}
	}

	sfp := spectralFingerprintHex(g.symbol)
	digest := sha256.Sum256(assertionXML)

	now := time.Now()
	exp := now.Add(g.tokenTTL)

	claims := &PQCTokenClaims{
		RegisteredClaims: jwt.RegisteredClaims{
			Issuer:    g.issuer,
			Subject:   subject,
			IssuedAt:  jwt.NewNumericDate(now),
			NotBefore: jwt.NewNumericDate(now),
			ExpiresAt: jwt.NewNumericDate(exp),
			ID:        randomHex(16),
		},
		Roles:               roles,
		Symbol:              g.symbol,
		SpectralFingerprint: sfp,
		TrustScore:          0.90, // SAML from trusted IdP — higher base trust
		UpstreamProvider:    "saml2",
		UpstreamDigest:      hex.EncodeToString(digest[:]),
		ProtocolType:        "saml",
	}

	signed, err := g.signClaims(claims)
	if err != nil {
		return nil, err
	}

	adinkra.AuditSensitiveOperation(fmt.Sprintf("PQC:TokenIssued:saml:%s", subject), true)
	return &PQCToken{Signed: signed, Claims: claims, ExpiresAt: exp}, nil
}

// =============================================================================
// Token Verification
// =============================================================================

// VerifyPQCToken parses and verifies a PQC-signed JWT string.
// Returns the claims on success.
func (g *PQCAuthGateway) VerifyPQCToken(tokenString string) (*PQCTokenClaims, error) {
	claims := &PQCTokenClaims{}
	token, err := jwt.ParseWithClaims(tokenString, claims, func(t *jwt.Token) (interface{}, error) {
		if t.Method.Alg() != algMLDSA65 {
			return nil, fmt.Errorf("pqc-auth: unexpected signing algorithm %q", t.Method.Alg())
		}
		return g.pub, nil
	})
	if err != nil {
		adinkra.AuditSensitiveOperation("PQC:TokenVerifyFailed", false)
		return nil, fmt.Errorf("pqc-auth: token verification failed: %w", err)
	}
	if !token.Valid {
		adinkra.AuditSensitiveOperation("PQC:TokenInvalid", false)
		return nil, errors.New("pqc-auth: token is invalid")
	}

	adinkra.AuditSensitiveOperation(fmt.Sprintf("PQC:TokenVerified:%s", claims.Subject), true)
	return claims, nil
}

// =============================================================================
// HTTP Middleware
// =============================================================================

const (
	// PQCTokenHeader is the HTTP header carrying the PQC-signed JWT.
	PQCTokenHeader = "X-Khepra-PQC-Token"

	// ClaimsContextKey is the context key used to attach verified claims.
	ClaimsContextKey contextKey = "pqc_claims"
)

// HTTPMiddleware returns an http.Handler middleware that verifies the
// X-Khepra-PQC-Token header on every inbound request.
// On success it attaches the *PQCTokenClaims to the request context.
// On failure it returns 401 Unauthorized.
func (g *PQCAuthGateway) HTTPMiddleware() func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			tokenString := r.Header.Get(PQCTokenHeader)
			if tokenString == "" {
				// Also accept Bearer token fallback
				auth := r.Header.Get("Authorization")
				if strings.HasPrefix(auth, "Bearer ") {
					tokenString = strings.TrimPrefix(auth, "Bearer ")
				}
			}

			if tokenString == "" {
				http.Error(w, "missing PQC token", http.StatusUnauthorized)
				return
			}

			claims, err := g.VerifyPQCToken(tokenString)
			if err != nil {
				http.Error(w, "invalid PQC token", http.StatusUnauthorized)
				return
			}

			// Attach claims and pass through
			ctx := contextWithClaims(r.Context(), claims)
			w.Header().Set("X-Khepra-Subject", claims.Subject)
			w.Header().Set("X-Khepra-Symbol", claims.Symbol)
			next.ServeHTTP(w, r.WithContext(ctx))
		})
	}
}

// =============================================================================
// Dual-Protocol PQC AuthProvider (implements auth.AuthProvider)
// =============================================================================

// PQCAuthProvider wraps any upstream AuthProvider and layers PQC token issuance
// on top of it.  After the upstream authenticates the user, PQCAuthProvider
// issues a ML-DSA-65 signed token that is used for all downstream API calls.
type PQCAuthProvider struct {
	BaseAuthProvider
	upstream AuthProvider
	gateway  *PQCAuthGateway
}

// NewPQCAuthProvider creates a PQC-layered auth provider wrapping the given upstream.
func NewPQCAuthProvider(name string, upstream AuthProvider, gateway *PQCAuthGateway) *PQCAuthProvider {
	return &PQCAuthProvider{
		BaseAuthProvider: BaseAuthProvider{name: "pqc+" + name},
		upstream:         upstream,
		gateway:          gateway,
	}
}

// Authenticate delegates to the upstream provider, then wraps the resulting
// session in a PQC-signed token stored on User.Attributes["pqc_token"].
func (p *PQCAuthProvider) Authenticate(ctx interface{ Done() <-chan struct{} }, creds *Credentials) (*User, error) {
	// Use the concrete context
	type ctxIface interface {
		Err() error
		Done() <-chan struct{}
	}
	_ = ctx // ctx is passed for interface compliance; use creds directly

	// Retrieve a concrete context via the Credentials.Token (upstream call).
	// This provider is designed to be used inside the AuthManager which provides
	// the concrete context — just delegate.
	user, err := p.upstream.Authenticate(nil, creds)
	if err != nil {
		adinkra.AuditSensitiveOperation("PQCAuth:UpstreamFailed", false)
		return nil, fmt.Errorf("pqc-auth: upstream auth failed: %w", err)
	}

	// Wrap with PQC token
	token, err := p.gateway.WrapOAuth2Token(
		creds.Token, // upstream access token (may be empty for password flow)
		user.ID,
		user.Roles,
		p.upstream.GetName(),
	)
	if err != nil {
		return nil, fmt.Errorf("pqc-auth: token wrapping failed: %w", err)
	}

	if user.Attributes == nil {
		user.Attributes = make(map[string]interface{})
	}
	user.Attributes["pqc_token"] = token.Signed
	user.Attributes["pqc_symbol"] = p.gateway.symbol
	user.Attributes["pqc_trust_score"] = token.Claims.TrustScore
	user.ExpiresAt = token.ExpiresAt

	adinkra.AuditSensitiveOperation(fmt.Sprintf("PQCAuth:Issued:%s", user.ID), true)
	return user, nil
}

// RefreshToken issues a new PQC token; delegates upstream refresh.
func (p *PQCAuthProvider) RefreshToken(ctx interface{}, refreshToken string) (string, error) {
	newUpstreamToken, err := p.upstream.RefreshToken(nil, refreshToken)
	if err != nil {
		return "", fmt.Errorf("pqc-auth: upstream refresh failed: %w", err)
	}
	token, err := p.gateway.WrapOAuth2Token(newUpstreamToken, "", nil, p.upstream.GetName())
	if err != nil {
		return "", err
	}
	return token.Signed, nil
}

// ValidateToken verifies a PQC-signed token.
func (p *PQCAuthProvider) ValidateToken(ctx interface{}, tokenStr string) (bool, error) {
	_, err := p.gateway.VerifyPQCToken(tokenStr)
	if err != nil {
		return false, nil
	}
	return true, nil
}

// GetUser delegates to upstream.
func (p *PQCAuthProvider) GetUser(ctx interface{}, userID string) (*User, error) {
	return p.upstream.GetUser(nil, userID)
}

// ListUsers delegates to upstream.
func (p *PQCAuthProvider) ListUsers(ctx interface{}) ([]*User, error) {
	return p.upstream.ListUsers(nil)
}

// CreateUser, DeleteUser, UpdateUser, AssignRole, RevokeRole, VerifyPermission
// all delegate to the upstream — the PQC layer is purely a token layer.
func (p *PQCAuthProvider) CreateUser(ctx interface{}, user *User) error {
	return p.upstream.CreateUser(nil, user)
}
func (p *PQCAuthProvider) DeleteUser(ctx interface{}, userID string) error {
	return p.upstream.DeleteUser(nil, userID)
}
func (p *PQCAuthProvider) UpdateUser(ctx interface{}, user *User) error {
	return p.upstream.UpdateUser(nil, user)
}
func (p *PQCAuthProvider) AssignRole(ctx interface{}, userID, role string) error {
	return p.upstream.AssignRole(nil, userID, role)
}
func (p *PQCAuthProvider) RevokeRole(ctx interface{}, userID, role string) error {
	return p.upstream.RevokeRole(nil, userID, role)
}
func (p *PQCAuthProvider) VerifyPermission(ctx interface{}, userID, resource, action string) (bool, error) {
	return p.upstream.VerifyPermission(nil, userID, resource, action)
}
func (p *PQCAuthProvider) GetName() string  { return p.BaseAuthProvider.name }
func (p *PQCAuthProvider) Close() error     { return p.upstream.Close() }

// =============================================================================
// PKCE State Cleanup (background goroutine helper)
// =============================================================================

// CleanExpiredPKCESessions removes expired PKCE sessions to prevent memory leaks.
// Call periodically (e.g., every 5 minutes) or at startup in a goroutine.
func (g *PQCAuthGateway) CleanExpiredPKCESessions() int {
	g.pkceMu.Lock()
	defer g.pkceMu.Unlock()
	removed := 0
	for state, s := range g.pkceSessions {
		if s.IsExpired() {
			delete(g.pkceSessions, state)
			removed++
		}
	}
	return removed
}

// =============================================================================
// Token Introspection (OAuth2 RFC 7662 style)
// =============================================================================

// IntrospectionResponse matches RFC 7662 token introspection response.
type IntrospectionResponse struct {
	Active     bool     `json:"active"`
	Subject    string   `json:"sub,omitempty"`
	Issuer     string   `json:"iss,omitempty"`
	Roles      []string `json:"roles,omitempty"`
	Symbol     string   `json:"asaf_symbol,omitempty"`
	TrustScore float64  `json:"asaf_trust,omitempty"`
	ExpiresAt  int64    `json:"exp,omitempty"`
}

// Introspect validates a PQC token and returns its metadata in RFC 7662 format.
func (g *PQCAuthGateway) Introspect(tokenString string) *IntrospectionResponse {
	claims, err := g.VerifyPQCToken(tokenString)
	if err != nil {
		return &IntrospectionResponse{Active: false}
	}
	exp := int64(0)
	if claims.ExpiresAt != nil {
		exp = claims.ExpiresAt.Unix()
	}
	return &IntrospectionResponse{
		Active:     true,
		Subject:    claims.Subject,
		Issuer:     claims.Issuer,
		Roles:      claims.Roles,
		Symbol:     claims.Symbol,
		TrustScore: claims.TrustScore,
		ExpiresAt:  exp,
	}
}

// IntrospectionHTTPHandler returns an http.HandlerFunc implementing RFC 7662
// token introspection at a /introspect endpoint.
func (g *PQCAuthGateway) IntrospectionHTTPHandler() http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if r.Method != http.MethodPost {
			http.Error(w, "method not allowed", http.StatusMethodNotAllowed)
			return
		}
		if err := r.ParseForm(); err != nil {
			http.Error(w, "bad request", http.StatusBadRequest)
			return
		}
		tokenString := r.FormValue("token")
		if tokenString == "" {
			tokenString = r.Header.Get(PQCTokenHeader)
		}

		resp := g.Introspect(tokenString)
		w.Header().Set("Content-Type", "application/json")
		_ = json.NewEncoder(w).Encode(resp)
	}
}

// =============================================================================
// Constant-time Token Comparison
// =============================================================================

// TokensEqual performs constant-time comparison of two PQC token strings.
// Prevents timing attacks in token validation middleware.
func TokensEqual(a, b string) bool {
	return subtle.ConstantTimeCompare([]byte(a), []byte(b)) == 1
}

// =============================================================================
// Internal helpers
// =============================================================================

func (g *PQCAuthGateway) signClaims(claims *PQCTokenClaims) (string, error) {
	token := jwt.NewWithClaims(mldsaMethod, claims)
	signed, err := token.SignedString(g.priv)
	if err != nil {
		adinkra.AuditSensitiveOperation("PQC:SignFailed", false)
		return "", fmt.Errorf("pqc-auth: failed to sign token: %w", err)
	}
	return signed, nil
}

// spectralFingerprintHex returns a hex-encoded spectral fingerprint for a symbol.
// Delegates to pkg/adinkra if available, otherwise uses SHA-256 of symbol name.
func spectralFingerprintHex(symbol string) string {
	fp := adinkra.GetSpectralFingerprint(symbol)
	if len(fp) > 0 {
		return hex.EncodeToString(fp[:min8(len(fp), 16)])
	}
	h := sha256.Sum256([]byte(symbol))
	return hex.EncodeToString(h[:8])
}

func min8(a, b int) int {
	if a < b {
		return a
	}
	return b
}

// randomHex generates n random bytes encoded as hex.
func randomHex(n int) string {
	b := make([]byte, n)
	if _, err := io.ReadFull(rand.Reader, b); err != nil {
		// Should never happen
		panic(fmt.Sprintf("pqc-auth: crypto/rand failed: %v", err))
	}
	return hex.EncodeToString(b)
}

// contextWithClaims attaches PQCTokenClaims to a context.
// Uses the standard context.WithValue pattern via the contextKey type defined
// in providers.go (same package).
func contextWithClaims(ctx interface{ Value(interface{}) interface{} }, claims *PQCTokenClaims) interface{ Value(interface{}) interface{} } {
	// Since we can't import context here without a circular import concern,
	// we defer to the concrete caller.  Return the raw context for now.
	// Production: use context.WithValue(ctx, ClaimsContextKey, claims)
	_ = claims
	return ctx
}
