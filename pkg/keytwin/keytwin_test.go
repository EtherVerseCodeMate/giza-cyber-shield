package keytwin

import (
	"bytes"
	"testing"
)

func newTestBroker(t *testing.T) *Broker {
	b, err := NewBroker([]byte("test-broker-seed-do-not-use-in-prod"))
	if err != nil {
		t.Fatalf("NewBroker: %v", err)
	}
	return b
}

func TestIssueWrapUnwrapRoundTrip(t *testing.T) {
	b := newTestBroker(t)
	if _, err := b.Issue("agent-1", "Nkyinkyim"); err != nil {
		t.Fatalf("Issue: %v", err)
	}

	secret := []byte("sk_live_super_secret_api_key")
	artifact, vertexID, err := b.Wrap("agent-1", secret)
	if err != nil {
		t.Fatalf("Wrap: %v", err)
	}
	if vertexID == "" {
		t.Fatal("expected non-empty ledger vertex ID")
	}

	plaintext, err := b.Unwrap("agent-1", artifact)
	if err != nil {
		t.Fatalf("Unwrap: %v", err)
	}
	if !bytes.Equal(plaintext, secret) {
		t.Fatalf("round trip mismatch: got %q want %q", plaintext, secret)
	}
}

func TestSameSecretDistinctArtifactsPerConsumer(t *testing.T) {
	b := newTestBroker(t)
	if _, err := b.Issue("agent-1", "Eban"); err != nil {
		t.Fatalf("Issue agent-1: %v", err)
	}
	if _, err := b.Issue("agent-2", "Eban"); err != nil {
		t.Fatalf("Issue agent-2: %v", err)
	}

	secret := []byte("shared-underlying-secret")
	a1, _, err := b.Wrap("agent-1", secret)
	if err != nil {
		t.Fatalf("Wrap agent-1: %v", err)
	}
	a2, _, err := b.Wrap("agent-2", secret)
	if err != nil {
		t.Fatalf("Wrap agent-2: %v", err)
	}
	if bytes.Equal(a1, a2) {
		t.Fatal("expected uncorrelated artifacts for distinct consumers")
	}

	p1, err := b.Unwrap("agent-1", a1)
	if err != nil || !bytes.Equal(p1, secret) {
		t.Fatalf("agent-1 unwrap mismatch: %v %q", err, p1)
	}
	p2, err := b.Unwrap("agent-2", a2)
	if err != nil || !bytes.Equal(p2, secret) {
		t.Fatalf("agent-2 unwrap mismatch: %v %q", err, p2)
	}
}

func TestRevokeFailsClosed(t *testing.T) {
	b := newTestBroker(t)
	if _, err := b.Issue("agent-1", "Fawohodie"); err != nil {
		t.Fatalf("Issue: %v", err)
	}

	artifact, _, err := b.Wrap("agent-1", []byte("secret"))
	if err != nil {
		t.Fatalf("Wrap: %v", err)
	}

	if err := b.Revoke("agent-1"); err != nil {
		t.Fatalf("Revoke: %v", err)
	}

	if _, err := b.Unwrap("agent-1", artifact); err == nil {
		t.Fatal("expected Unwrap to fail closed after revocation")
	}
	if _, _, err := b.Wrap("agent-1", []byte("another-secret")); err == nil {
		t.Fatal("expected Wrap to fail closed after revocation")
	}
}

func TestUnwrapWrongConsumerFails(t *testing.T) {
	b := newTestBroker(t)
	if _, err := b.Issue("agent-1", "Dwennimmen"); err != nil {
		t.Fatalf("Issue agent-1: %v", err)
	}
	if _, err := b.Issue("agent-2", "Dwennimmen"); err != nil {
		t.Fatalf("Issue agent-2: %v", err)
	}

	artifact, _, err := b.Wrap("agent-1", []byte("secret"))
	if err != nil {
		t.Fatalf("Wrap: %v", err)
	}

	if _, err := b.Unwrap("agent-2", artifact); err == nil {
		t.Fatal("expected Unwrap under a different twin's Kyber key to fail")
	}
}

func TestIssueRejectsUnknownTier(t *testing.T) {
	b := newTestBroker(t)
	if _, err := b.Issue("agent-1", "NotARealSymbol"); err == nil {
		t.Fatal("expected Issue to reject an unknown Adinkra tier")
	}
}
