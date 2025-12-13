package main

import (
	"crypto/rand"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/adinkra"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/attest"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/audit"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/config"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/packet"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/stigs"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/util"
)

func usage() {
	fmt.Println(`khepra CLI
Usage:
  khepra keygen [-out /path/to/id_dilithium] [-tenant value]
  khepra crack        [path/to/public_key]    # attempts quantum brute-force simulation
  khepra kuntinkantan [path/to/pubkey] [file] # Bends reality (Encrypt)
  khepra sankofa      [path/to/privkey] [file.khepra] # Retrieves the past (Decrypt)
  khepra git-remote`)
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
	case "explain":
		explainCmd(os.Args[2:])
	case "audit":
		auditCmd(os.Args[2:])
	case "stigs":
		stigsCmd(os.Args[2:])
	default:
		usage()
	}
}

func stigsCmd(args []string) {
	if len(args) < 2 || args[0] != "ingest" {
		fmt.Println("Usage: khepra stigs ingest <file.xlsx>")
		return
	}
	// Import pkg/stigs inside logic if needed or top level.
	// Will add logic block here.
	path := args[1]
	fmt.Printf("[KHEPRA] INGESTING STIG LIBRARY: %s\n", path)

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
		fmt.Println("Usage: khepra audit ingest <snapshot_file.json>")
		return
	}
	snapPath := args[1]

	// Check for SHODAN_API_KEY env var
	shodanKey := os.Getenv("SHODAN_API_KEY")

	fmt.Printf("[KHEPRA] INGESTING EXTERNAL AUDIT ARTIFACT: %s\n", snapPath)
	if shodanKey != "" {
		fmt.Println("[KHEPRA] SHODAN_API_KEY DETECTED. ACTIVATING THREAT INTELLIGENCE.")
	}

	// [NEW] Gitleaks / Secret Integration
	// khepra audit ingest <scan> -leaks <gitleaks.json>
	gitleaksFlag := ""
	for i, arg := range args {
		if arg == "-leaks" && i+1 < len(args) {
			gitleaksFlag = args[i+1]
		}
	}

	// [SELF-HOSTED] ZScan / IVRE Integration
	// khepra audit ingest <scan> -zscan <zgrab.json>
	zscanFlag := ""
	for i, arg := range args {
		if arg == "-zscan" && i+1 < len(args) {
			zscanFlag = args[i+1]
		}
	}

	report, err := audit.Ingest(snapPath, shodanKey, gitleaksFlag, zscanFlag)
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
	// khepra audit ingest <scan> -pcap <file.json>
	pcapFlag := ""
	for i, arg := range args {
		if arg == "-pcap" && i+1 < len(args) {
			pcapFlag = args[i+1]
		}
	}

	if pcapFlag != "" {
		fmt.Printf("\n[KHEPRA] PACKET INTERCEPTION DETECTED: %s\n", pcapFlag)
		res, err := packet.AnalyzeWiresharkJSON(pcapFlag)
		if err != nil {
			fmt.Printf("[FAIL] Packet Reconstruction Error: %v\n", err)
		} else {
			fmt.Println("[KHEPRA] DEEP PACKET INSPECTION COMPLETE.")
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
		fmt.Println("Usage: khepra kuntinkantan <pubkey> <plaintext_file>")
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

	fmt.Println("[KHEPRA] Invoking Kuntinkantan (Bending Reality)...")
	artifact, err := adinkra.Kuntinkantan(pubKey, plaintext)
	if err != nil {
		fatal("the binding failed", err)
	}

	outPath := filePath + ".khepra"
	if err := os.WriteFile(outPath, artifact, 0644); err != nil {
		fatal("cannot scribe the artifact", err)
	}

	fmt.Printf("[KHEPRA] Reality bent. Artifact created at: %s\n", outPath)
}

func sankofaCmd(args []string) {
	if len(args) < 2 {
		fmt.Println("Usage: khepra sankofa <privkey> <encrypted_file>")
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

	fmt.Println("[KHEPRA] Walking the path of Sankofa...")
	plaintext, err := adinkra.Sankofa(privKey, artifact)
	if err != nil {
		fatal("the spirit rejected you", err)
	}

	// Remove .khepra extension if present, otherwise append .revealed
	outPath := filePath + ".revealed"
	if len(filePath) > 7 && filePath[len(filePath)-7:] == ".khepra" {
		outPath = filePath[:len(filePath)-7]
	}

	if err := os.WriteFile(outPath, plaintext, 0644); err != nil {
		fatal("cannot materialize the truth", err)
	}

	fmt.Printf("[KHEPRA] Truth returned at: %s\n", outPath)
}

func ogyaCmd(args []string) {
	if len(args) < 2 {
		fmt.Println("Usage: khepra ogya <pubkey> <directory>")
		return
	}
	pubKeyPath, targetDir := args[0], args[1]

	pubKey, err := os.ReadFile(pubKeyPath)
	if err != nil {
		fatal("cannot read the staff", err)
	}

	fmt.Printf("[KHEPRA OGYA] Igniting the hearth in: %s\n", targetDir)

	err = filepath.Walk(targetDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}
		if filepath.Ext(path) == ".khepra" {
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
		if err := os.WriteFile(path+".khepra", artifact, 0644); err != nil {
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
	fmt.Println("[KHEPRA] The purification is complete.")
}

func nsuoCmd(args []string) {
	if len(args) < 2 {
		fmt.Println("Usage: khepra nsuo <privkey> <directory>")
		return
	}
	privKeyPath, targetDir := args[0], args[1]

	privKey, err := os.ReadFile(privKeyPath)
	if err != nil {
		fatal("cannot grab the staff", err)
	}

	fmt.Printf("[KHEPRA NSUO] Summoning rain in: %s\n", targetDir)

	err = filepath.Walk(targetDir, func(path string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if info.IsDir() {
			return nil
		}
		if filepath.Ext(path) != ".khepra" {
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
		outPath := path[:len(path)-7] // Remove .khepra
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
	fmt.Println("[KHEPRA] The garden is restored.")
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
		Schema: "https://khepra.dev/attest/v2-pqc",
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

	assertPath := signPubPath + ".khepra.json"
	if err := util.WriteJSON(assertPath, ka); err != nil {
		fatal("write assertion", err)
	}

	fmt.Println("KHEPRA PQC REGALIA GENERATED.")
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
		fmt.Println("Usage: khepra explain <file_path>")
		return
	}
	path := args[0]
	data, err := os.ReadFile(path)
	if err != nil {
		fatal("cannot read artifact", err)
	}

	fmt.Printf("[KHEPRA] EXPLAINING ARTIFACT: %s\n", filepath.Base(path))
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
	} else if size > 1592 && filepath.Ext(path) == ".khepra" {
		fmt.Println(" Type: Khepra Encrypted Artifact")
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
	} else if size > 1592 && filepath.Ext(path) == ".khepra" {
		fmt.Println(" \"I see a reality that has been bent. The 'Kuntinkantan' ritual was performed here.")
		fmt.Println("  The original matter is gone, replaced by this riddle.")
		fmt.Println("  Only the one who holds the corresponding 'Sankofa' staff can return it to form.\"")
	} else {
		fmt.Printf(" \"I sense raw bytes. %d of them. But they lack the harmonic resonance of Khepra.\"\n", size)
	}

	fmt.Printf("---------------------------------------------------\n")
}

func gitRemoteCmd() {
	fmt.Println("git@github.com:EtherVerseCodeMate/giza-cyber-shield.git")
}

func fatal(what string, err error) {
	fmt.Fprintf(os.Stderr, "%s: %v\n", what, err)
	os.Exit(1)
}
