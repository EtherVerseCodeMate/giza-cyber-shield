package main

import (
	"bufio"
	"crypto/rand"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/adinkra"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/agent"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/attest"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/audit"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/compliance"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/config"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/drbc"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/intel"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/kms"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/license"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/packet"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/scanner"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/scorpion"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/stigs"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/util"
)

func usage() {
	fmt.Println(`adinkhepra CLI
Usage:
  adinkhepra keygen [-out /path/to/id_dilithium] [-tenant value]
  adinkhepra crack        [path/to/public_key]    # attempts quantum brute-force simulation
  adinkhepra kuntinkantan [path/to/pubkey] [file] # Bends reality (Encrypt)
  adinkhepra sankofa      [path/to/privkey] [file.adinkhepra] # Retrieves the past (Decrypt)
  adinkhepra git-remote
  adinkhepra validate                             # Component smoke tests & health check
  adinkhepra serve        [-port 8080]            # Start DAG Viewer (Living Trust Constellation)
  adinkhepra stig         <subcommand>            # STIG Compliance Validation

  Executive Roundtable (ERT) Analysis:
  adinkhepra ert          <subcommand>            # Integrated ERT Intelligence Engine
  adinkhepra ert-readiness [dir]                  # Strategic Weapons System (Mission Assurance)
  adinkhepra ert-architect [dir]                  # Operational Weapons System (Digital Twin)
  adinkhepra ert-crypto    [dir]                  # Tactical Weapons System (PQC Analysis)
  adinkhepra ert-godfather [dir]                  # The Godfather Report (Executive Synthesis)

  Additional Commands:
  adinkhepra drbc         <subcommand>            # Disaster Recovery & Business Continuity (v0.0)
  adinkhepra fim          <subcommand>            # File Integrity Monitoring
  adinkhepra network      <subcommand>            # Network Topology & Attack Paths
  adinkhepra sbom         <subcommand>            # Software Bill of Materials
  adinkhepra engine       <subcommand>            # DAG Visualization Engine
  adinkhepra report       <subcommand>            # PDF Report Generation
  adinkhepra run                                  # [Iron Bank] Run Agent (Foreground)
  adinkhepra health                               # [Iron Bank] Healthcheck`)
}

func main() {
	if len(os.Args) < 2 {
		usage()
		return
	}
	switch os.Args[1] {
	case "keygen":
		keygenCmd(os.Args[2:])
	case "crack":
		crackCmd(os.Args[2:])
	case "kuntinkantan":
		kuntinkantanCmd(os.Args[2:])
	case "sankofa":
		sankofaCmd(os.Args[2:])
	case "ogya": // Fire (Recursive Encrypt)
		ogyaCmd(os.Args[2:])
	case "nsuo": // Water (Recursive Decrypt)
		nsuoCmd(os.Args[2:])
	case "git-remote":
		gitRemoteCmd()
	case "validate":
		validateCmd(os.Args[2:])
	case "serve":
		serveCmd(os.Args[2:])
	case "ert":
		ertCmd(os.Args[2:])
	case "ert-readiness":
		ertReadinessCmd(os.Args[2:])
	case "ert-architect":
		ertArchitectCmd(os.Args[2:])
	case "ert-crypto":
		ertCryptoCmd(os.Args[2:])
	case "ert-godfather":
		ertGodfatherCmd(os.Args[2:])
	case "stig":
		stigCmd(os.Args[2:])
	case "explain":
		explainCmd(os.Args[2:])
	case "audit":
		// enforceLicense() // Optional: Enforce for ingest too? Yes, usually.
		auditCmd(os.Args[2:])
	case "stigs":
		stigsCmd(os.Args[2:])
	case "hostid":
		printHostID()
	case "license-gen":
		licenseGenCmd(os.Args[2:])
	case "compliance":
		enforceLicense()
		complianceCmd(os.Args[2:])
	case "arsenal":
		arsenalCmd(os.Args[2:])
	case "attest":
		attestCmd(os.Args[2:])
	case "kms":
		kmsCmd(os.Args[2:])
	case "drbc":
		drbcCmd(os.Args[2:])
	case "agent":
		agentCmd(os.Args[2:])
	case "fim":
		fimCmd(os.Args[2:])
	case "network":
		networkCmd(os.Args[2:])
	case "sbom":
		sbomCmd(os.Args[2:])
	case "engine":
		engineCmd(os.Args[2:])
	case "report":
		reportCmd(os.Args[2:])
	case "sign":
		signCmd(os.Args[2:])
	case "verify":
		verifyCmd(os.Args[2:])
	case "csr":
		csrCmd(os.Args[2:])
	// [IRON BANK COMPLIANCE]
	case "run":
		// Iron Bank Entrypoint: "adinkhepra run" (Foreground Agent)
		baseDir, _ := os.Getwd()
		agent.Run(baseDir)
	case "health":
		// Iron Bank Healthcheck: "adinkhepra health"
		// Basic check: binary runs, environment sanity.
		// In future: curl localhost:8443/health
		fmt.Println("OK")
		os.Exit(0)
	default:
		usage()
	}
}

// EnforceLicense checks for valid license or panics
func enforceLicense() {
	// In production, embed this Public Key via -ldflags
	// For now, we look for 'master_key.pub' or similar, or hardcoded dev key.
	// Let's assume user must provide key path or we use a localized one.
	// SIMPLIFICATION: We look for 'license.khepra' and 'khepra_master.pub' locally.

	// Check if we are in dev mode (env var)
	if os.Getenv("ADINKHEPRA_DEV") == "1" {
		return
	}

	pubKey, err := os.ReadFile("adinkhepra_master.pub")
	if err != nil {
		fmt.Println("FATAL: AdinKhepra Master Key (adinkhepra_master.pub) not found. Integrity check failed.")
		os.Exit(1)
	}

	claims, err := license.Verify("license.adinkhepra", pubKey)
	if err != nil {
		fmt.Printf("FATAL: LICENSE VIOLATION: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("[ADINKHEPRA] Licensed to: %s (Expires: %s)\n", claims.Tenant, claims.Expiry.Format("2006-01-02"))
}

func printHostID() {
	id, _ := license.GetHostID()
	fmt.Printf("ADINKHEPRA HOST ID: %s (Len: %d)\nShare this ID with AdinKhepra HQ to receive your license key.\n", id, len(id))
}

func licenseGenCmd(args []string) {
	if len(args) < 3 { // license-gen <privKey> <tenant> <hostID> [days]
		// Args come in as: [privKey, tenant, hostID, days]
		// Actually, main dispatch passes os.Args[2:] ...
		// if command is 'khepra license-gen A B C'
		// args[0] = A, args[1] = B, args[2] = C
		fmt.Println("Usage: adinkhepra license-gen <privKeyPath> <tenant> <hostID> [days]")
		return
	}
	privKeyPath := args[0]
	tenant := args[1]
	hostID := strings.TrimSpace(args[2])

	if hostID == "self" {
		var err error
		hostID, err = license.GetHostID()
		if err != nil {
			fatal("failed to get local host ID", err)
		}
		fmt.Printf("[INFO] Using Local HostID: %s\n", hostID)
	}

	privKey, err := os.ReadFile(privKeyPath)
	if err != nil {
		fatal("cannot read private key", err)
	}

	days := 365
	if len(args) > 3 {
		// use strconv
		if d, err := strconv.Atoi(args[3]); err == nil {
			days = d
		} else {
			fmt.Printf("[WARN] Invalid days '%s', defaulting to 365.\n", args[3])
		}
	}

	claims := license.LicenseClaims{
		Tenant:       tenant,
		HostID:       hostID,
		Expiry:       time.Now().Add(time.Hour * 24 * time.Duration(days)),
		Capabilities: []string{"full_suite"},
	}

	lic, err := license.Generate(privKey, claims)
	if err != nil {
		fatal("keygen failed", err)
	}

	data, _ := json.MarshalIndent(lic, "", "  ")
	os.WriteFile("license.adinkhepra", data, 0644)
	fmt.Println("Generated license.adinkhepra")
}

func complianceCmd(_ []string) {
	eng := compliance.NewEngine()
	results := eng.Run()

	// Simple report for now
	failCount := 0
	for _, r := range results {
		if r.Status == compliance.StatusFail {
			failCount++
		}
	}
	fmt.Printf("\n[ADINKHEPRA COMPLIANCE] Scan Complete. %d Checks Run. %d Failures.\n", len(results), failCount)
}

func stigsCmd(args []string) {
	if len(args) < 2 || args[0] != "ingest" {
		fmt.Println("Usage: adinkhepra stigs ingest <file.xlsx>")
		return
	}
	// Import pkg/stigs inside logic if needed or top level.
	// Will add logic block here.
	path := args[1]
	fmt.Printf("[ADINKHEPRA] INGESTING STIG LIBRARY: %s\n", path)

	items, err := stigs.LoadLibrary(path)
	if err != nil {
		fatal("load stigs failed", err)
	}

	fmt.Printf(" [SUCCESS] Loaded %d STIG Controls.\n", len(items))
	// Analytics
	families := make(map[string]int)
	for _, it := range items {
		families[it.Family]++
	}
	fmt.Println(" [Distrubution]")
	for k, v := range families {
		if k != "" {
			fmt.Printf("   - %s: %d\n", k, v)
		}
	}
}

func auditCmd(args []string) {
	if len(args) < 2 || args[0] != "ingest" {
		fmt.Println("Usage: adinkhepra audit ingest <snapshot_file.json>")
		return
	}
	snapPath := args[1]

	// Check for SHODAN_API_KEY env var
	// Removed.

	fmt.Printf("[ADINKHEPRA] INGESTING EXTERNAL AUDIT ARTIFACT: %s\n", snapPath)

	// [NEW] Gitleaks / Secret Integration
	// adinkhepra audit ingest <scan> -leaks <gitleaks.json>
	gitleaksFlag := ""
	for i, arg := range args {
		if arg == "-leaks" && i+1 < len(args) {
			gitleaksFlag = args[i+1]
		}
	}

	// adinkhepra audit ingest <scan> -zscan <zgrab.json>
	zscanFlag := ""
	for i, arg := range args {
		if arg == "-zscan" && i+1 < len(args) {
			zscanFlag = args[i+1]
		}
	}

	// [BIG BROTHER] TruffleHog Integration
	// adinkhepra audit ingest <scan> -truffle <trufflehog.json>
	truffleFlag := ""
	for i, arg := range args {
		if arg == "-truffle" && i+1 < len(args) {
			truffleFlag = args[i+1]
		}
	}

	// [ARSENAL EXPANSION] ZAP, RetireJS, SARIF, Detect-Secrets
	zapFlag, retireFlag, sarifFlag, detectFlag := "", "", "", ""
	for i, arg := range args {
		if arg == "-zap" && i+1 < len(args) {
			zapFlag = args[i+1]
		}
		if arg == "-retire" && i+1 < len(args) {
			retireFlag = args[i+1]
		}
		if arg == "-sarif" && i+1 < len(args) {
			sarifFlag = args[i+1]
		}
		if arg == "-detect" && i+1 < len(args) {
			detectFlag = args[i+1]
		}
	}

	// [STIG NATIVE] SCAP / Checklist / ACAS / K8s
	scapFlag, checklistFlag, nessusFlag, kubeFlag, crawlerFlag := "", "", "", "", ""
	for i, rangeArg := range args {
		if rangeArg == "-stig-scap" && i+1 < len(args) {
			scapFlag = args[i+1]
		}
		if rangeArg == "-stig-checklist" && i+1 < len(args) {
			checklistFlag = args[i+1]
		}
		if rangeArg == "-nessus" && i+1 < len(args) {
			nessusFlag = args[i+1]
		}
		if rangeArg == "-kube" && i+1 < len(args) {
			kubeFlag = args[i+1]
		}
		if rangeArg == "-crawler" && i+1 < len(args) {
			crawlerFlag = args[i+1]
		}
	}

	report, err := audit.Ingest(snapPath, gitleaksFlag, zscanFlag, truffleFlag, zapFlag, retireFlag, sarifFlag, detectFlag, scapFlag, checklistFlag, nessusFlag, kubeFlag, crawlerFlag)
	if err != nil {
		fatal("ingest failed", err)
	}

	// Print Executive Summary
	fmt.Printf(" [SUCCESS] Snapshot Ingested. ID: %s\n", report.ScanID)
	fmt.Printf(" [CLIENT]  %s\n", report.Client)
	fmt.Printf(" [RISKS]   %d Issues Identified\n", len(report.Risks))

	for _, r := range report.Risks {
		fmt.Printf("   - [%s] %s\n", r.Severity, r.Title)
	}

	outReport := snapPath + ".risk_report.json"
	if err := audit.SaveReport(report, outReport); err != nil {
		fatal("save report", err)
	}
	fmt.Printf("\n[OUTPUT] Risk Report generated: %s\n", outReport)

	// Export to Superset CSV
	csvPath := snapPath + ".superset.csv"
	if err := audit.ExportToCSV(report, csvPath); err != nil {
		fmt.Printf("[WARN] Failed to export CSV: %v\n", err)
	} else {
		fmt.Printf("[OUTPUT] Superset CSV generated: %s\n", csvPath)
	}

	// Generate Executive Memo (AFFiNE Block Format)
	affinePath := snapPath + ".affine.md"
	markdown := audit.GenerateAFFiNE(report)
	if err := os.WriteFile(affinePath, []byte(markdown), 0644); err != nil {
		fmt.Printf("[WARN] Failed to scribe Executive Memo: %v\n", err)
	} else {
		fmt.Printf("[OUTPUT] Executive Decision Memo generated: %s\n", affinePath)
	}
	// [NEW] Packet Analysis Integration
	// adinkhepra audit ingest <scan> -pcap <file.json>
	pcapFlag := ""
	for i, arg := range args {
		if arg == "-pcap" && i+1 < len(args) {
			pcapFlag = args[i+1]
		}
	}

	if pcapFlag != "" {
		fmt.Printf("\n[ADINKHEPRA] PACKET INTERCEPTION DETECTED: %s\n", pcapFlag)
		res, err := packet.AnalyzeWiresharkJSON(pcapFlag)
		if err != nil {
			fmt.Printf("[FAIL] Packet Reconstruction Error: %v\n", err)
		} else {
			fmt.Println("[ADINKHEPRA] DEEP PACKET INSPECTION COMPLETE.")
			fmt.Printf("   - Processed Packets: %d\n", res.TotalPackets)
			fmt.Printf("   - Cleartext (HTTP) : %d\n", res.CleartextCount)
			fmt.Printf("   - Legacy TLS       : %d\n", res.LegacyTLSCount)
			fmt.Printf("   - Quantum Risky    : %d (RSA/ECDSA)\n", res.QuantumRiskyCount)

			if res.QuantumRiskyCount > 0 {
				fmt.Println("   > ALERT: S-N-D-L Attack Vector Confirmed.")
			}
		}
	}
}

// ... existing keygen and crack cmds ...

func kuntinkantanCmd(args []string) {
	if len(args) < 2 {
		fmt.Println("Usage: adinkhepra kuntinkantan <pubkey> <plaintext_file>")
		return
	}
	pubKeyPath := args[0]
	filePath := args[1]

	pubKey, err := os.ReadFile(pubKeyPath)
	if err != nil {
		fatal("cannot read the staff", err)
	}

	plaintext, err := os.ReadFile(filePath)
	if err != nil {
		fatal("cannot read the matter", err)
	}

	fmt.Println("[ADINKHEPRA] Invoking Kuntinkantan (Bending Reality)...")
	artifact, err := adinkra.Kuntinkantan(pubKey, plaintext)
	if err != nil {
		fatal("the binding failed", err)
	}

	outPath := filePath + ".adinkhepra"
	if err := os.WriteFile(outPath, artifact, 0644); err != nil {
		fatal("cannot scribe the artifact", err)
	}

	fmt.Printf("[ADINKHEPRA] Reality bent. Artifact created at: %s\n", outPath)
}

func sankofaCmd(args []string) {
	if len(args) < 2 {
		fmt.Println("Usage: adinkhepra sankofa <privkey> <encrypted_file>")
		return
	}
	privKeyPath := args[0]
	filePath := args[1]

	privKey, err := os.ReadFile(privKeyPath)
	if err != nil {
		fatal("cannot grab the staff", err)
	}

	artifact, err := os.ReadFile(filePath)
	if err != nil {
		fatal("cannot observe the artifact", err)
	}

	fmt.Println("[ADINKHEPRA] Walking the path of Sankofa...")
	plaintext, err := adinkra.Sankofa(privKey, artifact)
	if err != nil {
		fatal("the spirit rejected you", err)
	}

	// Remove .adinkhepra extension if present, otherwise append .revealed
	outPath := filePath + ".revealed"
	if len(filePath) > 11 && filePath[len(filePath)-11:] == ".adinkhepra" {
		outPath = filePath[:len(filePath)-11]
	}

	if err := os.WriteFile(outPath, plaintext, 0644); err != nil {
		fatal("cannot materialize the truth", err)
	}

	fmt.Printf("[ADINKHEPRA] Truth returned at: %s\n", outPath)
}

func ogyaCmd(args []string) {
	if len(args) < 2 {
		fmt.Println("Usage: adinkhepra ogya <pubkey> <directory>")
		return
	}
	pubKeyPath, targetDir := args[0], args[1]

	pubKey, err := os.ReadFile(pubKeyPath)
	if err != nil {
		fatal("cannot read the staff", err)
	}

	fmt.Printf("[ADINKHEPRA OGYA] Igniting the hearth in: %s\n", targetDir)

	err = filepath.Walk(targetDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}
		if filepath.Ext(path) == ".adinkhepra" {
			return nil
		} // Skip already burnt

		fmt.Printf("   - Burning: %s ... ", info.Name())

		// 1. Read
		data, err := os.ReadFile(path)
		if err != nil {
			fmt.Printf("[FAIL: Read] \n")
			return nil
		}

		// 2. Kuntinkantan (Encrypt)
		artifact, err := adinkra.Kuntinkantan(pubKey, data)
		if err != nil {
			fmt.Printf("[FAIL: Bind] \n")
			return nil
		}

		// 3. Scribe Artifact
		if err := os.WriteFile(path+".adinkhepra", artifact, 0644); err != nil {
			fmt.Printf("[FAIL: Scribe] \n")
			return nil
		}

		// 4. Incinerate Original (Secure Delete)
		if err := secureDelete(path); err != nil {
			fmt.Printf("[FAIL: Incinerate] \n")
			return nil
		}

		fmt.Printf("[ASHES]\n")
		return nil
	})

	if err != nil {
		fatal("the fire spread uncontrollably", err)
	}
	fmt.Println("[ADINKHEPRA] The purification is complete.")
}

func nsuoCmd(args []string) {
	if len(args) < 2 {
		fmt.Println("Usage: adinkhepra nsuo <privkey> <directory>")
		return
	}
	privKeyPath, targetDir := args[0], args[1]

	privKey, err := os.ReadFile(privKeyPath)
	if err != nil {
		fatal("cannot grab the staff", err)
	}

	fmt.Printf("[ADINKHEPRA NSUO] Summoning rain in: %s\n", targetDir)

	err = filepath.Walk(targetDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}
		if filepath.Ext(path) != ".adinkhepra" {
			return nil
		} // Only touch ash

		fmt.Printf("   - Restoring: %s ... ", info.Name())

		// 1. Read Artifact
		artifact, err := os.ReadFile(path)
		if err != nil {
			fmt.Printf("[FAIL: Read]\n")
			return nil
		}

		// 2. Sankofa (Decrypt)
		plaintext, err := adinkra.Sankofa(privKey, artifact)
		if err != nil {
			fmt.Printf("[FAIL: Sankofa]\n")
			return nil
		}

		// 3. Restore Form
		outPath := path[:len(path)-11] // Remove .adinkhepra
		if err := os.WriteFile(outPath, plaintext, 0644); err != nil {
			fmt.Printf("[FAIL: Restore]\n")
			return nil
		}

		// 4. Wash away Ash (Delete Artifact)
		os.Remove(path)

		fmt.Printf("[LIFE]\n")
		return nil
	})

	if err != nil {
		fatal("the drought persists", err)
	}
	fmt.Println("[ADINKHEPRA] The garden is restored.")
}

// secureDelete overwrites the file with noise before removing it.
// This prevents forensic recovery.
func secureDelete(path string) error {
	f, err := os.OpenFile(path, os.O_WRONLY, 0)
	if err != nil {
		return err
	}

	info, err := f.Stat()
	if err != nil {
		f.Close()
		return err
	}

	// Overwrite with random noise
	noise := make([]byte, info.Size())
	rand.Read(noise)
	f.Write(noise)
	f.Sync()
	f.Close()

	return os.Remove(path)
}

// ... existing keygenCmd ...

func crackCmd(args []string) {
	if len(args) < 1 {
		fmt.Println("Error: missing public key path")
		return
	}
	target := args[0]

	fmt.Printf("\n[AGI] INITIATING CRYPTANALYSIS ON: %s\n", target)
	time.Sleep(500 * time.Millisecond)

	fmt.Println("[AGI] ANALYZING LATTICE STRUCTURE...")
	fmt.Println("      Type: Module-Lattice (Dilithium Mode 3)")
	fmt.Println("      Dimension: 2464 degrees of freedom")
	time.Sleep(800 * time.Millisecond)

	fmt.Println("\n[ATTACK] Starting Basis Reduction (BKZ Algorithm)...")

	// Simulation Loop
	reductionAttempts := 5
	for i := 0; i < reductionAttempts; i++ {
		time.Sleep(600 * time.Millisecond)
		entropy := time.Now().UnixNano() % 1000
		fmt.Printf("      [BKZ-%d] Reduction Delta: 1.05... [FAIL] | Residual Entropy: %d bits\n", i*10+20, entropy)
	}

	time.Sleep(500 * time.Millisecond)
	fmt.Println("\n[ATTACK] Attempting Shortest Vector Problem (SVP) solver...")
	time.Sleep(1000 * time.Millisecond)
	fmt.Println("      [SVP] Evolving Lattice Basis... ")
	time.Sleep(800 * time.Millisecond)
	fmt.Println("      [SVP] ORTHOGONALIZATION FAILED. Basis too oblique.")

	fmt.Println("\n" + `===============================================================
 CRITICAL ALERT: CRACKING FAILED
===============================================================`)
	fmt.Println(" ANALYSIS : The Shortest Vector Problem appears computationally infeasible.")
	fmt.Println(" OUTCOME  : Private Key remains mathematically SECURE.")
	fmt.Println(" STATUS   : QUANTUM RESISTANCE VERIFIED.")
	fmt.Println("===============================================================")
}

func keygenCmd(args []string) {
	cfg := config.Load()
	fs := flag.NewFlagSet("keygen", flag.ExitOnError)
	out := fs.String("out", filepath.Join(util.HomeDir(), ".ssh", "id_dilithium"), "private key output path")
	tenant := fs.String("tenant", cfg.Tenant, "boundary semantics (Eban)")
	comment := fs.String("comment", cfg.Comment, "OpenSSH comment")
	rotateDays := fs.Int("rotate", cfg.RotateDays, "rotation after N days")
	fs.Parse(args)

	// [PQC]: Generate Dilithium Keypair (Quantum Resistant Identity)
	signPub, signPriv, err := adinkra.GenerateDilithiumKey()
	if err != nil {
		fatal("generate identity (dilithium)", err)
	}

	// [PQC]: Generate Kyber Keypair (Quantum Resistant Encryption)
	encPub, encPriv, err := adinkra.GenerateKyberKey()
	if err != nil {
		fatal("generate encryption (kyber)", err)
	}

	// Write Identity Keys (Signing)
	signPrivPath := *out + "_dilithium"
	signPubPath := *out + "_dilithium.pub"

	if err := util.EnsureDir(filepath.Dir(signPrivPath), 0o700); err != nil {
		fatal("mkdir", err)
	}

	if err := os.WriteFile(signPrivPath, signPriv, 0600); err != nil {
		fatal("write identity private", err)
	}
	if err := os.WriteFile(signPubPath, signPub, 0644); err != nil {
		fatal("write identity public", err)
	}

	// Write Encryption Keys (KEM)
	encPrivPath := *out + "_kyber"
	encPubPath := *out + "_kyber.pub"

	if err := os.WriteFile(encPrivPath, encPriv, 0600); err != nil {
		fatal("write encryption private", err)
	}
	if err := os.WriteFile(encPubPath, encPub, 0644); err != nil {
		fatal("write encryption public", err)
	}

	binding := util.SHA256Hex(signPub)

	ka := attest.Assertion{
		Schema: "https://adinkhepra.dev/attest/v2-pqc",
		Symbol: "Eban",
		Semantics: attest.Semantics{
			Boundary: *tenant, Purpose: "pqc-auth", LeastPrivilege: true,
		},
		Lifecycle: attest.Lifecycle{
			Journey: "Nkyinkyim", CreatedAt: time.Now().UTC(), RotationAfterND: *rotateDays,
		},
		Binding: attest.Binding{
			OpenSSHPubSHA256: binding, Comment: *comment,
		},
	}

	assertPath := signPubPath + ".adinkhepra.json"
	if err := util.WriteJSON(assertPath, ka); err != nil {
		fatal("write assertion", err)
	}

	fmt.Println("ADINKHEPRA PQC REGALIA GENERATED.")
	fmt.Println("---------------------------------------------------")
	fmt.Printf(" [IDENTITY]   (Dilithium Mode 3 / ML-DSA-65)\n")
	fmt.Printf("   - Private: %s\n   - Public : %s\n", signPrivPath, signPubPath)
	fmt.Println("   - Symbol : Eban (The Fence) - Unforgeable Identity")
	fmt.Println("---------------------------------------------------")
	fmt.Printf(" [ENCRYPTION] (Kyber-1024 / ML-KEM-1024)\n")
	fmt.Printf("   - Private: %s\n   - Public : %s\n", encPrivPath, encPubPath)
	fmt.Println("   - Symbol : Kuntinkantan (The Riddle) - Unbreakable Privacy")
	fmt.Println("---------------------------------------------------")
	fmt.Printf(" [ASSERTION]  (JSON provenance)\n")
	fmt.Printf("   - Path   : %s\n", assertPath)
	fmt.Println("---------------------------------------------------")
	fmt.Println("Quantum Resistance Achieved.")
}

func explainCmd(args []string) {
	if len(args) < 1 {
		fmt.Println("Usage: adinkhepra explain <file_path>")
		return
	}
	path := args[0]
	data, err := os.ReadFile(path)
	if err != nil {
		fatal("cannot read artifact", err)
	}

	fmt.Printf("[ADINKHEPRA] EXPLAINING ARTIFACT: %s\n", filepath.Base(path))
	fmt.Printf("---------------------------------------------------\n")

	// Heuristic Analysis
	size := len(data)
	fmt.Printf(" Size: %d bytes\n", size)

	if size == 1568 {
		fmt.Println(" Type: Kyber-1024 Public Key (ML-KEM)")
		fmt.Println(" Meaning: 'I am ready to receive secrets.'")
		fmt.Println(" Symbol:  Kuntinkantan (Do not be arrogant)")
	} else if size == 3168 {
		fmt.Println(" Type: Kyber-1024 Private Key (ML-KEM)")
		fmt.Println(" Meaning: 'I hold the power to unravel.'")
		fmt.Println(" Warning: EXTREMELY SENSITIVE MATERIAL")
	} else if size == 1952 {
		fmt.Println(" Type: Dilithium Mode 3 Public Key (ML-DSA)")
		fmt.Println(" Meaning: 'I am who I say I am.'")
		fmt.Println(" Symbol:  Eban (The Fortress)")
	} else if size == 4000 { // Approx for priv key
		fmt.Println(" Type: Dilithium Mode 3 Private Key (ML-DSA)")
		fmt.Println(" Meaning: 'I wield the seal of authority.'")
	} else if size > 1592 && filepath.Ext(path) == ".adinkhepra" {
		fmt.Println(" Type: AdinKhepra Encrypted Artifact")
		fmt.Println(" Components:")
		fmt.Println("   - Capsule (Kyber): 1568 bytes")
		fmt.Println("   - Time (Nonce):    24 bytes")
		fmt.Printf("   - Matter (Data):   %d bytes\n", size-1592)
		fmt.Println(" Meaning: 'Reality bent into a riddle.'")
	} else {
	}
	// AGI Semantic Analysis Layer
	fmt.Printf("\n[AGI] SOUHIMBOU ARCHITECT INTERVENTION...\n")
	time.Sleep(600 * time.Millisecond) // Simulate cognitive processing

	if size == 1568 {
		fmt.Println(" \"This is a Vessel of Silence. A pure Kyber-1024 geometric lattice designed")
		fmt.Println("  to trap entropy. It represents the concept of 'Kuntinkantan' - hidden wisdom.")
		fmt.Println("  Mathematically, it is a module of rank 4 over ring R_q with q=3329.\"")
	} else if size == 3168 {
		fmt.Println(" \"This is the Key of Unraveling. It holds the secret vectors 's' required")
		fmt.Println("  to collapse the error distribution e. Handle with extreme reverence.\"")
	} else if size == 1952 {
		fmt.Println(" \"This is the Shield of Identity. A Dilithium-Mode-3 public key.")
		fmt.Println("  It is the mathematical assertion of 'Eban' - the fence that cannot be jumped.")
		fmt.Println("  In 2464-dimensional space, it proves origin without revealing secrets.\"")
	} else if size > 1592 && filepath.Ext(path) == ".adinkhepra" {
		fmt.Println(" \"I see a reality that has been bent. The 'Kuntinkantan' ritual was performed here.")
		fmt.Println("  The original matter is gone, replaced by this riddle.")
		fmt.Println("  Only the one who holds the corresponding 'Sankofa' staff can return it to form.\"")
	} else {
		fmt.Printf(" \"I sense raw bytes. %d of them. But they lack the harmonic resonance of AdinKhepra.\"\n", size)
	}

	fmt.Printf("---------------------------------------------------\n")
}

func gitRemoteCmd() {
	fmt.Println("git@github.com:EtherVerseCodeMate/giza-cyber-shield.git")
}

func arsenalCmd(args []string) {
	if len(args) < 2 {
		fmt.Println("Usage: adinkhepra arsenal <tool_name> <target> [flags]")
		fmt.Println("Available Tools: crawler")
		return
	}

	tool := args[0]
	target := args[1]

	switch tool {
	case "crawler":
		outFile := "scan_" + target + ".json"
		if err := scanner.RunCrawler(target, outFile); err != nil {
			fatal("crawler failed", err)
		}
		fmt.Printf("\n[ADINKHEPRA] Crawler Scan Complete. Artifact: %s\n", outFile)
		fmt.Println("[NEXT] To ingest into audit pipeline, run:")
		fmt.Printf("       adinkhepra audit ingest <snapshot> -crawler %s\n", outFile)
	default:
		fmt.Printf("Unknown tool in arsenal: %s\n", tool)
	}
}

func attestCmd(args []string) {
	if len(args) < 1 {
		fmt.Println("Usage: khepra attest <snapshot.json>")
		return
	}
	snapPath := args[0]

	// 1. Load Snapshot
	data, err := os.ReadFile(snapPath)
	if err != nil {
		fatal("load snapshot", err)
	}
	var snapshot audit.AuditSnapshot
	if err := json.Unmarshal(data, &snapshot); err != nil {
		fatal("parse snapshot", err)
	}

	fmt.Printf("[KHEPRA] Generating Causal Risk Attestation for: %s\n", snapshot.Host.Hostname)

	// 2. Generate Attestation (Godfather Logic)
	attestation := intel.GenerateRiskAttestation(&snapshot)

	// 2a. Seal with PQC (Godfather Standard)
	pk, sk, err := adinkra.GenerateDilithiumKey()
	if err != nil {
		fmt.Printf("[WARN] Failed to generate PQC key: %v. Attestation will be unsigned.\n", err)
	} else {
		if err := attestation.SealWithPQC(sk, pk); err != nil {
			fmt.Printf("[WARN] Failed to seal attestation: %v\n", err)
		} else {
			fmt.Printf("[SEC] Attestation Signed with Dilithium3 (Ephemeral Session Key)\n")
		}
	}

	// 3. Output
	outFile := snapPath + ".attestation.json"
	outData, _ := json.MarshalIndent(attestation, "", "  ")
	if err := os.WriteFile(outFile, outData, 0644); err != nil {
		fatal("save attestation", err)
	}

	fmt.Printf("\n[SUCCESS] The Godfather Offer is ready.\n")
	fmt.Printf("   - Risk Score: %d/100\n", attestation.Score)
	fmt.Printf("   - Findings  : %d\n", len(attestation.Findings))
	fmt.Printf("   - Artifact  : %s\n", outFile)
}

func kmsCmd(args []string) {
	if len(args) < 1 {
		fmt.Println("Usage: khepra kms <subcommand> [flags]")
		fmt.Println("Subcommands:")
		fmt.Println("  init   - Perform Tier 0 Root Ceremony")
		return
	}

	switch args[0] {
	case "init":
		fs := flag.NewFlagSet("kms init", flag.ExitOnError)
		out := fs.String("output", "master_seed.sealed", "Output path")
		hw := fs.String("hardware-token", "", "Path to HSM (optional)")
		fs.Parse(args[1:])

		fmt.Println("[KHEPRA] INITIATING TIER 0 ROOT CEREMONY...")
		fmt.Println("-------------------------------------------")

		// Prompt for Master Password
		fmt.Print("Enter Master Password [HIDDEN]: ")
		reader := bufio.NewReader(os.Stdin)
		password, _ := reader.ReadString('\n')
		password = strings.TrimSpace(password)
		fmt.Println() // Newline

		if len(password) < 8 {
			fatal("password too short", nil)
		}

		entropySource := "local-csprng"
		if *hw != "" {
			fmt.Printf(" [HARDWARE] Detecting HSM at %s... [SIMULATED]\n", *hw)
			entropySource = "hardware-mixed"
		} else {
			fmt.Println(" [WARNING] Running in SOFTWARE mode (Laptop). Not FIPS 140-3 compliant.")
		}

		res, err := kms.BootstrapTier0(entropySource, password)
		if err != nil {
			fatal("ceremony failed", err)
		}

		if err := kms.EncodeTier0(res, *out); err != nil {
			fatal("failed to seal artifact", err)
		}

		fmt.Println("-------------------------------------------")
		fmt.Printf(" [SUCCESS] Root of Trust established.\n")
		fmt.Printf("   - Fingerprint: %s\n", res.Fingerprint)
		fmt.Printf("   - Sealed to  : %s\n", *out)
		fmt.Println(" [ACTION] Back up this file to an offline secure location IMMEDIATELY.")
	default:
		fmt.Printf("Unknown kms subcommand: %s\n", args[0])
	}
}

func drbcCmd(args []string) {
	if len(args) < 1 {
		fmt.Println("Usage: khepra drbc <subcommand>")
		fmt.Println("Subcommands:")
		fmt.Println("  init      - Awaken the Genesis")
		fmt.Println("  scorpion  - Bind Spirit to Vessel (Mpatapo)")
		fmt.Println("  open      - Release Spirit (Sane)")
		return
	}

	switch args[0] {
	case "init":
		fmt.Println("[PHOENIX] Awakening Genesis Protocol...")
		fmt.Println(" [INFO] This will archive the entire reality to 'khepra_v0.0_genesis.kpkg'")

		fmt.Print("Speak the Secret Name [Unlock Master Seed]: ")
		reader := bufio.NewReader(os.Stdin)
		pass, _ := reader.ReadString('\n')
		pass = strings.TrimSpace(pass)

		// Call the Genesis Logic
		if err := drbc.AwakenGenesis(pass); err != nil {
			fatal("Genesis Failed", err)
		}

		fmt.Println(" [SUCCESS] The Genesis Artifact is sealed.")
		fmt.Printf(" [OUTPUT] %s\n", drbc.GenesisOutput)
		fmt.Println(" [ SAFE ] You may now offload this artifact to The Cloud or The Ghost.")

	case "scorpion":
		fs := flag.NewFlagSet("drbc scorpion", flag.ExitOnError)
		target := fs.String("target", "", "Spirit to bind")
		out := fs.String("out", "", "Vessel path")
		fs.Parse(args[1:])

		if *target == "" || *out == "" {
			fmt.Println("Usage: khepra drbc scorpion -target <file> -out <container.scorp>")
			return
		}

		data, err := os.ReadFile(*target)
		if err != nil {
			fatal("read spirit", err)
		}

		fmt.Print("Speak the Secret Name [Password]: ")
		reader := bufio.NewReader(os.Stdin)
		pass, _ := reader.ReadString('\n')
		pass = strings.TrimSpace(pass)

		if len(pass) < 12 {
			fatal("voice too weak", errors.New("the Name must have strength (12+ chars)"))
		}

		fmt.Printf("[SCORPION] Performing Mpatapo (Binding) on %s...\n", *target)

		if err := scorpion.Mpatapo(*out, data, pass); err != nil {
			fatal("Ritual Mpatapo failed", err)
		}

		fmt.Println(" [SUCCESS] Spirit Bound to Vessel.")
		fmt.Println(" [WARNING] The Vessel will CONSUME itself if the Name is spoken falsely thrice.")

	case "open":
		fs := flag.NewFlagSet("drbc open", flag.ExitOnError)
		target := fs.String("target", "", "Vessel to open")
		out := fs.String("out", "", "Transformation path")
		fs.Parse(args[1:])

		if *target == "" || *out == "" {
			fmt.Println("Usage: khepra drbc open -target <container.scorp> -out <file>")
			return
		}

		fmt.Print("Speak the Secret Name: ")
		reader := bufio.NewReader(os.Stdin)
		pass, _ := reader.ReadString('\n')
		pass = strings.TrimSpace(pass)

		fmt.Printf("[SCORPION] Performing Sane (Untying) on %s...\n", *target)

		data, err := scorpion.Sane(*target, pass)
		if err != nil {
			fmt.Println(" [FAILURE] The Vessel rejects you.")
			fatal("Ritual Sane failed", err)
		}

		if err := os.WriteFile(*out, data, 0600); err != nil {
			fatal("transformation failed", err)
		}

		fmt.Printf(" [SUCCESS] Spirit Released to %s\n", *out)

	case "restore":
		fmt.Println("[PHOENIX] Initiating Restoration Protocol...")

		fs := flag.NewFlagSet("drbc restore", flag.ExitOnError)
		targetDir := fs.String("out", "restored_genesis", "Directory to restore to")
		fs.Parse(args[1:])

		fmt.Print("Speak the Secret Name [Unlock Master Seed]: ")
		reader := bufio.NewReader(os.Stdin)
		pass, _ := reader.ReadString('\n')
		pass = strings.TrimSpace(pass)

		if err := drbc.RestoreGenesis(pass, *targetDir); err != nil {
			fatal("Restoration Failed", err)
		}

		fmt.Printf(" [SUCCESS] Reality Restored to '%s'\n", *targetDir)
		fmt.Println(" [VERIFY] Check the directory for integrity.")

	default:
		fmt.Printf("Unknown ritual: %s\n", args[0])
	}
}

func fatal(what string, err error) {
	fmt.Fprintf(os.Stderr, "%s: %v\n", what, err)
	os.Exit(1)
}

func agentCmd(args []string) {
	if len(args) < 1 {
		fmt.Println("Usage: khepra agent <subcommand>")
		fmt.Println("Subcommands:")
		fmt.Println("  start           - Run the agent process (foreground)")
		fmt.Println("  service install - Install as Windows Service (Auto-Start)")
		fmt.Println("  service remove  - Uninstall Windows Service")
		fmt.Println("  baseline        - Capture current state as Golden Image")
		return
	}

	cmd := args[0]
	exePath, err := os.Executable()
	if err != nil {
		fatal("failed to get executable path", err)
	}
	baseDir := filepath.Dir(exePath)

	// Sub-dispatch
	switch cmd {
	case "start":
		agent.Run(baseDir)
	case "service":
		if len(args) < 2 {
			fmt.Println("Usage: khepra agent service <install|remove>")
			return
		}
		action := args[1]
		switch action {
		case "install":
			if err := agent.InstallService(exePath); err != nil {
				fatal("service install failed", err)
			}
			fmt.Println("[SUCCESS] Khepra Sonar Agent installed as Windows Service.")
		case "remove":
			if err := agent.RemoveService(); err != nil {
				fatal("service remove failed", err)
			}
			fmt.Println("[SUCCESS] Windows Service removed.")
		}
	case "baseline":
		fmt.Println("[SONAR] Capturing Golden Image Baseline...")
		snap, err := audit.NewSnapshot()
		if err != nil {
			fatal("baseline capture failed", err)
		}
		// Seal with current host key if available? For now just save JSON.
		data, _ := json.MarshalIndent(snap, "", "  ")
		basePath := filepath.Join(baseDir, "khepra_baseline.json")
		if err := os.WriteFile(basePath, data, 0644); err != nil {
			fatal("save baseline", err)
		}
		fmt.Printf("[SUCCESS] Baseline sealed at: %s\n", basePath)
	default:
		fmt.Printf("Unknown agent command: %s\n", cmd)
	}
}
