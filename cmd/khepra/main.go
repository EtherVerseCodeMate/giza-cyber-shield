package main

import (
	"bytes"
	"crypto/ed25519"
	"encoding/json"
	"flag"
	"fmt"
	"os"
	"path/filepath"
	"time"

	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/attest"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/config"
	"github.com/EtherVerseCodeMate/giza-cyber-shield/pkg/util"
)

func main() {
	if len(os.Args) < 2 {
		usage()
		return
	}
	switch os.Args[1] {
	case "keygen":
		keygenCmd(os.Args[2:])
	case "git-remote":
		gitRemoteCmd()
	default:
		usage()
	}
}

func usage() {
	fmt.Println(`khepra CLI
Usage:
  khepra keygen [-out /path/to/id_ed25519] [-tenant value] [-comment value] [-rotate days]
  khepra git-remote   # prints repo SSH remote`)
}

func keygenCmd(args []string) {
	cfg := config.Load()
	fs := flag.NewFlagSet("keygen", flag.ExitOnError)
	out := fs.String("out", filepath.Join(util.HomeDir(), ".ssh", "id_ed25519"), "private key output path")
	tenant := fs.String("tenant", cfg.Tenant, "boundary semantics (Eban)")
	comment := fs.String("comment", cfg.Comment, "OpenSSH comment")
	rotateDays := fs.Int("rotate", cfg.RotateDays, "rotation after N days")
	fs.Parse(args)

	pub, priv, err := util.NewEd25519()
	if err != nil { fatal("generate", err) }

	privPath, pubPath := util.DefaultSSHPaths(*out)
	if err := util.EnsureDir(filepath.Dir(privPath), 0o700); err != nil { fatal("mkdir", err) }
	if err := util.WriteOpenSSHPrivateKey(privPath, priv); err != nil { fatal("write private", err) }
	if err := util.WriteOpenSSHPublicKey(pubPath, pub, *comment); err != nil { fatal("write public", err) }

	pubBytes, _ := os.ReadFile(pubPath)
	binding := util.SHA256Hex(pubBytes)

	ka := attest.Assertion{
		Schema: "https://khepra.dev/attest/v1",
		Symbol: "Eban",
		Semantics: attest.Semantics{
			Boundary: *tenant, Purpose: "ssh-login", LeastPrivilege: true,
		},
		Lifecycle: attest.Lifecycle{
			Journey: "Nkyinkyim", CreatedAt: time.Now().UTC(), RotationAfterND: *rotateDays,
		},
		Binding: attest.Binding{
			OpenSSHPubSHA256: binding, Comment: *comment,
		},
	}

	assertPath := pubPath + ".khepra.json"
	if err := util.WriteJSON(assertPath, ka); err != nil { fatal("write assertion", err) }

	// (Optional) sign assertion with the private key seed for demo provenance
	buf := bytes.NewBuffer(nil)
	buf.Write(pubBytes)
	j, _ := json.Marshal(ka)
	buf.Write(j)
	_ = ed25519.Sign(ed25519.PrivateKey(priv), buf.Bytes()) // drop on floor for MVP

	fmt.Println("KHEPRA key material generated.")
	fmt.Printf("  Private: %s\n  Public : %s\n  Assert : %s\n", privPath, pubPath, assertPath)
	fmt.Printf("SSH Command: ssh -p %d %s@%s\n", cfg.SSHExternalPort, cfg.Username, cfg.ExternalIP)
	util.PrintNextSteps(pubPath)
}

func gitRemoteCmd() {
	fmt.Println("git@github.com:EtherVerseCodeMate/giza-cyber-shield.git")
}

func fatal(what string, err error) {
	fmt.Fprintf(os.Stderr, "%s: %v\n", what, err)
	os.Exit(1)
}
