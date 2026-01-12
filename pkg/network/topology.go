package network

import (
	"fmt"
	"sync"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/dag"
)

// Host represents a network host with services and accounts
type Host struct {
	Hostname    string
	IPAddress   string
	Services    []Service
	Accounts    []Account
	TrustLevel  string // Based on attestation state
	OSType      string // Linux, Windows, etc.
	Criticality int    // 1-5 (5 = most critical)
	Tags        []string
}

// Service represents a network service running on a host
type Service struct {
	Port       int
	Protocol   string // TCP, UDP
	ServiceName string // SSH, RDP, HTTP, etc.
	Banner     string
	Version    string
	CVEs       []string // Associated CVE IDs
	Exposed    bool     // Publicly exposed (Shodan visible)
}

// Account represents a user or service account
type Account struct {
	Username    string
	AccountType string // User, Service, Admin
	Privileges  []string
	SharedKeys  []string // Paths to shared SSH keys
}

// Connection represents a network connection between hosts
type Connection struct {
	SourceHost  string
	DestHost    string
	Protocol    string
	Port        int
	AuthMethod  string // Password, Key, Kerberos, None
	Bidirectional bool
	LastSeen    time.Time
}

// AttackPath represents a sequence of lateral movement steps
type AttackPath struct {
	Nodes        []*dag.Node
	BlastRadius  []string // List of compromised hostnames
	Severity     string
	Description  string
	MITRETactics []string
	Steps        []AttackStep
}

// AttackStep represents a single step in an attack path
type AttackStep struct {
	FromHost    string
	ToHost      string
	Method      string // SSH, RDP, SMB, etc.
	Requirement string // SharedKey, DefaultPassword, CVE-2021-1234
	ImpactLevel string // ROOT, ADMIN, USER
}

// NetworkTopology manages the network graph and attack path analysis
type NetworkTopology struct {
	dag         *dag.Memory
	hosts       map[string]*Host
	connections map[string]*Connection
	mu          sync.RWMutex
}

// NewNetworkTopology creates a new network topology analyzer
// dagInstance can be nil if DAG integration is not needed
func NewNetworkTopology(dagInstance *dag.Memory) *NetworkTopology {
	return &NetworkTopology{
		dag:         dagInstance,
		hosts:       make(map[string]*Host),
		connections: make(map[string]*Connection),
	}
}

// AddHost registers a host in the network topology
func (nt *NetworkTopology) AddHost(host *Host) error {
	nt.mu.Lock()
	defer nt.mu.Unlock()

	nt.hosts[host.Hostname] = host

	// Create DAG node for host (if DAG is configured)
	// TODO: DAG integration needs refactoring to match dag.Node fields
	// (Action, Symbol, Time instead of Type, Timestamp, Content)
	if nt.dag != nil {
		// Temporarily disabled - needs refactoring
	}

	return nil
}

// AddConnection registers a network connection
func (nt *NetworkTopology) AddConnection(conn *Connection) error {
	nt.mu.Lock()
	defer nt.mu.Unlock()

	connID := fmt.Sprintf("%s->%s:%d", conn.SourceHost, conn.DestHost, conn.Port)
	nt.connections[connID] = conn

	// Create DAG node for connection (if DAG is configured)
	// TODO: DAG integration needs refactoring
	if nt.dag != nil {
		// Temporarily disabled - needs refactoring
	}

	return nil
}

// ComputeLateralMovementPaths finds all possible attack paths from a compromised host
func (nt *NetworkTopology) ComputeLateralMovementPaths(compromisedHost string) ([]AttackPath, error) {
	nt.mu.RLock()
	defer nt.mu.RUnlock()

	var paths []AttackPath

	// Get the compromised host
	startHost, exists := nt.hosts[compromisedHost]
	if !exists {
		return nil, fmt.Errorf("host %s not found", compromisedHost)
	}

	// Perform breadth-first search for reachable hosts
	visited := make(map[string]bool)
	queue := []struct {
		currentHost string
		path        []AttackStep
		depth       int
	}{
		{compromisedHost, []AttackStep{}, 0},
	}

	maxDepth := 5 // Limit attack path depth

	for len(queue) > 0 {
		current := queue[0]
		queue = queue[1:]

		if current.depth > maxDepth {
			continue
		}

		visited[current.currentHost] = true

		// Find all connections from current host
		for _, conn := range nt.connections {
			if conn.SourceHost != current.currentHost {
				continue
			}

			// Skip if already visited (prevent cycles)
			if visited[conn.DestHost] {
				continue
			}

			// Determine attack method
			step := AttackStep{
				FromHost: conn.SourceHost,
				ToHost:   conn.DestHost,
				Method:   conn.Protocol,
			}

			// Analyze vulnerability
			destHost := nt.hosts[conn.DestHost]
			if destHost != nil {
				// Check for shared keys
				if nt.hasSharedKey(startHost, destHost) {
					step.Requirement = "SharedSSHKey"
					step.ImpactLevel = "ROOT"
				}

				// Check for default passwords (heuristic)
				if conn.AuthMethod == "Password" {
					step.Requirement = "DefaultPassword"
					step.ImpactLevel = "ADMIN"
				}

				// Check for exploitable services
				for _, svc := range destHost.Services {
					if len(svc.CVEs) > 0 {
						step.Requirement = fmt.Sprintf("CVE-%s", svc.CVEs[0])
						step.ImpactLevel = "SYSTEM"
						break
					}
				}
			}

			// Create new path
			newPath := append(current.path, step)

			// If destination is critical, record as attack path
			if destHost != nil && destHost.Criticality >= 4 {
				paths = append(paths, AttackPath{
					Steps:       newPath,
					BlastRadius: nt.extractBlastRadius(newPath),
					Severity:    nt.calculatePathSeverity(newPath, destHost),
					Description: nt.generatePathDescription(newPath, destHost),
					MITRETactics: []string{"T1021"}, // Remote Services
				})
			}

			// Continue traversal
			queue = append(queue, struct {
				currentHost string
				path        []AttackStep
				depth       int
			}{
				conn.DestHost,
				newPath,
				current.depth + 1,
			})
		}
	}

	return paths, nil
}

// hasSharedKey checks if two hosts share SSH keys
func (nt *NetworkTopology) hasSharedKey(host1, host2 *Host) bool {
	if host1 == nil || host2 == nil {
		return false
	}

	for _, acc1 := range host1.Accounts {
		for _, key1 := range acc1.SharedKeys {
			for _, acc2 := range host2.Accounts {
				for _, key2 := range acc2.SharedKeys {
					if key1 == key2 {
						return true
					}
				}
			}
		}
	}
	return false
}

// extractBlastRadius returns list of compromised hosts in a path
func (nt *NetworkTopology) extractBlastRadius(steps []AttackStep) []string {
	hostsMap := make(map[string]bool)
	for _, step := range steps {
		hostsMap[step.FromHost] = true
		hostsMap[step.ToHost] = true
	}

	var hosts []string
	for host := range hostsMap {
		hosts = append(hosts, host)
	}
	return hosts
}

// calculatePathSeverity determines severity based on target criticality and path length
func (nt *NetworkTopology) calculatePathSeverity(steps []AttackStep, target *Host) string {
	// Short paths to critical hosts = CRITICAL
	if len(steps) <= 3 && target.Criticality >= 4 {
		return "CRITICAL"
	}

	// Paths to high-value targets = HIGH
	if target.Criticality >= 3 {
		return "HIGH"
	}

	return "MEDIUM"
}

// generatePathDescription creates human-readable attack path description
func (nt *NetworkTopology) generatePathDescription(steps []AttackStep, target *Host) string {
	if len(steps) == 0 {
		return "Direct access to target"
	}

	return fmt.Sprintf(
		"Attacker pivots from %s to %s in %d steps, compromising %s",
		steps[0].FromHost,
		target.Hostname,
		len(steps),
		target.Hostname,
	)
}

// GenerateAttackGraphDAG creates DAG nodes for attack paths
func (nt *NetworkTopology) GenerateAttackGraphDAG(paths []AttackPath) error {
	// TODO: DAG integration needs refactoring to match dag.Node fields
	if nt.dag != nil {
		// Temporarily disabled - needs refactoring
	}

	return nil
}

// DiscoverNetworkTopology builds topology from Sonar scan data
func (nt *NetworkTopology) DiscoverNetworkTopology(scanData map[string]interface{}) error {
	// Parse scan data and populate hosts/connections
	// This is a simplified implementation - in production, parse actual Sonar output

	hostsData, ok := scanData["hosts"].([]interface{})
	if !ok {
		return fmt.Errorf("invalid scan data format")
	}

	for _, hostData := range hostsData {
		hostMap, ok := hostData.(map[string]interface{})
		if !ok {
			continue
		}

		host := &Host{
			Hostname:    getString(hostMap, "hostname"),
			IPAddress:   getString(hostMap, "ip_address"),
			OSType:      getString(hostMap, "os_type"),
			Criticality: getInt(hostMap, "criticality"),
			TrustLevel:  "UNKNOWN",
		}

		// Parse services
		if servicesData, ok := hostMap["services"].([]interface{}); ok {
			for _, svcData := range servicesData {
				svcMap, _ := svcData.(map[string]interface{})
				host.Services = append(host.Services, Service{
					Port:        getInt(svcMap, "port"),
					Protocol:    getString(svcMap, "protocol"),
					ServiceName: getString(svcMap, "name"),
					Version:     getString(svcMap, "version"),
				})
			}
		}

		if err := nt.AddHost(host); err != nil {
			return err
		}
	}

	return nil
}

// Helper functions for type-safe map access
func getString(m map[string]interface{}, key string) string {
	if val, ok := m[key].(string); ok {
		return val
	}
	return ""
}

func getInt(m map[string]interface{}, key string) int {
	if val, ok := m[key].(float64); ok {
		return int(val)
	}
	if val, ok := m[key].(int); ok {
		return val
	}
	return 0
}

// Stats returns network topology statistics
func (nt *NetworkTopology) Stats() map[string]interface{} {
	nt.mu.RLock()
	defer nt.mu.RUnlock()

	return map[string]interface{}{
		"total_hosts":       len(nt.hosts),
		"total_connections": len(nt.connections),
		"critical_hosts":    nt.countHostsByCriticality(4, 5),
	}
}

func (nt *NetworkTopology) countHostsByCriticality(min, max int) int {
	count := 0
	for _, host := range nt.hosts {
		if host.Criticality >= min && host.Criticality <= max {
			count++
		}
	}
	return count
}

// IsReachable checks if destHost is reachable from srcHost
func (nt *NetworkTopology) IsReachable(srcHost, destHost string) bool {
	paths, _ := nt.ComputeLateralMovementPaths(srcHost)
	for _, path := range paths {
		for _, hostname := range path.BlastRadius {
			if hostname == destHost {
				return true
			}
		}
	}
	return false
}
