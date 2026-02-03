// Layer 1: Firewall - Perimeter Defense
// "The First Wall of Giza"
package gateway

import (
	"bufio"
	"log"
	"net"
	"net/http"
	"os"
	"regexp"
	"strings"
	"sync"
)

// FirewallLayer implements Layer 1 perimeter defense
type FirewallLayer struct {
	config *FirewallConfig

	// IP Blocklists (loaded from files or threat intel feeds)
	blockedIPs   map[string]bool
	blockedCIDRs []*net.IPNet
	allowedCIDRs []*net.IPNet
	torExitNodes map[string]bool

	// WAF Patterns
	sqliPatterns []*regexp.Regexp
	xssPatterns  []*regexp.Regexp
	lfiPatterns  []*regexp.Regexp
	rcePatterns  []*regexp.Regexp

	mu sync.RWMutex
}

// NewFirewallLayer creates a new firewall layer
func NewFirewallLayer(cfg *FirewallConfig) (*FirewallLayer, error) {
	fw := &FirewallLayer{
		config:       cfg,
		blockedIPs:   make(map[string]bool),
		torExitNodes: make(map[string]bool),
	}

	// Load IP blocklist if configured
	if cfg.IPBlocklistPath != "" {
		if err := fw.loadIPBlocklist(cfg.IPBlocklistPath); err != nil {
			log.Printf("[FIREWALL] Warning: Failed to load IP blocklist: %v", err)
		}
	}

	// Initialize WAF patterns
	fw.initWAFPatterns()

	log.Printf("[FIREWALL] Layer 1 initialized - WAF: SQLi[%v] XSS[%v] LFI[%v] RCE[%v]",
		cfg.EnableSQLiProtection, cfg.EnableXSSProtection,
		cfg.EnableLFIProtection, cfg.EnableRCEProtection)

	return fw, nil
}

// Check performs all firewall checks on the request
// Returns (blocked bool, reason string)
func (fw *FirewallLayer) Check(r *http.Request) (bool, string) {
	// 1. Protocol Enforcement
	if fw.config.RequireHTTPS && r.TLS == nil {
		return true, "HTTPS required"
	}

	// 2. Method Whitelist
	if !fw.isMethodAllowed(r.Method) {
		return true, "method not allowed"
	}

	// 3. Request Size Limits
	if r.ContentLength > fw.config.MaxRequestSizeBytes {
		return true, "request too large"
	}

	// 4. IP Reputation
	clientIP := getClientIP(r)
	if blocked, reason := fw.checkIP(clientIP); blocked {
		return true, reason
	}

	// 5. Geo Blocking (if configured)
	if blocked, reason := fw.checkGeo(clientIP); blocked {
		return true, reason
	}

	// 6. WAF Rules
	if blocked, reason := fw.checkWAF(r); blocked {
		return true, reason
	}

	return false, ""
}

// isMethodAllowed checks if HTTP method is in whitelist
func (fw *FirewallLayer) isMethodAllowed(method string) bool {
	if len(fw.config.AllowedMethods) == 0 {
		return true // No whitelist configured
	}

	for _, m := range fw.config.AllowedMethods {
		if strings.EqualFold(m, method) {
			return true
		}
	}
	return false
}

// checkIP checks IP against blocklists
func (fw *FirewallLayer) checkIP(ip string) (bool, string) {
	fw.mu.RLock()
	defer fw.mu.RUnlock()

	parsedIP := net.ParseIP(ip)
	if parsedIP == nil {
		return true, "invalid IP address"
	}

	// Check explicit blocklist
	if fw.blockedIPs[ip] {
		return true, "IP blocklisted"
	}

	// Check CIDR blocklists
	for _, cidr := range fw.blockedCIDRs {
		if cidr.Contains(parsedIP) {
			return true, "IP in blocked range"
		}
	}

	// Check Tor exit nodes if configured
	if fw.config.BlockTorExitNodes && fw.torExitNodes[ip] {
		return true, "Tor exit node blocked"
	}

	// Check allow-only list (if configured - for DoD environments)
	if len(fw.allowedCIDRs) > 0 {
		allowed := false
		for _, cidr := range fw.allowedCIDRs {
			if cidr.Contains(parsedIP) {
				allowed = true
				break
			}
		}
		if !allowed {
			return true, "IP not in allowlist"
		}
	}

	return false, ""
}

// checkGeo performs geo-blocking (placeholder for GeoIP integration)
func (fw *FirewallLayer) checkGeo(_ string) (bool, string) {
	// TODO: Integrate with MaxMind GeoIP2 or similar service
	// For now, this is a placeholder

	if len(fw.config.GeoBlockCountries) == 0 && len(fw.config.AllowOnlyCountries) == 0 {
		return false, ""
	}

	// In production, look up country from IP
	// country := geoip.LookupCountry(ip)

	// if contains(fw.config.GeoBlockCountries, country) {
	//     return true, "country blocked"
	// }

	// if len(fw.config.AllowOnlyCountries) > 0 && !contains(fw.config.AllowOnlyCountries, country) {
	//     return true, "country not allowed"
	// }

	return false, ""
}

// checkWAF runs Web Application Firewall rules
func (fw *FirewallLayer) checkWAF(r *http.Request) (bool, string) {
	// Collect all input vectors
	inputs := fw.collectInputs(r)

	// Check SQL Injection
	if fw.config.EnableSQLiProtection {
		for _, input := range inputs {
			for _, pattern := range fw.sqliPatterns {
				if pattern.MatchString(input) {
					return true, "SQL injection detected"
				}
			}
		}
	}

	// Check XSS
	if fw.config.EnableXSSProtection {
		for _, input := range inputs {
			for _, pattern := range fw.xssPatterns {
				if pattern.MatchString(input) {
					return true, "XSS detected"
				}
			}
		}
	}

	// Check Local File Inclusion
	if fw.config.EnableLFIProtection {
		for _, input := range inputs {
			for _, pattern := range fw.lfiPatterns {
				if pattern.MatchString(input) {
					return true, "LFI detected"
				}
			}
		}
	}

	// Check Remote Code Execution
	if fw.config.EnableRCEProtection {
		for _, input := range inputs {
			for _, pattern := range fw.rcePatterns {
				if pattern.MatchString(input) {
					return true, "RCE attempt detected"
				}
			}
		}
	}

	return false, ""
}

// collectInputs gathers all user input for WAF scanning
func (fw *FirewallLayer) collectInputs(r *http.Request) []string {
	var inputs []string

	// URL path
	inputs = append(inputs, r.URL.Path)

	// Query parameters
	for _, values := range r.URL.Query() {
		inputs = append(inputs, values...)
	}

	// Headers that commonly carry user input
	dangerousHeaders := []string{
		"User-Agent", "Referer", "Cookie", "X-Forwarded-For",
		"X-Custom-Header", "Content-Type",
	}
	for _, h := range dangerousHeaders {
		if v := r.Header.Get(h); v != "" {
			inputs = append(inputs, v)
		}
	}

	// Note: For POST bodies, we'd need to buffer and re-read
	// This should be done carefully to avoid memory issues

	return inputs
}

// initWAFPatterns initializes regex patterns for attack detection
func (fw *FirewallLayer) initWAFPatterns() {
	// SQL Injection patterns
	fw.sqliPatterns = []*regexp.Regexp{
		regexp.MustCompile(`(?i)(\b(select|insert|update|delete|drop|union|exec|execute)\b.*\b(from|into|set|where|table)\b)`),
		regexp.MustCompile(`(?i)(--|\#|\/\*|\*\/)`),
		regexp.MustCompile(`(?i)(\b(or|and)\b\s+[\w\'\"\=]+\s*[\=\>\<])`),
		regexp.MustCompile(`(?i)(\'|\"|;)\s*(or|and)\s+[\'\"\d]`),
		regexp.MustCompile(`(?i)\bunion\s+(all\s+)?select\b`),
		regexp.MustCompile(`(?i)\bselect\b.*\bfrom\b.*\bwhere\b`),
		regexp.MustCompile(`(?i)(\'|\")\s*;\s*(drop|delete|update|insert)`),
		regexp.MustCompile(`(?i)\b(sleep|benchmark|waitfor)\s*\(`),
	}

	// XSS patterns
	fw.xssPatterns = []*regexp.Regexp{
		regexp.MustCompile(`(?i)<script[^>]*>.*?</script>`),
		regexp.MustCompile(`(?i)<[^>]*(on\w+)\s*=`),
		regexp.MustCompile(`(?i)javascript\s*:`),
		regexp.MustCompile(`(?i)vbscript\s*:`),
		regexp.MustCompile(`(?i)<iframe[^>]*>`),
		regexp.MustCompile(`(?i)<object[^>]*>`),
		regexp.MustCompile(`(?i)<embed[^>]*>`),
		regexp.MustCompile(`(?i)<img[^>]*\s+onerror\s*=`),
		regexp.MustCompile(`(?i)(document|window)\s*\.\s*(cookie|location|write)`),
		regexp.MustCompile(`(?i)eval\s*\(`),
	}

	// LFI patterns
	fw.lfiPatterns = []*regexp.Regexp{
		regexp.MustCompile(`(?i)(\.\./|\.\.\\)`),
		regexp.MustCompile(`(?i)/etc/(passwd|shadow|hosts)`),
		regexp.MustCompile(`(?i)/proc/self/`),
		regexp.MustCompile(`(?i)(c:|d:)\\`),
		regexp.MustCompile(`(?i)\\windows\\`),
		regexp.MustCompile(`(?i)file://`),
		regexp.MustCompile(`(?i)php://filter`),
		regexp.MustCompile(`(?i)data://`),
		regexp.MustCompile(`(?i)expect://`),
	}

	// RCE patterns
	fw.rcePatterns = []*regexp.Regexp{
		regexp.MustCompile(`(?i)(\||;|&&|\$\(|` + "`" + `)`),
		regexp.MustCompile(`(?i)\b(nc|netcat|wget|curl|bash|sh|cmd|powershell)\b`),
		regexp.MustCompile(`(?i)\b(exec|system|passthru|shell_exec|popen)\s*\(`),
		regexp.MustCompile(`(?i)\$\{.*\}`), // Template injection
		regexp.MustCompile(`(?i)%\{.*\}`),  // Log4j style
		regexp.MustCompile(`(?i)\bping\s+-[nc]\s+\d+`),
		regexp.MustCompile(`(?i)/bin/(bash|sh|zsh|ksh)`),
	}
}

// loadIPBlocklist loads IPs from a file (one per line)
func (fw *FirewallLayer) loadIPBlocklist(path string) error {
	file, err := os.Open(path)
	if err != nil {
		return err
	}
	defer file.Close()

	fw.mu.Lock()
	defer fw.mu.Unlock()

	scanner := bufio.NewScanner(file)
	count := 0
	for scanner.Scan() {
		line := strings.TrimSpace(scanner.Text())
		if line == "" || strings.HasPrefix(line, "#") {
			continue
		}

		// Check if it's a CIDR
		if strings.Contains(line, "/") {
			_, cidr, err := net.ParseCIDR(line)
			if err != nil {
				log.Printf("[FIREWALL] Invalid CIDR in blocklist: %s", line)
				continue
			}
			fw.blockedCIDRs = append(fw.blockedCIDRs, cidr)
		} else {
			fw.blockedIPs[line] = true
		}
		count++
	}

	log.Printf("[FIREWALL] Loaded %d entries from IP blocklist", count)
	return scanner.Err()
}

// AddBlockedIP dynamically adds an IP to the blocklist
func (fw *FirewallLayer) AddBlockedIP(ip string) {
	fw.mu.Lock()
	defer fw.mu.Unlock()
	fw.blockedIPs[ip] = true
	log.Printf("[FIREWALL] Added IP to blocklist: %s", ip)
}

// RemoveBlockedIP removes an IP from the blocklist
func (fw *FirewallLayer) RemoveBlockedIP(ip string) {
	fw.mu.Lock()
	defer fw.mu.Unlock()
	delete(fw.blockedIPs, ip)
	log.Printf("[FIREWALL] Removed IP from blocklist: %s", ip)
}

// UpdateTorExitNodes updates the Tor exit node list
func (fw *FirewallLayer) UpdateTorExitNodes(nodes []string) {
	fw.mu.Lock()
	defer fw.mu.Unlock()

	fw.torExitNodes = make(map[string]bool)
	for _, node := range nodes {
		fw.torExitNodes[node] = true
	}
	log.Printf("[FIREWALL] Updated Tor exit node list: %d nodes", len(nodes))
}

// GetStats returns firewall statistics
func (fw *FirewallLayer) GetStats() map[string]interface{} {
	fw.mu.RLock()
	defer fw.mu.RUnlock()

	return map[string]interface{}{
		"blocked_ips_count":   len(fw.blockedIPs),
		"blocked_cidrs_count": len(fw.blockedCIDRs),
		"tor_nodes_count":     len(fw.torExitNodes),
		"sqli_patterns":       len(fw.sqliPatterns),
		"xss_patterns":        len(fw.xssPatterns),
		"lfi_patterns":        len(fw.lfiPatterns),
		"rce_patterns":        len(fw.rcePatterns),
	}
}
