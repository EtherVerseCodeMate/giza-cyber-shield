// Package keytwin implements the Khepra Key Twin (KKT) protocol: per-consumer
// post-quantum encapsulation of long-lived secrets (API keys, service credentials)
// using the Kyber-1024 / Merkaba primitives already defined in pkg/adinkra.
//
// Where adinkra.Kuntinkantan/Sankofa wrap a message for a single Okyeame
// (one Kyber keypair), KeyTwin issues a distinct "twin" — Kyber keypair plus
// Adinkra trust-tier symbol — per consumer (human, agent session, CI job,
// service). Two consumers wrapping the identical secret get cryptographically
// uncorrelated artifacts, every issuance is logged to a DAGConsensus ledger
// for provenance, and revocation is fail-closed: a revoked twin cannot unwrap,
// checked before any cryptographic operation runs.
//
// See docs/patent/APPENDIX_D_KEY_TWIN_CONTINUATION.md for the formal construction.
package keytwin

import (
	"crypto/hmac"
	"crypto/sha256"
	"errors"
	"fmt"
	"sync"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/adinkra"
)

// RevokedTier is the tombstone symbol assigned to a twin on revocation. It is
// deliberately absent from adinkra.AdinkraPrecedence, so DAGConsensus.ResolveConflict
// already ranks it below every real Adinkra tier (unknown symbol = precedence -1).
const RevokedTier = "Revoked"

// Twin is a single consumer's post-quantum credential-wrapping identity:
// a Kyber-1024 keypair bound to an Adinkra trust tier.
type Twin struct {
	ConsumerID string // human/agent/service identity this twin belongs to
	Symbol     string // Adinkra trust tier: Eban, Fawohodie, Nkyinkyim, or Dwennimmen
	KyberPub   []byte
	KyberPriv  []byte
	Revoked    bool
	IssuedAt   time.Time
}

// Broker issues twins, wraps/unwraps secrets on their behalf, and records every
// issuance, wrap, and revocation as a signed vertex in a DAGConsensus ledger.
type Broker struct {
	mu       sync.RWMutex
	twins    map[string]*Twin
	ledger   *adinkra.DAGConsensus
	signPub  *adinkra.AdinkhepraPQCPublicKey
	signPriv *adinkra.AdinkhepraPQCPrivateKey
}

// NewBroker creates a Broker with its own ML-DSA-65 signing identity, derived
// from seed, used to attest every ledger vertex it writes.
func NewBroker(seed []byte) (*Broker, error) {
	pub, priv, err := adinkra.GenerateAdinkhepraPQCKeyPair(seed, "Eban")
	if err != nil {
		return nil, fmt.Errorf("keytwin: failed to derive broker signing identity: %w", err)
	}
	return &Broker{
		twins:    make(map[string]*Twin),
		ledger:   adinkra.NewDAGConsensus(),
		signPub:  pub,
		signPriv: priv,
	}, nil
}

// Issue mints a new twin for consumerID at the given Adinkra trust tier and
// records the issuance as a genesis vertex in the ledger.
func (b *Broker) Issue(consumerID, symbol string) (*Twin, error) {
	if consumerID == "" {
		return nil, errors.New("keytwin: consumerID cannot be empty")
	}
	if _, ok := adinkra.AdinkraPrecedence[symbol]; !ok {
		return nil, fmt.Errorf("keytwin: unknown Adinkra tier %q", symbol)
	}

	pub, priv, err := adinkra.GenerateKyberKey()
	if err != nil {
		return nil, fmt.Errorf("keytwin: failed to generate twin keypair: %w", err)
	}

	twin := &Twin{
		ConsumerID: consumerID,
		Symbol:     symbol,
		KyberPub:   pub,
		KyberPriv:  priv,
		IssuedAt:   time.Now(),
	}

	b.mu.Lock()
	b.twins[consumerID] = twin
	b.mu.Unlock()

	if _, err := b.ledger.AddVertex([]byte("issue:"+consumerID), symbol, "keytwin-broker", nil, b.signPriv); err != nil {
		return nil, fmt.Errorf("keytwin: failed to log issuance: %w", err)
	}
	return twin, nil
}

// Revoke tombstones a twin. After this call, Wrap and Unwrap both fail closed
// for that consumer — checked before any decapsulation is attempted.
func (b *Broker) Revoke(consumerID string) error {
	b.mu.Lock()
	twin, ok := b.twins[consumerID]
	if !ok {
		b.mu.Unlock()
		return fmt.Errorf("keytwin: twin %q not found", consumerID)
	}
	twin.Revoked = true
	b.mu.Unlock()

	_, err := b.ledger.AddVertex([]byte("revoke:"+consumerID), RevokedTier, "keytwin-broker", nil, b.signPriv)
	return err
}

// Wrap encapsulates secret under consumerID's twin, using a Merkaba seed that
// mixes the Kyber shared secret with the twin's Adinkra spectral fingerprint
// and consumer ID, then appends an HMAC integrity tag over the artifact so
// Unwrap can fail closed. The wrap is logged to the ledger by artifact hash
// only — the secret itself never touches the ledger.
func (b *Broker) Wrap(consumerID string, secret []byte) (artifact []byte, vertexID string, err error) {
	twin, err := b.lookup(consumerID)
	if err != nil {
		return nil, "", err
	}
	if twin.Revoked {
		return nil, "", fmt.Errorf("keytwin: twin %q is revoked", consumerID)
	}

	ct, ss, err := adinkra.KyberEncapsulate(twin.KyberPub)
	if err != nil {
		return nil, "", fmt.Errorf("keytwin: encapsulation failed: %w", err)
	}

	seed := twinSeed(ss, twin)
	mk := adinkra.NewMerkaba(seed)
	sealed, err := mk.Seal(secret)
	if err != nil {
		return nil, "", fmt.Errorf("keytwin: seal failed: %w", err)
	}
	sealedBytes := []byte(sealed)
	tag := integrityTag(seed, ct, sealedBytes)

	artifact = make([]byte, 0, len(ct)+len(sealedBytes)+len(tag))
	artifact = append(artifact, ct...)
	artifact = append(artifact, sealedBytes...)
	artifact = append(artifact, tag...)

	vertex, err := b.ledger.AddVertex([]byte(adinkra.Hash(artifact)), twin.Symbol, consumerID, nil, b.signPriv)
	if err != nil {
		return nil, "", fmt.Errorf("keytwin: failed to log wrap: %w", err)
	}
	return artifact, vertex.ID, nil
}

// Unwrap recovers the secret from artifact using consumerID's twin. A revoked
// twin, a tampered artifact, or decapsulation under the wrong twin all fail
// closed: the HMAC integrity tag is checked before Unseal ever runs, so a
// mismatched Kyber shared secret (which the KEM's implicit-rejection design
// returns silently rather than erroring on) cannot produce garbage plaintext.
func (b *Broker) Unwrap(consumerID string, artifact []byte) ([]byte, error) {
	twin, err := b.lookup(consumerID)
	if err != nil {
		return nil, err
	}
	if twin.Revoked {
		return nil, fmt.Errorf("keytwin: twin %q is revoked", consumerID)
	}

	ctSize := adinkra.KyberCiphertextSize
	if len(artifact) < ctSize+sha256.Size {
		return nil, errors.New("keytwin: artifact too short")
	}
	ct := artifact[:ctSize]
	rest := artifact[ctSize:]
	tagStart := len(rest) - sha256.Size
	sealedBytes, tag := rest[:tagStart], rest[tagStart:]

	ss, err := adinkra.KyberDecapsulate(twin.KyberPriv, ct)
	if err != nil {
		return nil, fmt.Errorf("keytwin: decapsulation failed: %w", err)
	}

	seed := twinSeed(ss, twin)
	if !hmac.Equal(tag, integrityTag(seed, ct, sealedBytes)) {
		return nil, errors.New("keytwin: integrity check failed (wrong twin or tampered artifact)")
	}

	mk := adinkra.NewMerkaba(seed)
	plaintext, err := mk.Unseal(string(sealedBytes))
	if err != nil {
		return nil, fmt.Errorf("keytwin: unseal failed: %w", err)
	}
	return plaintext, nil
}

// Get returns the twin registered for consumerID, or nil if none exists.
func (b *Broker) Get(consumerID string) *Twin {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return b.twins[consumerID]
}

func (b *Broker) lookup(consumerID string) (*Twin, error) {
	b.mu.RLock()
	defer b.mu.RUnlock()
	twin, ok := b.twins[consumerID]
	if !ok {
		return nil, fmt.Errorf("keytwin: twin %q not found", consumerID)
	}
	return twin, nil
}

// twinSeed binds the Kyber shared secret to the twin's tier and identity, so the
// resulting Merkaba walk is unique per (consumer, tier) pair even when the
// underlying secret being wrapped is identical across consumers.
func twinSeed(sharedSecret []byte, twin *Twin) []byte {
	h := sha256.New()
	h.Write(sharedSecret)
	h.Write(adinkra.GetSpectralFingerprint(twin.Symbol))
	h.Write([]byte(twin.ConsumerID))
	return h.Sum(nil)
}

// integrityTag computes an HMAC-SHA256 over the KEM ciphertext and sealed
// payload, keyed by the twin seed. Merkaba itself is unauthenticated (no MAC,
// no nonce — see adinkra.Kuntinkantan); this tag is what makes Unwrap fail
// closed instead of silently returning garbage plaintext.
func integrityTag(seed, ct, sealedBytes []byte) []byte {
	h := hmac.New(sha256.New, seed)
	h.Write(ct)
	h.Write(sealedBytes)
	return h.Sum(nil)
}
