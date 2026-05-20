package cmmc

import (
	"context"
	"crypto/sha256"
	"encoding/base64"
	"encoding/hex"
	"encoding/json"
	"errors"
	"fmt"
	"sort"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/adinkra"
)

// =============================================================================
// ERRORS
// =============================================================================

var (
	// ErrOutOfScope is returned when a tool call targets an asset outside
	// the signed BoundaryApproval. BoundaryGuard returns this to the MCP executor,
	// which converts it to a JSON-RPC error and logs a DAG node.
	ErrOutOfScope = errors.New("target asset is outside the approved assessment boundary")

	// ErrNoBoundaryApproval is returned when Phase 03+ is attempted without
	// a valid signed BoundaryApproval for the engagement.
	ErrNoBoundaryApproval = errors.New("no valid boundary approval exists for this engagement")

	// ErrApprovalExpired is returned when the BoundaryApproval validity window has passed.
	ErrApprovalExpired = errors.New("boundary approval has expired")

	// ErrApprovalRevoked is returned when the BoundaryApproval has been explicitly revoked.
	ErrApprovalRevoked = errors.New("boundary approval has been revoked")

	// ErrInvalidSignature is returned when the ML-DSA-65 signature on the
	// BoundaryApproval does not verify against the signer's public key.
	ErrInvalidSignature = errors.New("boundary approval signature is invalid")

	// ErrRoleNotAuthorized is returned when a user without Dwennimmen role
	// attempts to sign a BoundaryApproval.
	ErrRoleNotAuthorized = errors.New("only Dwennimmen (COMPLIANCE_OFFICER) may sign a boundary approval")
)

// =============================================================================
// BOUNDARY GUARD
// =============================================================================

// BoundaryGuard is an MCP middleware that enforces the approved assessment boundary.
// It must be installed in the MCP executor before any Phase 03+ tool dispatch.
//
// After installation, any khepra_run_compliance_scan or khepra_discover_endpoints
// call targeting an asset outside the signed boundary returns ErrOutOfScope.
type BoundaryGuard struct {
	approval     *BoundaryApproval
	signerPubKey []byte
	assetIndex   map[string]struct{} // hostname/IP → present in approved scope
}

// NewBoundaryGuard verifies the BoundaryApproval signature and returns a guard
// that is ready to check MCP tool call targets.
func NewBoundaryGuard(approval *BoundaryApproval, signerPublicKey []byte) (*BoundaryGuard, error) {
	if approval == nil {
		return nil, ErrNoBoundaryApproval
	}
	if approval.RevokedAt != nil {
		return nil, ErrApprovalRevoked
	}
	if time.Now().After(approval.ExpiresAt) {
		return nil, ErrApprovalExpired
	}
	if err := verifyApprovalSignature(approval, signerPublicKey); err != nil {
		return nil, fmt.Errorf("%w: %v", ErrInvalidSignature, err)
	}
	return &BoundaryGuard{
		approval:     approval,
		signerPubKey: signerPublicKey,
		assetIndex:   make(map[string]struct{}),
	}, nil
}

// AddAsset registers a hostname or IP address as in-scope.
// Called by the engagement loader after querying governed_assets
// WHERE in_cmmc_scope = true AND human_decision = 'include'.
func (g *BoundaryGuard) AddAsset(identifier string) {
	if identifier != "" {
		g.assetIndex[identifier] = struct{}{}
	}
}

// Check returns nil if the target is within the approved boundary.
// At least one of targetIP or targetHostname must be non-empty.
func (g *BoundaryGuard) Check(_ context.Context, targetIP, targetHostname string) error {
	if g.approval.RevokedAt != nil {
		return ErrApprovalRevoked
	}
	if time.Now().After(g.approval.ExpiresAt) {
		return ErrApprovalExpired
	}
	if targetIP == "" && targetHostname == "" {
		return fmt.Errorf("%w: no target identifier provided", ErrOutOfScope)
	}
	_, ipOK := g.assetIndex[targetIP]
	_, hostOK := g.assetIndex[targetHostname]
	if !ipOK && !hostOK {
		return fmt.Errorf("%w: %s / %s", ErrOutOfScope, targetHostname, targetIP)
	}
	return nil
}

// Approval returns the underlying record (read-only reference).
func (g *BoundaryGuard) Approval() *BoundaryApproval { return g.approval }

// =============================================================================
// SIGNING
// =============================================================================

// SignBoundaryApproval produces a PQC-signed BoundaryApproval.
// Only callers holding RoleDwennimmen may invoke this; enforce the role
// check before calling.
//
// Canonical payload: deterministic JSON of BoundaryApprovalClaims (keys sorted
// by json.Marshal's field order, which follows struct definition order).
// The SHA-256 of the canonical JSON is the value that gets signed with ML-DSA-65.
func SignBoundaryApproval(
	proposal *BoundaryProposal,
	approvedAssets []GovernedAsset,
	signerRole SMARTRole,
	signerUserID string,
	signerPrivKey []byte,
	dagNodeID string,
	now time.Time,
) (*BoundaryApproval, error) {
	if !signerRole.CanSignBoundary() {
		return nil, ErrRoleNotAuthorized
	}

	assetIDs := make([]string, len(approvedAssets))
	for i, a := range approvedAssets {
		assetIDs[i] = a.ID
	}
	sort.Strings(assetIDs)

	expires := now.Add(90 * 24 * time.Hour)

	claims := BoundaryApprovalClaims{
		EngagementID:       proposal.EngagementID,
		BoundaryProposalID: proposal.ID,
		AssetCount:         len(approvedAssets),
		AssetIDsHash:       hashStrings(assetIDs),
		ApprovedByRole:     string(signerRole),
		ApprovedByUserID:   signerUserID,
		EffectiveAt:        now,
		ExpiresAt:          expires,
		DAGNodeID:          dagNodeID,
	}

	canonical, err := json.Marshal(claims)
	if err != nil {
		return nil, fmt.Errorf("marshalling boundary claims: %w", err)
	}

	h := sha256.Sum256(canonical)
	payloadHashHex := hex.EncodeToString(h[:])

	sig, err := adinkra.Sign(signerPrivKey, canonical)
	if err != nil {
		return nil, fmt.Errorf("ML-DSA-65 sign: %w", err)
	}

	sigB64 := base64.RawURLEncoding.EncodeToString(sig)

	manifest := KhepraManifest{
		Version: "1.0",
		Type:    KhepraTypeBoundaryApproval,
		Claims: map[string]any{
			"boundary_approval": claims,
		},
		Signature: sigB64,
		IssuedAt:  now,
		ExpiresAt: &expires,
	}

	return &BoundaryApproval{
		EngagementID:       proposal.EngagementID,
		BoundaryProposalID: proposal.ID,
		ApprovedByRole:     signerRole,
		ApprovedByUserID:   signerUserID,
		PQCSignature:       sigB64,
		SignedPayloadHash:  payloadHashHex,
		DAGNodeID:          dagNodeID,
		KhepraManifest:     manifest,
		EffectiveAt:        now,
		ExpiresAt:          expires,
	}, nil
}

// verifyApprovalSignature re-derives the canonical payload and checks the
// ML-DSA-65 signature against the provided public key.
func verifyApprovalSignature(approval *BoundaryApproval, pubKey []byte) error {
	raw, ok := approval.KhepraManifest.Claims["boundary_approval"]
	if !ok {
		return errors.New("missing boundary_approval claims in manifest")
	}
	canonical, err := json.Marshal(raw)
	if err != nil {
		return err
	}

	sig, err := base64.RawURLEncoding.DecodeString(approval.PQCSignature)
	if err != nil {
		return fmt.Errorf("decoding PQC signature: %w", err)
	}

	valid, err := adinkra.Verify(pubKey, canonical, sig)
	if err != nil {
		return err
	}
	if !valid {
		return errors.New("signature verification failed")
	}
	return nil
}

// hashStrings returns the SHA-256 hex digest of a null-separated string list.
func hashStrings(ss []string) string {
	h := sha256.New()
	for _, s := range ss {
		h.Write([]byte(s))
		h.Write([]byte{0})
	}
	return hex.EncodeToString(h.Sum(nil))
}

func ptr[T any](v T) *T { return &v }
