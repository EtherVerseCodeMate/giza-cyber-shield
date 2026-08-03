package policy

import (
	"context"
	"net"
	"net/http"
	"time"
)

// guarded_transport.go provides the centralized, EgressBoundaryGuard-aware HTTP
// transport that outbound HTTP callers should use instead of a bare
// &http.Client{} (SouHimBou audit HZ-01). It resolves every destination host and
// runs the guard's CheckTarget on each candidate IP before the TCP dial, so a
// connection to an out-of-enclave target is rejected (and DAG-attested / IR-
// triggered by CheckTarget) rather than silently allowed.
//
// Migration: replace `&http.Client{Timeout: t}` at each call site with
// `ebg.GuardedClient(t)`, where `ebg` is the process EgressBoundaryGuard. This is
// the primitive; wiring an EBG instance to each site is the remaining migration.

// GuardedDialContext returns a DialContext that vets every resolved destination
// IP through the EgressBoundaryGuard before allowing the dial. A nil base dialer
// falls back to a 30s-timeout net.Dialer.
func (ebg *EgressBoundaryGuard) GuardedDialContext(base *net.Dialer) func(ctx context.Context, network, addr string) (net.Conn, error) {
	if base == nil {
		base = &net.Dialer{Timeout: 30 * time.Second}
	}
	return func(ctx context.Context, network, addr string) (net.Conn, error) {
		host, _, err := net.SplitHostPort(addr)
		if err != nil {
			host = addr
		}
		ips, err := net.DefaultResolver.LookupIPAddr(ctx, host)
		if err != nil {
			return nil, err
		}
		for _, ipa := range ips {
			if cerr := ebg.CheckTarget(ctx, ipa.IP.String()); cerr != nil {
				return nil, cerr
			}
		}
		return base.DialContext(ctx, network, addr)
	}
}

// GuardedTransport clones the given base transport (or a clone of
// http.DefaultTransport when base is nil) and installs the guard's DialContext.
func (ebg *EgressBoundaryGuard) GuardedTransport(base *http.Transport) *http.Transport {
	if base == nil {
		base = http.DefaultTransport.(*http.Transport).Clone()
	} else {
		base = base.Clone()
	}
	base.DialContext = ebg.GuardedDialContext(nil)
	return base
}

// GuardedClient returns an *http.Client whose transport enforces the
// EgressBoundaryGuard on every request. Use this in place of a bare
// &http.Client{} so outbound HTTP cannot bypass CIDR confinement.
func (ebg *EgressBoundaryGuard) GuardedClient(timeout time.Duration) *http.Client {
	return &http.Client{
		Timeout:   timeout,
		Transport: ebg.GuardedTransport(nil),
	}
}
