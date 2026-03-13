package scanner

import (
	"bufio"
	"bytes"
	"encoding/json"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/adinkra"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/dag"
)

// CrawlerFinding represents a single event/data point from SpiderFoot.
type CrawlerFinding struct {
	Event  string `json:"event"`  // e.g. "IP_ADDRESS"
	Module string `json:"module"` // e.g. "sfp_dns"
	Data   string `json:"data"`   // The actual finding
	Source string `json:"source"`
	Type   string `json:"type"`
}

// RunCrawler executes the Crawler (SpiderFoot) against a target.
// It automatically installs the tool and its Python dependencies if missing.
// It saves the output to the specified jsonPath.
func RunCrawler(target, jsonPath string) error {
	// Define the tools directory relative to CWD (project root)
	toolsDir := "tools"
	crawlerDir := filepath.Join(toolsDir, "spiderfoot")
	crawlerScript := filepath.Join(crawlerDir, "sf.py")
	depsMarker := filepath.Join(crawlerDir, ".khepra_deps_installed")

	// 1. Check if tool exists (Git Clone)
	if _, err := os.Stat(crawlerScript); os.IsNotExist(err) {
		fmt.Printf("[CRAWLER] Tool not found. Auto-installing into %s...\n", crawlerDir)

		if err := os.MkdirAll(toolsDir, 0755); err != nil {
			return fmt.Errorf("failed to create tools dir: %v", err)
		}

		repo := "https://github.com/smicallef/spiderfoot.git"
		cmd := exec.Command("git", "clone", repo, crawlerDir)
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr

		fmt.Printf("[CRAWLER] Cloning %s...\n", repo)
		if err := cmd.Run(); err != nil {
			return fmt.Errorf("failed to clone crawler: %v", err)
		}
	}

	// 2. Check Dependencies (Pip Install)
	if _, err := os.Stat(depsMarker); os.IsNotExist(err) {
		fmt.Println("[CRAWLER] Installing Python dependencies (pip)...")

		requirements := filepath.Join(crawlerDir, "requirements.txt")
		cmd := exec.Command("pip", "install", "-r", requirements)
		cmd.Stdout = os.Stdout
		cmd.Stderr = os.Stderr

		if err := cmd.Run(); err != nil {
			fmt.Printf("[WARN] Full dependency install failed. Attempting fallback for Core modules...\n")
			// ADDED cherrypy-cors per user request/crash log
			cmdFallback := exec.Command("pip", "install", "cherrypy", "cherrypy-cors", "requests", "beautifulsoup4", "mako", "netaddr", "cryptography", "pyOpenSSL", "dnspython", "pyyaml", "publicsuffixlist", "secure", "networkx", "ipwhois", "ipaddr", "phonenumbers", "adblockparser", "ExifRead", "pysocks", "pygexf", "PyPDF2", "python-whois", "python-docx", "python-pptx", "openpyxl")
			cmdFallback.Stdout = os.Stdout
			cmdFallback.Stderr = os.Stderr

			if errFallback := cmdFallback.Run(); errFallback != nil {
				fmt.Printf("[FAIL] Fallback install also failed: %v\n", errFallback)
			} else {
				fmt.Println("[CRAWLER] Core dependencies installed (Fallback mode).")
				os.Create(depsMarker)
			}
		} else {
			os.Create(depsMarker)
			fmt.Println("[CRAWLER] Dependencies installed.")
		}
	}

	// 3. Execute Crawler
	// Restrict to approved ADINKHEPRA module set (see docs/spiderfoot-module-manifest.md).
	// This prevents unapproved outbound API calls and satisfies IronBank connection
	// authorization requirements. Set SF_EXTRA_MODULES env var to append additional
	// modules for opt-in use cases.
	approvedModules := "sfp_dns,sfp_dnsbrute,sfp_dnsraw,sfp_dnsdumpster,sfp_crt," +
		"sfp_sublist3r,sfp_ripe,sfp_arin,sfp_bgpview,sfp_portscan_tcp,sfp_networksdb," +
		"sfp_ssl,sfp_certspotter,sfp_spider,sfp_webserver,sfp_pageinfo," +
		"sfp_strangeheader,sfp_webframework,sfp_filemeta,sfp_interessingfiles," +
		"sfp_alienvault,sfp_threatcrowd,sfp_threatfox,sfp_greynoise," +
		"sfp_phishtank,sfp_openphish,sfp_hackertarget,sfp_urlscan," +
		"sfp_leakix,sfp_whois,sfp_viewdns"
	if extra := os.Getenv("SF_EXTRA_MODULES"); extra != "" {
		approvedModules += "," + extra
	}

	fmt.Printf("[CRAWLER] Targeting %s -> Output: %s\n", target, jsonPath)

	absOut, _ := filepath.Abs(jsonPath)
	outFile, err := os.Create(absOut)
	if err != nil {
		return fmt.Errorf("failed to create output file: %v", err)
	}
	defer outFile.Close()

	cmd := exec.Command("python", crawlerScript, "-s", target, "-m", approvedModules, "-o", "json")
	cmd.Stdout = outFile // Redirect stdout to file
	cmd.Stderr = os.Stderr

	if err := cmd.Run(); err != nil {
		return fmt.Errorf("crawler execution failed: %v", err)
	}

	// 4. Sign the Artifact (DAG Integration)
	if err := SignCrawlerArtifact(target, jsonPath, "keys/id_dilithium"); err != nil {
		fmt.Printf("[DAG] WARN: Failed to sign artifact: %v\n", err)
	} else {
		fmt.Printf("[DAG] ARTIFACT SIGNED: %s.dag.json\n", jsonPath)
	}

	return nil
}

// SignCrawlerArtifact creates a PQC-signed DAG node for the scan output.
func SignCrawlerArtifact(target, jsonPath, keyPath string) error {
	// 1. Read the artifact
	data, err := os.ReadFile(jsonPath)
	if err != nil {
		return fmt.Errorf("failed to read artifact: %v", err)
	}

	// 2. Compute Content Hash (Adinkra Hash)
	contentHash := adinkra.Hash(data)

	// 3. Create DAG Node
	node := &dag.Node{
		Action: "CRAWLER_SCAN",
		Symbol: target,
		Time:   time.Now().Format(time.RFC3339),
		PQC: map[string]string{
			"file_hash": contentHash,
			"file_path": jsonPath,
			"algorithm": "dilithium_mode3",
		},
	}
	// ID will be computed from content by node.ComputeHash() if empty, or we can set it to a valid content-addressable ID
	// But dag.Add enforces ID == ComputeHash(). Let's let node.Sign() handle ID generation.

	// 4. Load Private Key
	privKey, err := os.ReadFile(keyPath)
	if err != nil {
		return fmt.Errorf("failed to read private key %s: %v", keyPath, err)
	}

	// 5. Sign the Node
	if err := node.Sign(privKey); err != nil {
		return fmt.Errorf("signing failed: %v", err)
	}

	// 6. Save the Signed Node
	dagPath := jsonPath + ".dag.json"
	dagData, err := json.MarshalIndent(node, "", "  ")
	if err != nil {
		return fmt.Errorf("failed to marshal dag node: %v", err)
	}

	if err := os.WriteFile(dagPath, dagData, 0644); err != nil {
		return fmt.Errorf("failed to write dag file: %v", err)
	}

	return nil
}

// ParseCrawler reads the JSON output from the crawler.
func ParseCrawler(path string) ([]CrawlerFinding, error) {
	data, err := os.ReadFile(path)
	if err != nil {
		return nil, err
	}

	// Spiderfoot output via CLI redirect acts as NDJSON (Newline Delimited JSON)
	var findings []CrawlerFinding
	scanner := bufio.NewScanner(bytes.NewReader(data))

	for scanner.Scan() {
		line := scanner.Bytes()
		if len(line) == 0 {
			continue
		}
		var f CrawlerFinding
		// Spiderfoot might output some non-JSON log lines? ignoring errors for now strictly
		if err := json.Unmarshal(line, &f); err == nil {
			findings = append(findings, f)
		}
	}

	return findings, nil
}
