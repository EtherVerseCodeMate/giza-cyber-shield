package scanner

import (
	"fmt"
	"net"
	"sort"
	"sync"
	"time"
)

// Result represents a finding from the scanner
type Result struct {
	Target      string `json:"target"`
	Port        int    `json:"port"`
	Service     string `json:"service"`
	Status      string `json:"status"` // "OPEN", "FILTERED"
	Fingerprint string `json:"fingerprint"`
}

// Scanner is the core reconnaissance engine
// Scanner is the core reconnaissance engine
type Scanner struct {
	Ports       []int
	Concurrency int    // Number of concurrent threads (default: 1000)
	Proxy       string // SOCKS5 Proxy Address (e.g. "127.0.0.1:9050")
}

// New creates a new Scanner instance.
// By default, it loads the Top 100 Enterprise ports.
// Call ScanAllPorts() to enable full 1-65535 scanning.
func New() *Scanner {
	return &Scanner{
		Ports:       commonPorts,
		Concurrency: 1000,
	}
}

// SetProxy enables SOCKS5 routing for IP masking (e.g. Tor)
func (s *Scanner) SetProxy(proxyAddr string) {
	s.Proxy = proxyAddr
}

// SetFullScan enables scanning of all 65535 TCP ports
func (s *Scanner) SetFullScan() {
	all := make([]int, 65535)
	for i := 0; i < 65535; i++ {
		all[i] = i + 1
	}
	s.Ports = all
}

// FocusPorts reshuffles the scanning queue to prioritize ports identified by
// external intelligence (e.g. Shodan, Config files, Packet/TShark).
// It ensures high-value targets are scanned immediately by the worker pool.
func (s *Scanner) FocusPorts(intel []int) {
	unique := make(map[int]bool)
	for _, p := range s.Ports {
		unique[p] = true
	}

	// Ensure Intel ports are included
	for _, p := range intel {
		unique[p] = true
	}

	// Reconstruct the slice: Priority List FIRST
	var newOrder []int

	// 1. High Priority (Intel)
	for _, p := range intel {
		if unique[p] {
			newOrder = append(newOrder, p)
			delete(unique, p) // Mark as added
		}
	}

	// 2. The Rest (Standard List)
	var remaining []int
	for p := range unique {
		remaining = append(remaining, p)
	}
	sort.Ints(remaining)

	s.Ports = append(newOrder, remaining...)
}

// Run performs a concurrent port scan on the target using a worker pool
func (s *Scanner) Run(target string) ([]Result, error) {
	// Resolve IP (Local or Proxy?)
	// If Proxy is set, we let the Proxy resolve it! So we don't leak DNS locally.
	// But Scanner code was doing LookupIP first.
	// FIX: If Proxy is set, use target string directly. IF not, resolve.

	targetIP := target
	if s.Proxy == "" {
		ips, err := net.LookupIP(target)
		if err != nil {
			return nil, fmt.Errorf("failed to resolve target: %v", err)
		}
		targetIP = ips[0].String()
	}

	results := make(chan Result)
	var finalResults []Result

	// Worker Pool Control
	portsChan := make(chan int, len(s.Ports))
	var wg sync.WaitGroup

	// Start Workers
	for i := 0; i < s.Concurrency; i++ {
		wg.Add(1)
		go func() {
			defer wg.Done()
			for port := range portsChan {
				res := s.scanPort(targetIP, port) // Pass scanner instance method
				if res != nil {
					results <- *res
				}
			}
		}()
	}

	// Feed Workers
	go func() {
		for _, p := range s.Ports {
			portsChan <- p
		}
		close(portsChan)
	}()

	// Collector
	go func() {
		wg.Wait()
		close(results)
	}()

	for r := range results {
		finalResults = append(finalResults, r)

		if s.Proxy != "" && len(finalResults) == 1 {
			// Print first success to confirm tunnel is working
			fmt.Printf("[SCANNER] Tunnel Active. Found open port via %s\n", s.Proxy)
		}
	}

	// Sort by port for clean output
	sort.Slice(finalResults, func(i, j int) bool {
		return finalResults[i].Port < finalResults[j].Port
	})

	return finalResults, nil
}

func (s *Scanner) scanPort(host string, port int) *Result {
	address := fmt.Sprintf("%s:%d", host, port)
	timeout := 2000 * time.Millisecond // Slightly higher/adaptive

	var conn net.Conn
	var err error

	if s.Proxy != "" {
		conn, err = s.dialSOCKS5(address)
	} else {
		conn, err = net.DialTimeout("tcp", address, timeout)
	}

	if err != nil {
		return nil // Closed or Filtered
	}
	defer conn.Close()

	return &Result{
		Target:  host,
		Port:    port,
		Status:  "OPEN",
		Service: identifyService(port),
	}
}

// dialSOCKS5 implements a minimal Zero-Dependency SOCKS5 client handshake
func (s *Scanner) dialSOCKS5(targetAddr string) (net.Conn, error) {
	// 1. Connect to Proxy
	proxyConn, err := net.DialTimeout("tcp", s.Proxy, 2000*time.Millisecond)
	if err != nil {
		return nil, err
	}

	// 2. Client Greeting [Ver: 0x05, NMethods: 1, Method: 0x00 (No Auth)]
	_, err = proxyConn.Write([]byte{0x05, 0x01, 0x00})
	if err != nil {
		proxyConn.Close()
		return nil, err
	}

	// 3. Server Choice
	header := make([]byte, 2)
	_, err = proxyConn.Read(header)
	if err != nil || header[0] != 0x05 || header[1] != 0x00 {
		proxyConn.Close()
		return nil, fmt.Errorf("proxy handshake failed")
	}

	// 4. Client Connection Request
	// Cmd: 0x01 (Connect), RSV: 0x00, ATYP: 0x03 (DomainName), Len, Domain..., Port(2)
	host, portStr, _ := net.SplitHostPort(targetAddr)
	portInt := commonPorts[0] // safe default
	fmt.Sscanf(portStr, "%d", &portInt)

	req := []byte{0x05, 0x01, 0x00, 0x03, byte(len(host))}
	req = append(req, []byte(host)...)
	req = append(req, byte(portInt>>8), byte(portInt&0xff))

	_, err = proxyConn.Write(req)
	if err != nil {
		proxyConn.Close()
		return nil, err
	}

	// 5. Server Response
	// Ver: 0x05, Rep: 0x00 (Success), RSV, ATYP(1), BND.ADDR(4), BND.PORT(2) = 10 bytes min
	resp := make([]byte, 256)
	n, err := proxyConn.Read(resp)
	if err != nil || n < 4 || resp[1] != 0x00 {
		proxyConn.Close()
		return nil, fmt.Errorf("proxy connect failed")
	}

	return proxyConn, nil
}

func identifyService(port int) string {
	switch port {
	case 21:
		return "FTP"
	case 22:
		return "SSH"
	case 23:
		return "Telnet"
	case 25:
		return "SMTP"
	case 53:
		return "DNS"
	case 80:
		return "HTTP"
	case 110:
		return "POP3"
	case 135:
		return "RPC"
	case 139:
		return "NetBIOS"
	case 143:
		return "IMAP"
	case 443:
		return "HTTPS"
	case 445:
		return "SMB"
	case 1433:
		return "MSSQL"
	case 3306:
		return "MySQL"
	case 3389:
		return "RDP"
	case 5432:
		return "PostgreSQL"
	case 5900:
		return "VNC"
	case 6379:
		return "Redis"
	case 8080:
		return "HTTP-Alt"
	case 8443:
		return "HTTPS-Alt"
	case 27017:
		return "MongoDB"
	default:
		return "Unknown"
	}
}

var commonPorts = []int{
	20, 21, 22, 23, 25, 53, 80, 110, 111, 135, 139, 143, 443, 445, 993, 995,
	1433, 1723, 3306, 3389, 5432, 5900, 6379, 8080, 8443, 27017,
}
