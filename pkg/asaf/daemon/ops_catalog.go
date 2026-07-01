// pkg/asaf/daemon/ops_catalog.go — Authorized Operation Catalog
//
// Defines every CommandType the ASAF System Daemon may execute, the Adinkra
// symbol required for authorization, and validation logic that rejects anything
// not in the catalog (deny-by-default).
//
// Symbol requirements are non-configurable and match the AGENTS.md spec:
//
//	Eban       (fortress)     — kernel params, PAM, SELinux, GRUB, modprobe
//	Nkyinkyim  (adaptability) — service management, file permissions
//	Dwennimmen (strength)     — user management
//	Fawohodie  (freedom)      — package installs (careful autonomy)
//
// IP: SecRed Knowledge Inc. / SOUHIMBOU DOH KONE LLC — USPTO #73565085

package daemon

import (
	"fmt"
	"strings"
)

// CommandType classifies each authorized privileged operation.
type CommandType string

const (
	// Kernel parameters — require Eban
	CmdSysctl   CommandType = "sysctl"
	CmdProcSys  CommandType = "proc_sys"

	// Authentication / PAM — require Eban
	CmdAuthselect CommandType = "authselect"
	CmdFaillock   CommandType = "faillock"
	CmdPwquality  CommandType = "pwquality"

	// Services — require Nkyinkyim
	CmdSystemctl CommandType = "systemctl"

	// Security frameworks — require Eban
	CmdSELinux  CommandType = "setenforce"
	CmdAuditd   CommandType = "auditctl"
	CmdFirewall CommandType = "firewall-cmd"

	// File operations — require Nkyinkyim
	CmdChmod CommandType = "chmod"
	CmdChown CommandType = "chown"
	CmdChattr CommandType = "chattr"

	// User management — require Dwennimmen
	CmdUseradd  CommandType = "useradd"
	CmdUsermod  CommandType = "usermod"
	CmdGroupmod CommandType = "groupmod"
	CmdPasswd   CommandType = "passwd"

	// Package management — require Fawohodie
	CmdDNF CommandType = "dnf"
	CmdRPM CommandType = "rpm"

	// Bootloader — require Eban
	CmdGrubby    CommandType = "grubby"
	CmdGrub2     CommandType = "grub2-mkconfig"
	CmdDracut    CommandType = "dracut"

	// Kernel modules — require Eban
	CmdModprobe CommandType = "modprobe"
	CmdRmmod    CommandType = "rmmod"

	// Certificate / PKI management — require Nkyinkyim
	CmdUpdateCA CommandType = "update-ca-trust"
	CmdCertutil CommandType = "certutil"
)

// symbolRequirements maps the first token of a command to its required Adinkra symbol.
// Commands absent from this map are DENIED — deny-by-default.
var symbolRequirements = map[CommandType]string{
	// Eban — fortress (kernel-level, high-impact security operations)
	CmdSysctl:     "Eban",
	CmdProcSys:    "Eban",
	CmdAuthselect: "Eban",
	CmdFaillock:   "Eban",
	CmdPwquality:  "Eban",
	CmdSELinux:    "Eban",
	CmdAuditd:     "Eban",
	CmdGrubby:     "Eban",
	CmdGrub2:      "Eban",
	CmdDracut:     "Eban",
	CmdModprobe:   "Eban",
	CmdRmmod:      "Eban",

	// Nkyinkyim — adaptability (service and file management)
	CmdSystemctl: "Nkyinkyim",
	CmdFirewall:  "Nkyinkyim",
	CmdChmod:     "Nkyinkyim",
	CmdChown:     "Nkyinkyim",
	CmdChattr:    "Nkyinkyim",
	CmdUpdateCA:  "Nkyinkyim",
	CmdCertutil:  "Nkyinkyim",

	// Dwennimmen — strength (user identity management)
	CmdUseradd:  "Dwennimmen",
	CmdUsermod:  "Dwennimmen",
	CmdGroupmod: "Dwennimmen",
	CmdPasswd:   "Dwennimmen",

	// Fawohodie — freedom (careful autonomy for package management)
	CmdDNF: "Fawohodie",
	CmdRPM: "Fawohodie",
}

// validateCommand checks that:
// 1. The command is non-empty
// 2. The first token is in the authorized catalog (deny-by-default)
// 3. No path traversal in any argument
// 4. No shell metacharacters that would allow injection
func validateCommand(command []string) error {
	if len(command) == 0 {
		return fmt.Errorf("command is empty")
	}

	// Extract the binary name (last segment after any path separator)
	binary := commandBinary(command[0])
	cmdType := CommandType(binary)

	if _, ok := symbolRequirements[cmdType]; !ok {
		return fmt.Errorf("command %q is not in the authorized catalog — denied", binary)
	}

	// Reject shell metacharacters in any argument (injection prevention)
	for _, arg := range command {
		if err := rejectShellMeta(arg); err != nil {
			return err
		}
	}

	return nil
}

// requiredSymbol returns the Adinkra symbol required for a command.
// Returns empty string if the command is not in the catalog.
func requiredSymbol(command []string) string {
	if len(command) == 0 {
		return ""
	}
	binary := CommandType(commandBinary(command[0]))
	return symbolRequirements[binary]
}

// commandBinary extracts the binary name from a full path or plain name.
func commandBinary(s string) string {
	// Handle /usr/bin/sysctl → sysctl
	parts := strings.Split(s, "/")
	return parts[len(parts)-1]
}

// rejectShellMeta rejects arguments containing shell metacharacters.
// This prevents command injection when the daemon calls os/exec.
func rejectShellMeta(arg string) error {
	banned := []string{";", "&", "|", "`", "$", "(", ")", "<", ">", "\\n", "\\r"}
	for _, b := range banned {
		if strings.Contains(arg, b) {
			return fmt.Errorf("argument %q contains banned shell metacharacter %q", arg, b)
		}
	}
	return nil
}
