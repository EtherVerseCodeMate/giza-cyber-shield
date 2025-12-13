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
type Scanner struct {
	Ports       []int
	Concurrency int // Number of concurrent threads (default: 1000)
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
	// Resolve IP
	ips, err := net.LookupIP(target)
	if err != nil {
		return nil, fmt.Errorf("failed to resolve target: %v", err)
	}
	ip := ips[0].String()

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
				res := scanPort(ip, port)
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
	}

	// Sort by port for clean output
	sort.Slice(finalResults, func(i, j int) bool {
		return finalResults[i].Port < finalResults[j].Port
	})

	return finalResults, nil
}

func scanPort(ip string, port int) *Result {
	address := fmt.Sprintf("%s:%d", ip, port)
	conn, err := net.DialTimeout("tcp", address, 1500*time.Millisecond)
	if err != nil {
		return nil // Closed or Filtered
	}
	defer conn.Close()

	return &Result{
		Target:  ip,
		Port:    port,
		Status:  "OPEN",
		Service: identifyService(port),
	}
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
