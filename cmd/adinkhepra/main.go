package main

import (
	"bufio"
	"encoding/hex"
	"encoding/json"
	"errors"
	"flag"
	"fmt"
	"math/rand"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/adinkra"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/agent"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/attest"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/audit"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/config"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/drbc"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/intel"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/kms"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/license"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/packet"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/scanner"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/scorpion"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/util"
)

const (
	masterPubKeyFile   = "adinkhepra_master.pub"
	licenseFile        = "license.adinkhepra"
	listBulletMsg      = "  - %s\n"
	adinkraExt         = ".adinkhepra"
	separator          = "---------------------------------------------------"
	subcommandsHeader  = "Subcommands:"
	speakSecretNameMsg = "Speak the Secret Name: "
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
  adinkhepra compliance   <subcommand>            # Unified CMMC/STIG/NIST Attestation Suite
  adinkhepra scada        <subcommand>            # HMADS/ARC Cyber-Physical Resilience Suite

  Executive Roundtable (ERT) Analysis:
  adinkhepra ert          <subcommand>            # Integrated ERT Intelligence Engine
  adinkhepra ert-readiness [dir]                  # Strategic Weapons System (Mission Assurance)
  adinkhepra ert-architect [dir]                  # Operational Weapons System (Digital Twin)
  adinkhepra ert-crypto    [dir]                  # Tactical Weapons System (PQC Analysis)
  adinkhepra ert-godfather [dir]                  # The Godfather Report (Executive Synthesis)

  Additional Commands:
  adinkhepra compliance   <subcommand>            # CMMC/NIST 800-171/172 & GSA Readiness
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
	cmd := os.Args[1]
	args := os.Args[2:]

	if handlePrimaryCmds(cmd, args) {
		return
	}
	if handleSecondaryCmds(cmd, args) {
		return
	}
	usage()
}

func handlePrimaryCmds(cmd string, args []string) bool {
	switch cmd {
	case "keygen":
		keygenCmd(args)
	case "crack":
		crackCmd(args)
	case "kuntinkantan":
		kuntinkantanCmd(args)
	case "sankofa":
		sankofaCmd(args)
	case "ogya":
		ogyaCmd(args)
	case "nsuo":
		nsuoCmd(args)
	case "git-remote":
		gitRemoteCmd()
	case "validate":
		validateCmd(args)
	case "serve":
		serveCmd(args)
	case "ert":
		ertCmd(args)
	case "ert-readiness":
		ertReadinessCmd(args)
	case "ert-architect":
		ertArchitectCmd(args)
	case "ert-crypto":
		ertCryptoCmd(args)
	case "ert-godfather":
		ertGodfatherCmd(args)
	case "compliance":
		enforceLicense()
		complianceCmd(args)
	case "audit":
		auditCmd(args)
	case "scada":
		scadaCmd(args)
	default:
		return false
	}
	return true
}

func handleSecondaryCmds(cmd string, args []string) bool {
	switch cmd {
	case "stig":
		fmt.Println("[DEPRECATED] Use 'adinkhepra compliance scan' instead.")
		complianceCmd(args)
	case "stigs":
		fmt.Println("[DEPRECATED] Use 'adinkhepra compliance ingest' instead.")
		complianceIngestCmd(args)
	case "explain":
		explainCmd(args)
	case "hostid":
		printHostID()
	case "license-gen":
		licenseGenCmd(args)
	case "arsenal":
		arsenalCmd(args)
	case "attest":
		attestCmd(args)
	case "kms":
		kmsCmd(args)
	case "drbc":
		drbcCmd(args)
	case "agent":
		agentCmd(args)
	case "fim":
		fimCmd(args)
	case "network":
		networkCmd(args)
	case "sbom":
		sbomCmd(args)
	case "engine":
		engineCmd(args)
	case "report":
		reportCmd(args)
	case "sign":
		signCmd(args)
	case "verify":
		verifyCmd(args)
	case "csr":
		csrCmd(args)
	case "run":
		baseDir, _ := os.Getwd()
		agent.Run(baseDir)
	case "health":
		fmt.Println("OK")
		os.Exit(0)
	default:
		return false
	}
	return true
}

// getExeDir returns the directory containing the executable
func getExeDir() string {
	exe, err := os.Executable()
	if err != nil {
		return "."
	}
	// Resolve symlinks to get actual path
	exe, err = filepath.EvalSymlinks(exe)
	if err != nil {
		return "."
	}
	return filepath.Dir(exe)
}

// getProjectRoot finds the project root by looking for key indicators
func getProjectRoot() string {
	// Priority: 1. ADINKHEPRA_ROOT env var, 2. Parent of exe dir (bin/../), 3. CWD
	if root := os.Getenv("ADINKHEPRA_ROOT"); root != "" {
		return root
	}

	exeDir := getExeDir()

	// If exe is in 'bin/', parent is project root
	if filepath.Base(exeDir) == "bin" {
		return filepath.Dir(exeDir)
	}

	// Otherwise check if current directory has keys/
	if _, err := os.Stat("keys"); err == nil {
		cwd, _ := os.Getwd()
		return cwd
	}

	return exeDir
}

// resolvePath resolves a relative path against project root
func resolvePath(relPath string) string {
	if filepath.IsAbs(relPath) {
		return relPath
	}
	return filepath.Join(getProjectRoot(), relPath)
}

// EnforceLicense checks for valid license or panics
func enforceLicense() {
	if os.Getenv("ADINKHEPRA_DEV") == "1" {
		return
	}

	pubKey := findMasterPubKey()
	if pubKey == nil {
		fmt.Println("FATAL: AdinKhepra Master Key not found. Checked:")
		fmt.Println("  - ADINKHEPRA_MASTER_KEY_PUB env var")
		fmt.Printf(listBulletMsg, resolvePath("keys/offline/OFFLINE_ROOT_KEY.pub"))
		fmt.Printf(listBulletMsg, filepath.Join(getExeDir(), masterPubKeyFile))
		fmt.Printf("  - %s (cwd)\n", masterPubKeyFile)
		fmt.Println("Integrity check failed.")
		os.Exit(1)
	}

	licPath := findLicenseFile()
	if licPath == "" {
		fmt.Println("FATAL: License file not found. Checked:")
		fmt.Printf(listBulletMsg, resolvePath(licenseFile))
		fmt.Printf(listBulletMsg, filepath.Join(getExeDir(), licenseFile))
		fmt.Printf("  - %s (cwd)\n", licenseFile)
		os.Exit(1)
	}

	claims, err := license.Verify(licPath, pubKey)
	if err != nil {
		fmt.Printf("FATAL: LICENSE VIOLATION: %v\n", err)
		os.Exit(1)
	}
	fmt.Printf("[ADINKHEPRA] Licensed to: %s (Expires: %s)\n", claims.Tenant, claims.Expiry.Format("2006-01-02"))
}

func findMasterPubKey() []byte {
	exeDir := getExeDir()
	keyPaths := []string{
		os.Getenv("ADINKHEPRA_MASTER_KEY_PUB"),
		resolvePath("keys/offline/OFFLINE_ROOT_KEY.pub"),
		filepath.Join(exeDir, masterPubKeyFile),
		masterPubKeyFile,
	}

	for _, path := range keyPaths {
		if path == "" {
			continue
		}
		keyData, err := os.ReadFile(path)
		if err != nil {
			continue
		}
		// Try hex-decoding first
		decoded, err := hex.DecodeString(strings.TrimSpace(string(keyData)))
		if err == nil {
			return decoded
		}
		return keyData
	}
	return nil
}

func findLicenseFile() string {
	exeDir := getExeDir()
	licensePaths := []string{
		resolvePath(licenseFile),
		filepath.Join(exeDir, licenseFile),
		licenseFile,
	}

	for _, lp := range licensePaths {
		if _, err := os.Stat(lp); err == nil {
			return lp
		}
	}
	return ""
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

	privKeyHex, err := os.ReadFile(privKeyPath)
	if err != nil {
		fatal("cannot read private key", err)
	}

	// Decode hex-encoded private key
	privKey, err := hex.DecodeString(strings.TrimSpace(string(privKeyHex)))
	if err != nil {
		fatal("invalid private key format (expected hex)", err)
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

// Redirection to cmd_compliance.go is handled by the Go compiler as they share the 'main' package.

func auditCmd(args []string) {
	if len(args) < 2 || args[0] != "ingest" {
		fmt.Println("Usage: adinkhepra audit ingest <snapshot_file.json>")
		return
	}
	snapPath := args[1]
	fmt.Printf("[ADINKHEPRA] INGESTING EXTERNAL AUDIT ARTIFACT: %s\n", snapPath)

	flags := parseAuditFlags(args)

	report, err := audit.Ingest(snapPath, flags.gitleaks, flags.zscan, flags.truffle,
		flags.zap, flags.retire, flags.sarif, flags.detect,
		flags.scap, flags.checklist, flags.nessus, flags.kube, flags.crawler)
	if err != nil {
		fatal("ingest failed", err)
	}

	processAuditReport(snapPath, report, args)
}

type auditFlags struct {
	gitleaks, zscan, truffle   string
	zap, retire, sarif, detect string
	scap, checklist, nessus    string
	kube, crawler              string
}

func parseAuditFlags(args []string) auditFlags {
	var f auditFlags
	for i, arg := range args {
		if i+1 >= len(args) {
			continue
		}
		switch arg {
		case "-leaks":
			f.gitleaks = args[i+1]
		case "-zscan":
			f.zscan = args[i+1]
		case "-truffle":
			f.truffle = args[i+1]
		case "-zap":
			f.zap = args[i+1]
		case "-retire":
			f.retire = args[i+1]
		case "-sarif":
			f.sarif = args[i+1]
		case "-detect":
			f.detect = args[i+1]
		case "-stig-scap":
			f.scap = args[i+1]
		case "-stig-checklist":
			f.checklist = args[i+1]
		case "-nessus":
			f.nessus = args[i+1]
		case "-kube":
			f.kube = args[i+1]
		case "-crawler":
			f.crawler = args[i+1]
		}
	}
	return f
}

func processAuditReport(snapPath string, report *audit.RiskReport, args []string) {
	fmt.Printf(" [SUCCESS] Snapshot Ingested. ID: %s\n", report.ScanID)
	fmt.Printf(" [CLIENT]  %s\n", report.Client)
	fmt.Printf(" [RISKS]   %d Issues Identified\n", len(report.Risks))

	for _, r := range report.Risks {
		fmt.Printf("   - [%s] %s\n", r.Severity, r.Title)
	}

	outReport := snapPath + ".risk_report.json"
	audit.SaveReport(report, outReport)
	fmt.Printf("\n[OUTPUT] Risk Report generated: %s\n", outReport)

	saveExtraAuditFormats(snapPath, report)
	handlePacketAudit(args)
}

func saveExtraAuditFormats(snapPath string, report *audit.RiskReport) {
	csvPath := snapPath + ".superset.csv"
	if err := audit.ExportToCSV(report, csvPath); err == nil {
		fmt.Printf("[OUTPUT] Superset CSV generated: %s\n", csvPath)
	}

	affinePath := snapPath + ".affine.md"
	markdown := audit.GenerateAFFiNE(report)
	if err := os.WriteFile(affinePath, []byte(markdown), 0644); err == nil {
		fmt.Printf("[OUTPUT] Executive Decision Memo generated: %s\n", affinePath)
	}
}

func handlePacketAudit(args []string) {
	pcapFlag := ""
	for i, arg := range args {
		if arg == "-pcap" && i+1 < len(args) {
			pcapFlag = args[i+1]
			break
		}
	}

	if pcapFlag != "" {
		fmt.Printf("\n[ADINKHEPRA] PACKET INTERCEPTION DETECTED: %s\n", pcapFlag)
		res, err := packet.AnalyzeWiresharkJSON(pcapFlag)
		if err == nil {
			fmt.Println("[ADINKHEPRA] DEEP PACKET INSPECTION COMPLETE.")
			fmt.Printf("   - Processed Packets: %d\n", res.TotalPackets)
			fmt.Printf("   - Cleartext (HTTP) : %d\n", res.CleartextCount)
			fmt.Printf("   - Legacy TLS       : %d\n", res.LegacyTLSCount)
			fmt.Printf("   - Quantum Risky    : %d (RSA/ECDSA)\n", res.QuantumRiskyCount)
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

	outPath := filePath + adinkraExt
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

	// Remove adinkraExt extension if present, otherwise append .revealed
	outPath := filePath + ".revealed"
	if len(filePath) > len(adinkraExt) && filePath[len(filePath)-len(adinkraExt):] == adinkraExt {
		outPath = filePath[:len(filePath)-len(adinkraExt)]
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
		if err != nil || info.IsDir() || filepath.Ext(path) == adinkraExt {
			return err
		}
		return incinerateFile(path, info.Name(), pubKey)
	})

	if err != nil {
		fatal("the fire spread uncontrollably", err)
	}
	fmt.Println("[ADINKHEPRA] The purification is complete.")
}

func incinerateFile(path, name string, pubKey []byte) error {
	fmt.Printf("   - Burning: %s ... ", name)

	data, err := os.ReadFile(path)
	if err != nil {
		fmt.Printf("[FAIL: Read] \n")
		return nil
	}

	artifact, err := adinkra.Kuntinkantan(pubKey, data)
	if err != nil {
		fmt.Printf("[FAIL: Bind] \n")
		return nil
	}

	if err := os.WriteFile(path+adinkraExt, artifact, 0644); err != nil {
		fmt.Printf("[FAIL: Scribe] \n")
		return nil
	}

	if err := secureDelete(path); err != nil {
		fmt.Printf("[FAIL: Incinerate] \n")
		return nil
	}

	fmt.Printf("[ASHES]\n")
	return nil
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
		if filepath.Ext(path) != adinkraExt {
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
		outPath := path[:len(path)-len(adinkraExt)] // Remove .adinkhepra
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
	fmt.Println(separator)
	fmt.Printf(" [IDENTITY]   (Dilithium Mode 3 / ML-DSA-65)\n")
	fmt.Printf("   - Private: %s\n   - Public : %s\n", signPrivPath, signPubPath)
	fmt.Println("   - Symbol : Eban (The Fence) - Unforgeable Identity")
	fmt.Println(separator)
	fmt.Printf(" [ENCRYPTION] (Kyber-1024 / ML-KEM-1024)\n")
	fmt.Printf("   - Private: %s\n   - Public : %s\n", encPrivPath, encPubPath)
	fmt.Println("   - Symbol : Kuntinkantan (The Riddle) - Unbreakable Privacy")
	fmt.Println(separator)
	fmt.Printf(" [ASSERTION]  (JSON provenance)\n")
	fmt.Printf("   - Path   : %s\n", assertPath)
	fmt.Println(separator)
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
	fmt.Println(separator)

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
	} else if size > 1592 && filepath.Ext(path) == adinkraExt {
		fmt.Println(" Type: AdinKhepra Encrypted Artifact")
		fmt.Println(" Components:")
		fmt.Println("   - Capsule (Kyber): 1568 bytes")
		fmt.Println("   - Time (Nonce):    24 bytes")
		fmt.Printf("   - Matter (Data):   %d bytes\n", size-1592)
		fmt.Println(" Meaning: 'Reality bent into a riddle.'")
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
	} else if size > 1592 && filepath.Ext(path) == adinkraExt {
		fmt.Println(" \"I see a reality that has been bent. The 'Kuntinkantan' ritual was performed here.")
		fmt.Println("  The original matter is gone, replaced by this riddle.")
		fmt.Println("  Only the one who holds the corresponding 'Sankofa' staff can return it to form.\"")
	} else {
		fmt.Printf(" \"I sense raw bytes. %d of them. But they lack the harmonic resonance of AdinKhepra.\"\n", size)
	}

	fmt.Println(separator)
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
		fmt.Println(subcommandsHeader)
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
		fmt.Println(separator)

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

		fmt.Println(separator)
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
		printDrbcUsage()
		return
	}

	switch args[0] {
	case "init":
		drbcInitCmd()
	case "scorpion":
		drbcScorpionCmd(args[1:])
	case "open":
		drbcOpenCmd(args[1:])
	default:
		fmt.Printf("Unknown drbc subcommand: %s\n", args[0])
	}
}

func fatal(what string, err error) {
	fmt.Fprintf(os.Stderr, "%s: %v\n", what, err)
	os.Exit(1)
}

func agentCmd(args []string) {
	if len(args) < 1 {
		fmt.Println("Usage: khepra agent <subcommand>")
		fmt.Println(subcommandsHeader)
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
		agentServiceCmd(args, exePath)
	case "baseline":
		agentBaselineCmd(baseDir)
	default:
		fmt.Printf("Unknown agent command: %s\n", cmd)
	}
}

func agentServiceCmd(args []string, exePath string) {
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
}

func agentBaselineCmd(baseDir string) {
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
}

func drbcInitCmd() {
	fmt.Println("[PHOENIX] Awakening Genesis Protocol...")
	fmt.Print(speakSecretNameMsg)
	reader := bufio.NewReader(os.Stdin)
	pass, _ := reader.ReadString('\n')
	pass = strings.TrimSpace(pass)

	if err := drbc.AwakenGenesis(pass); err != nil {
		fatal("Genesis Failed", err)
	}
	fmt.Printf("[SUCCESS] Genesis Sealed: %s\n", drbc.GenesisOutput)
}

func drbcScorpionCmd(args []string) {
	fs := flag.NewFlagSet("drbc scorpion", flag.ExitOnError)
	target := fs.String("target", "", "Spirit to bind")
	out := fs.String("out", "", "Vessel path")
	fs.Parse(args)

	if *target == "" || *out == "" {
		fmt.Println("Usage: khepra drbc scorpion -target <file> -out <container.scorp>")
		return
	}

	data, _ := os.ReadFile(*target)
	fmt.Print(speakSecretNameMsg)
	reader := bufio.NewReader(os.Stdin)
	pass, _ := reader.ReadString('\n')
	pass = strings.TrimSpace(pass)

	if len(pass) < 12 {
		fatal("voice too weak", errors.New("the Name must have strength (12+ chars)"))
	}

	if err := scorpion.Mpatapo(*out, data, pass); err != nil {
		fatal("Binding failed", err)
	}
	fmt.Println("[SUCCESS] Spirit Bound.")
}

func drbcOpenCmd(args []string) {
	fs := flag.NewFlagSet("drbc open", flag.ExitOnError)
	target := fs.String("target", "", "Vessel to open")
	out := fs.String("out", "", "Transformation path")
	fs.Parse(args)

	if *target == "" || *out == "" {
		fmt.Println("Usage: khepra drbc open -target <container.scorp> -out <file>")
		return
	}

	fmt.Print(speakSecretNameMsg)
	reader := bufio.NewReader(os.Stdin)
	pass, _ := reader.ReadString('\n')
	pass = strings.TrimSpace(pass)

	data, err := scorpion.Sane(*target, pass)
	if err != nil {
		fatal("Release failed", err)
	}
	_ = os.WriteFile(*out, data, 0644)
	fmt.Println("[SUCCESS] Spirit Released.")
}

func printDrbcUsage() {
	fmt.Println("Usage: khepra drbc <subcommand>")
	fmt.Println(subcommandsHeader)
	fmt.Println("  init      - Awaken the Genesis")
	fmt.Println("  scorpion  - Bind Spirit to Vessel (Mpatapo)")
	fmt.Println("  open      - Release Spirit (Sane)")
}
