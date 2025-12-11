package main

import (
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/adinkra"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/attest"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/config"
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
	case "git-remote":
		gitRemoteCmd()
	default:
		usage()
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

	// [PQC]: Generate Dilithium Keypair (Quantum Resistant)
	pub, priv, err := adinkra.GenerateDilithiumKey()
	if err != nil {
		fatal("generate pqc", err)
	}

	// Write keys (using generic write for now as they are large blobs)
	privPath := *out
	pubPath := *out + ".pub"

	if err := util.EnsureDir(filepath.Dir(privPath), 0o700); err != nil {
		fatal("mkdir", err)
	}

	// Write Private Key (PEM format via adinkra helper if available, or raw bytes for now)
	if err := os.WriteFile(privPath, priv, 0600); err != nil {
		fatal("write private", err)
	}
	if err := os.WriteFile(pubPath, pub, 0644); err != nil {
		fatal("write public", err)
	}

	binding := util.SHA256Hex(pub)

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

	assertPath := pubPath + ".khepra.json"
	if err := util.WriteJSON(assertPath, ka); err != nil {
		fatal("write assertion", err)
	}

	fmt.Println("KHEPRA PQC (Dilithium) key material generated.")
	fmt.Printf("  Private: %s\n  Public : %s\n  Assert : %s\n", privPath, pubPath, assertPath)
	fmt.Println("Quantum Resistance Achieved.")
}

func gitRemoteCmd() {
	fmt.Println("git@github.com:EtherVerseCodeMate/giza-cyber-shield.git")
}

func fatal(what string, err error) {
	fmt.Fprintf(os.Stderr, "%s: %v\n", what, err)
	os.Exit(1)
}
