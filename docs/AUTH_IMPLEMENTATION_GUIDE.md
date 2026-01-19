# Authentication Abstraction Pattern Implementation

## Overview

The authentication abstraction provides a unified interface for multiple authentication providers:
- **Keycloak** - Enterprise OIDC/SAML provider
- **Okta** - Cloud identity management
- **CAC** - DoD Common Access Card (certificate-based)
- **Azure AD** - Microsoft identity platform
- **Google** - Google OAuth2
- **Local** - Development/testing provider

## Architecture

```
┌─────────────────────────────────────────┐
│          Application Layer              │
│      (DAG, Attestation, Scanning)       │
└────────────────┬────────────────────────┘
                 │
         ┌───────▼────────┐
         │  AuthManager   │
         │   (Facade)     │
         └───────┬────────┘
                 │
    ┌────────────┼────────────┬────────────┐
    │            │            │            │
┌───▼──┐  ┌─────▼──┐  ┌──────▼───┐  ┌───▼────┐
│  KC  │  │ Okta  │  │   CAC    │  │ Local  │
└──────┘  └───────┘  └──────────┘  └────────┘
```

## Quick Start

### 1. Initialize Authentication Manager

```go
package main

import (
    "context"
    "github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/auth"
)

func main() {
    // Create authentication manager
    authMgr := auth.NewAuthManager()

    // Register Keycloak provider
    kcConfig := &auth.KeycloakConfig{
        RealmURL:     "https://keycloak.khepra.local/realms/khepra",
        ClientID:     "khepra-app",
        ClientSecret: "secret-from-keycloak",
    }
    
    kcProvider, err := auth.NewKeycloakProvider(kcConfig)
    if err != nil {
        panic(err)
    }
    
    authMgr.RegisterProvider(auth.ProviderKeycloak, kcProvider)
    authMgr.SetDefault(auth.ProviderKeycloak)

    // Register CAC provider for DoD environments
    cacConfig := &auth.CACConfig{
        TrustedCertPath: "/etc/certs/dod-root-ca.pem",
        CRLURL:          "https://crl.disa.mil/issuedby_dodroot_ca3/",
    }
    
    cacProvider, err := auth.NewCACProvider(cacConfig)
    if err != nil {
        panic(err)
    }
    
    authMgr.RegisterProvider(auth.ProviderCAC, cacProvider)

    // Register local provider for development
    localProvider := auth.NewLocalProvider()
    localProvider.CreateUser(context.Background(), &auth.User{
        ID:       "user123",
        Username: "admin",
        Email:    "admin@example.com",
        Roles:    []string{"admin"},
    })
    authMgr.RegisterProvider(auth.ProviderLocal, localProvider)

    defer authMgr.Close()
}
```

### 2. Authentication Usage

```go
// Authenticate with default provider (Keycloak)
user, err := authMgr.Authenticate(context.Background(), &auth.Credentials{
    Username: "john.doe",
    Password: "secure-password",
})
if err != nil {
    log.Fatal(err)
}

fmt.Printf("User: %s (%s)\n", user.Username, user.Email)

// Authenticate with specific provider
user, err = authMgr.AuthenticateWith(context.Background(), auth.ProviderCAC, &auth.Credentials{
    CertPath: "/path/to/dod-id.pem",
    KeyPath:  "/path/to/dod-id-key.pem",
})
if err != nil {
    log.Fatal(err)
}
```

### 3. Authorization with Roles & Permissions

```go
// Define custom roles
evaluator := auth.NewPermissionEvaluator()

// Add predefined roles
for _, role := range auth.PredefinedRoles {
    evaluator.DefineRole(role)
}

// Add custom role
customRole := &auth.Role{
    Name: "incident-responder",
    Description: "Can handle security incidents",
    Permissions: []auth.Permission{
        {Resource: "incident", Action: "read"},
        {Resource: "incident", Action: "write"},
        {Resource: "remediation", Action: "write"},
        {Resource: "dag", Action: "read"},
    },
}
evaluator.DefineRole(customRole)

// Check permissions
userRoles := []string{"incident-responder", "operator"}
if evaluator.Evaluate(userRoles, "incident", "write") {
    fmt.Println("User can write to incidents")
}
```

### 4. Session Management

```go
sessionMgr := auth.NewSessionManager()

// Create session after authentication
session, err := sessionMgr.CreateSession(user, user.Roles, 24*time.Hour)
if err != nil {
    log.Fatal(err)
}

fmt.Printf("Session ID: %s\n", session.SessionID)

// Later: retrieve session
session, err = sessionMgr.GetSession(session.SessionID)
if err != nil {
    log.Fatal("Session expired or invalid")
}

// Invalidate session at logout
sessionMgr.InvalidateSession(session.SessionID)
```

## Integration Examples

### HTTP Middleware

```go
func authMiddleware(authMgr *auth.AuthManager) http.Handler {
    return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
        // Extract token from Authorization header
        token := r.Header.Get("Authorization")
        if token == "" {
            http.Error(w, "Missing token", http.StatusUnauthorized)
            return
        }

        // Validate token across all providers
        valid, err := authMgr.ValidateToken(r.Context(), token)
        if err != nil || !valid {
            http.Error(w, "Invalid token", http.StatusUnauthorized)
            return
        }

        // Continue with request
    })
}
```

### gRPC Interceptor

```go
import "google.golang.org/grpc"

func authInterceptor(authMgr *auth.AuthManager) grpc.UnaryServerInterceptor {
    return func(ctx context.Context, req interface{}, info *grpc.UnaryServerInfo, handler grpc.UnaryHandler) (interface{}, error) {
        // Extract metadata from gRPC context
        md, ok := metadata.FromIncomingContext(ctx)
        if !ok {
            return nil, status.Error(codes.Unauthenticated, "missing metadata")
        }

        tokens := md.Get("authorization")
        if len(tokens) == 0 {
            return nil, status.Error(codes.Unauthenticated, "missing token")
        }

        valid, _ := authMgr.ValidateToken(ctx, tokens[0])
        if !valid {
            return nil, status.Error(codes.Unauthenticated, "invalid token")
        }

        return handler(ctx, req)
    }
}
```

## Provider-Specific Configuration

### Keycloak Setup

1. Create realm `khepra` in Keycloak
2. Create client `khepra-app`
3. Set client credentials
4. Configure scopes: `openid`, `profile`, `email`
5. Enable "Standard Flow Enabled"

```go
kcConfig := &auth.KeycloakConfig{
    RealmURL:     "https://keycloak.example.com/realms/khepra",
    ClientID:     "khepra-app",
    ClientSecret: os.Getenv("KEYCLOAK_SECRET"),
}
```

### CAC Setup (DoD Environments)

1. Import DoD root CA certificates
2. Configure mTLS in application
3. Enable client certificate verification
4. Set up CRL checking

```go
cacConfig := &auth.CACConfig{
    TrustedCertPath: "/etc/pki/dod-ca/DoD_Root_CA_3.pem",
    CRLURL:          "https://crl.disa.mil/",
}
```

### Local Setup (Development)

```go
localProvider := auth.NewLocalProvider()

// Add test users
testUsers := map[string]*auth.User{
    "admin": {
        ID:       "user1",
        Username: "admin",
        Email:    "admin@example.local",
        Roles:    []string{"admin"},
    },
    "operator": {
        ID:       "user2",
        Username: "operator",
        Email:    "operator@example.local",
        Roles:    []string{"operator"},
    },
}

for _, user := range testUsers {
    localProvider.CreateUser(context.Background(), user)
}
```

## Environment-Based Provider Selection

```go
func getAuthProvider(env string) (auth.Provider, error) {
    switch env {
    case "production":
        return auth.ProviderKeycloak, nil
    case "dod":
        return auth.ProviderCAC, nil
    case "cloud":
        return auth.ProviderOkta, nil
    case "development":
        return auth.ProviderLocal, nil
    default:
        return "", fmt.Errorf("unknown environment: %s", env)
    }
}
```

## Role-Based Access Control (RBAC)

Predefined roles in ADINKHEPRA:

1. **admin** - Full system access
2. **compliance-officer** - Compliance auditing and reporting
3. **security-engineer** - Vulnerability scanning and remediation
4. **operator** - System monitoring and reporting
5. **viewer** - Read-only access

## Token Validation

Tokens are validated across all registered providers:

```go
// Validate token across all providers
valid, err := authMgr.ValidateToken(ctx, token)

// Or validate token with specific provider
valid, err := kcProvider.ValidateToken(ctx, token)
```

## Error Handling

```go
user, err := authMgr.Authenticate(ctx, creds)
if err != nil {
    switch {
    case errors.Is(err, context.DeadlineExceeded):
        // Handle timeout
        log.Error("Authentication timeout")
    case strings.Contains(err.Error(), "401"):
        // Handle invalid credentials
        log.Error("Invalid username or password")
    default:
        // Handle other errors
        log.Errorf("Authentication failed: %v", err)
    }
}
```

## Testing

```go
import "testing"

func TestAuthentication(t *testing.T) {
    // Use local provider for testing
    provider := auth.NewLocalProvider()
    
    testUser := &auth.User{
        ID:       "test123",
        Username: "testuser",
        Email:    "test@example.com",
        Roles:    []string{"operator"},
    }
    
    provider.CreateUser(context.Background(), testUser)
    
    // Test authentication
    user, err := provider.Authenticate(context.Background(), &auth.Credentials{
        Username: "testuser",
        Password: "test123", // In test, password = ID
    })
    
    if err != nil || user.ID != "test123" {
        t.Fatal("Authentication failed")
    }
}
```

## Security Considerations

1. **Token Storage** - Never store tokens in plain text; use secure storage (keyring, vault)
2. **HTTPS Only** - Always use TLS for authentication endpoints
3. **Certificate Validation** - Validate server certificates properly
4. **FIPS Compliance** - Enable FIPS mode for DoD deployments
5. **Session Timeout** - Implement idle session timeouts
6. **MFA** - Use multi-factor authentication when possible
7. **Token Refresh** - Implement token refresh logic

## Monitoring & Audit

```go
// Log authentication events
func logAuthEvent(user *auth.User, action string, success bool) {
    log.WithFields(log.Fields{
        "user_id":  user.ID,
        "username": user.Username,
        "action":   action,
        "success":  success,
        "timestamp": time.Now(),
    }).Info("Authentication event")
}
```

## References

- [Keycloak Documentation](https://www.keycloak.org/documentation.html)
- [Okta Authentication](https://developer.okta.com/docs/)
- [DoD Public Key Infrastructure](https://dod.defense.gov/Portals/1/Documents/pubs/ism-6015.pdf)
- [NIST Identity & Access Management](https://csrc.nist.gov/publications/detail/sp/800-63-3/final)
