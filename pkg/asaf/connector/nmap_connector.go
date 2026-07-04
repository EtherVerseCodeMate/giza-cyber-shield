// Package connector — SubnetConnector: Mode A subnet/CIDR discovery.
//
// Strategy (in priority order):
//  1. Nmap TCP SYN scan (if nmap binary found in PATH) — parses XML output
//  2. Pure-Go fallback: iterate CIDR IPs, dial ports 22/5985/443/80/8443,
//     grab SSH banners on port 22 for OS fingerprinting
//
// Streams DiscoveredHost via channel so the UI can display results as they arrive.
//
// Copyright: SOUHIMBOU DOH KONE LLC — exclusively licensed to SecRed Knowledge Inc.
// Patent Pending: USPTO #73565085
package connector

import (
	"bufio"
	"bytes"
	"context"
	"encoding/binary"
	"encoding/xml"
	"fmt"
	"net"
	"os/exec"
	"strings"
	"sync"
	"time"
)

// DiscoveryOptions controls SubnetConnector behavior.
type DiscoveryOptions struct {
	// Ports to probe in the Go fallback scan. Defaults to commonPorts.
	Ports []int
	// ConcurrentHosts limits parallel host probes. Default: 50.
	ConcurrentHosts int
	// DialTimeout per port. Default: 1 second.
	DialTimeout time.Duration
}

func (o *DiscoveryOptions) applyDefaults() {
	if o.ConcurrentHosts == 0 {
		o.ConcurrentHosts = 50
	}
	if o.DialTimeout == 0 {
		o.DialTimeout = 1 * time.Second
	}
	if len(o.Ports) == 0 {
		o.Ports = commonPorts
	}
}

var commonPorts = []int{22, 5985, 5986, 443, 80, 8443, 3389}

// SubnetConnector discovers hosts in a CIDR range (Mode A).
type SubnetConnector struct {
	cfg  ConnectorConfig
	opts DiscoveryOptions
}

// NewSubnetConnector creates a Mode A connector. cfg.CIDRRange must be set.
func NewSubnetConnector(cfg ConnectorConfig, opts DiscoveryOptions) *SubnetConnector {
	opts.applyDefaults()
	return &SubnetConnector{cfg: cfg, opts: opts}
}

func (c *SubnetConnector) Protocol() ConnectorProtocol { return ProtoNmap }

// Test pings the CIDR range head (first usable IP) to confirm the network is reachable.
func (c *SubnetConnector) Test(ctx context.Context) (*TestResult, error) {
	_, ipNet, err := net.ParseCIDR(c.cfg.CIDRRange)
	if err != nil {
		return &TestResult{Success: false, Message: "Invalid CIDR: " + err.Error()}, nil
	}
	start := time.Now()
	firstIP := nextIP(ipNet.IP)
	addr := fmt.Sprintf("%s:22", firstIP)
	d := net.Dialer{Timeout: c.opts.DialTimeout}
	conn, err := d.DialContext(ctx, "tcp", addr)
	if err != nil {
		// Try port 80 as secondary.
		addr = fmt.Sprintf("%s:80", firstIP)
		conn, err = d.DialContext(ctx, "tcp", addr)
	}
	latency := time.Since(start)
	if err != nil {
		return &TestResult{
			Success: false,
			Latency: latency,
			Message: fmt.Sprintf("No response from first host in %s", c.cfg.CIDRRange),
		}, nil
	}
	conn.Close()
	return &TestResult{
		Success: true,
		Latency: latency,
		Message: fmt.Sprintf("Network reachable — %s responded in %dms", firstIP, latency.Milliseconds()),
	}, nil
}

// Discover streams DiscoveredHost events. Uses nmap if available, falls back to Go TCP scanner.
func (c *SubnetConnector) Discover(ctx context.Context) (<-chan DiscoveredHost, error) {
	if _, _, err := net.ParseCIDR(c.cfg.CIDRRange); err != nil {
		return nil, fmt.Errorf("invalid CIDR %q: %w", c.cfg.CIDRRange, err)
	}

	ch := make(chan DiscoveredHost, 64)

	// Try nmap first.
	if nmap, err := exec.LookPath("nmap"); err == nil {
		go c.discoverNmap(ctx, nmap, ch)
	} else {
		go c.discoverFallback(ctx, ch)
	}
	return ch, nil
}

// ── Nmap strategy ─────────────────────────────────────────────────────────────

func (c *SubnetConnector) discoverNmap(ctx context.Context, nmap string, ch chan<- DiscoveredHost) {
	defer close(ch)

	args := []string{
		"-sS", // TCP SYN scan (fast, needs root/admin)
		"-O", "--osscan-guess", // OS detection
		"--open",         // only show open ports
		"-p", portList(c.opts.Ports),
		"--host-timeout", "10s",
		"--max-retries", "1",
		"-oX", "-", // XML output to stdout
		c.cfg.CIDRRange,
	}

	cmd := exec.CommandContext(ctx, nmap, args...)
	out, err := cmd.Output()
	if err != nil {
		// Nmap failed — fall through to Go fallback.
		c.discoverFallback(ctx, ch)
		return
	}

	hosts := parseNmapXML(out)
	for _, h := range hosts {
		select {
		case ch <- h:
		case <-ctx.Done():
			return
		}
	}
}

// nmapXML structures for parsing nmap -oX output.
type nmapRun struct {
	Hosts []nmapHost `xml:"host"`
}
type nmapHost struct {
	Status    nmapStatus    `xml:"status"`
	Addresses []nmapAddr    `xml:"address"`
	Hostnames []nmapHN      `xml:"hostnames>hostname"`
	Ports     []nmapPort    `xml:"ports>port"`
	OS        nmapOS        `xml:"os"`
}
type nmapStatus   struct{ State string `xml:"state,attr"` }
type nmapAddr     struct{ Type string `xml:"addrtype,attr"`; Addr string `xml:"addr,attr"` }
type nmapHN       struct{ Name string `xml:"name,attr"` }
type nmapPort     struct {
	Protocol string    `xml:"protocol,attr"`
	Portid   int       `xml:"portid,attr"`
	State    nmapState `xml:"state"`
}
type nmapState    struct{ State string `xml:"state,attr"` }
type nmapOS       struct{ Matches []nmapOSMatch `xml:"osmatch"` }
type nmapOSMatch  struct{ Name string `xml:"name,attr"` }

func parseNmapXML(data []byte) []DiscoveredHost {
	var run nmapRun
	if err := xml.NewDecoder(bytes.NewReader(data)).Decode(&run); err != nil {
		return nil
	}
	var out []DiscoveredHost
	for _, h := range run.Hosts {
		if h.Status.State != "up" {
			continue
		}
		var dh DiscoveredHost
		dh.Reachable = true
		for _, a := range h.Addresses {
			if a.Type == "ipv4" {
				dh.IP = a.Addr
			}
		}
		if len(h.Hostnames) > 0 {
			dh.Hostname = h.Hostnames[0].Name
		}
		for _, p := range h.Ports {
			if p.State.State == "open" {
				dh.OpenPorts = append(dh.OpenPorts, p.Portid)
				switch p.Portid {
				case 22:
					dh.Services = append(dh.Services, "ssh")
				case 5985, 5986:
					dh.Services = append(dh.Services, "winrm")
				case 3389:
					dh.Services = append(dh.Services, "rdp")
				case 443, 8443:
					dh.Services = append(dh.Services, "https")
				}
			}
		}
		if len(h.OS.Matches) > 0 {
			dh.OS = h.OS.Matches[0].Name
			dh.STIGProfile = AutoDetectSTIGProfile(dh.OS)
		}
		out = append(out, dh)
	}
	return out
}

// ── Go fallback strategy ───────────────────────────────────────────────────────

func (c *SubnetConnector) discoverFallback(ctx context.Context, ch chan<- DiscoveredHost) {
	defer close(ch)

	ips := cidrHosts(c.cfg.CIDRRange)
	sem := make(chan struct{}, c.opts.ConcurrentHosts)
	var wg sync.WaitGroup

	for _, ip := range ips {
		select {
		case <-ctx.Done():
			break
		case sem <- struct{}{}:
		}
		wg.Add(1)
		go func(ip string) {
			defer wg.Done()
			defer func() { <-sem }()

			if h, ok := c.probeHost(ctx, ip); ok {
				select {
				case ch <- h:
				case <-ctx.Done():
				}
			}
		}(ip)
	}
	wg.Wait()
}

func (c *SubnetConnector) probeHost(ctx context.Context, ip string) (DiscoveredHost, bool) {
	dh := DiscoveredHost{IP: ip}
	d := net.Dialer{Timeout: c.opts.DialTimeout}

	for _, port := range c.opts.Ports {
		addr := fmt.Sprintf("%s:%d", ip, port)
		conn, err := d.DialContext(ctx, "tcp", addr)
		if err != nil {
			continue
		}

		dh.Reachable = true
		dh.OpenPorts = append(dh.OpenPorts, port)

		switch port {
		case 22:
			dh.Services = append(dh.Services, "ssh")
			// Grab SSH banner for OS fingerprint.
			if banner := readBanner(conn, 2*time.Second); banner != "" {
				dh.OS = parseBannerOS(banner)
				if dh.OS != "" {
					dh.STIGProfile = AutoDetectSTIGProfile(dh.OS)
				}
			}
		case 5985, 5986:
			dh.Services = append(dh.Services, "winrm")
			if dh.OS == "" {
				dh.OS = "Windows"
				dh.STIGProfile = "windows-server-2022"
			}
		case 3389:
			dh.Services = append(dh.Services, "rdp")
		case 443, 8443:
			dh.Services = append(dh.Services, "https")
		case 80:
			dh.Services = append(dh.Services, "http")
		}
		conn.Close()
	}

	return dh, dh.Reachable
}

// readBanner reads the first line sent by the server (SSH version string).
func readBanner(conn net.Conn, timeout time.Duration) string {
	_ = conn.SetReadDeadline(time.Now().Add(timeout))
	scanner := bufio.NewScanner(conn)
	if scanner.Scan() {
		return strings.TrimSpace(scanner.Text())
	}
	return ""
}

// parseBannerOS extracts OS clues from an SSH version banner.
// Example: "SSH-2.0-OpenSSH_8.7 FreeBSD" → "FreeBSD"
func parseBannerOS(banner string) string {
	lower := toLower(banner)
	switch {
	case contains(lower, "ubuntu"):
		return "Ubuntu Linux"
	case contains(lower, "debian"):
		return "Debian Linux"
	case contains(lower, "rhel") || contains(lower, "red hat"):
		return "Red Hat Enterprise Linux"
	case contains(lower, "centos"):
		return "CentOS Linux"
	case contains(lower, "windows"):
		return "Windows"
	case contains(lower, "freebsd"):
		return "FreeBSD"
	default:
		if contains(lower, "openssh") {
			return "Linux"
		}
		return ""
	}
}

// ── Helpers ───────────────────────────────────────────────────────────────────

func portList(ports []int) string {
	parts := make([]string, len(ports))
	for i, p := range ports {
		parts[i] = fmt.Sprintf("%d", p)
	}
	return strings.Join(parts, ",")
}

// cidrHosts returns all host IPs in the given CIDR (skips network + broadcast).
func cidrHosts(cidr string) []string {
	_, ipNet, err := net.ParseCIDR(cidr)
	if err != nil {
		return nil
	}
	var ips []string
	for ip := nextIP(ipNet.IP); ipNet.Contains(ip); ip = nextIP(ip) {
		ips = append(ips, ip.String())
	}
	// Remove broadcast (last IP).
	if len(ips) > 0 {
		ips = ips[:len(ips)-1]
	}
	return ips
}

// nextIP returns the next IP address after ip.
func nextIP(ip net.IP) net.IP {
	ip = ip.To4()
	if ip == nil {
		return nil
	}
	n := binary.BigEndian.Uint32(ip)
	n++
	next := make(net.IP, 4)
	binary.BigEndian.PutUint32(next, n)
	return next
}
