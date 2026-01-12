package audit

import (
	"fmt"
	"os"
	"runtime"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/scanner"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/types"
)

// NewSnapshot captures the current system state for baseline or audit purposes.
func NewSnapshot() (*types.AuditSnapshot, error) {
	// 1. Host Info
	// hostID, _ := license.GetHostID() // Unused for now
	hostname, _ := os.Hostname()

	host := types.InfoHost{
		Hostname: hostname,
		OS:       runtime.GOOS,
		Arch:     runtime.GOARCH,
		PublicIP: "127.0.0.1", // TODO: Implement external echo
	}

	// 2. Network Ports
	// Use the native scanner we built in Phase 2
	s := scanner.New()
	s.Concurrency = 500 // Be gentle on localhost
	results, err := s.Run("127.0.0.1")

	var netPorts []types.NetworkPort
	if err == nil {
		for _, r := range results {
			if r.Status == "OPEN" {
				netPorts = append(netPorts, types.NetworkPort{
					Port:     r.Port,
					Protocol: "tcp",
					State:    "LISTENING",
					BindAddr: "0.0.0.0",
				})
			}
		}
	} else {
		// Log error but continue?
		// For MVP we just return empty list if scan fails
		fmt.Printf("[WARN] Port scan failed: %v\n", err)
	}

	// 3. Processes (Placeholder for now, requires deeper OS hooks or 'ps' parsing)
	// We will implement a simple "Agent" process check
	procs := []types.ProcessInfo{
		{PID: os.Getpid(), Name: "khepra.exe", CmdLine: "agent start"},
	}

	// 4. File Manifests (Placeholder for critical files)
	// Track self
	exePath, _ := os.Executable()
	manifests := []types.FileManifest{}
	if exePath != "" {
		// hash it...
		manifests = append(manifests, types.FileManifest{Path: exePath, Type: "binary", Checksum: "pending_hash_implementation"})
	}

	snap := &types.AuditSnapshot{
		SchemaVersion: "1.0",
		ScanID:        fmt.Sprintf("snap-%d", time.Now().Unix()),
		Timestamp:     time.Now(),
		Host:          host,
		Network:       types.NetworkIntelligence{Ports: netPorts},
		System:        types.SystemIntelligence{Processes: procs},
		Manifests:     manifests,
		Tags:          []string{"agent-generated"},
	}

	// Populate backwards-compatible fields
	snap.NetworkList = netPorts
	snap.Processes = procs
	// PublicKey left empty until snapshot is sealed with PQC; kept for compatibility
	snap.PublicKey = ""

	return snap, nil
}
