// cmd/asaf-confedit — Idempotent Configuration File Editor
//
// Authorized by the ASAF daemon under the Nkyinkyim symbol for all
// key=value configuration file mutations.  Replaces shell-based config
// editing (bash -c / sed) throughout the ASAF remediation pipeline.
//
// Usage: asaf-confedit <file> <key> <value>
//
// Guarantees:
//   - Idempotent: running twice with the same args produces the same file.
//   - Atomic: writes to <file>.asaf-tmp then renames into place.
//   - Snapshot: backs up the original to /var/khepra/backups before any write.
//   - No shell: argv only, zero metacharacter injection surface.
//   - Handles both active directives and commented-out duplicates.
//
// IP: SecRed Knowledge Inc. / SOUHIMBOU DOH KONE LLC — USPTO #73565085
package main

import (
	"bufio"
	"fmt"
	"os"
	"path/filepath"
	"strings"
	"time"
)

func main() {
	if len(os.Args) != 4 {
		fmt.Fprintf(os.Stderr, "usage: asaf-confedit <file> <key> <value>\n")
		os.Exit(1)
	}
	filePath := os.Args[1]
	key := os.Args[2]
	value := os.Args[3]

	if err := editConfig(filePath, key, value); err != nil {
		fmt.Fprintf(os.Stderr, "asaf-confedit: %v\n", err)
		os.Exit(1)
	}
}

// editConfig reads filePath, updates (or appends) key=value, snapshots the
// original, and atomically rewrites the file.  The format handled is the
// OpenSSH sshd_config style: "Key Value" lines, with "#"-prefixed comments.
func editConfig(path, key, value string) error {
	// 1. Read original content.
	f, err := os.Open(path)
	if err != nil {
		return fmt.Errorf("open %s: %w", path, err)
	}
	var originalLines []string
	scanner := bufio.NewScanner(f)
	for scanner.Scan() {
		originalLines = append(originalLines, scanner.Text())
	}
	f.Close()
	if err := scanner.Err(); err != nil {
		return fmt.Errorf("scan %s: %w", path, err)
	}

	// 2. Snapshot original before any write.
	backupDir := backupDirectory()
	if err := os.MkdirAll(backupDir, 0700); err != nil {
		return fmt.Errorf("mkdir backup dir %s: %w", backupDir, err)
	}
	backupName := fmt.Sprintf("%s.%d.bak", filepath.Base(path), time.Now().Unix())
	backupPath := filepath.Join(backupDir, backupName)
	if err := copyFile(path, backupPath); err != nil {
		return fmt.Errorf("snapshot %s → %s: %w", path, backupPath, err)
	}

	// 3. Rewrite: update existing directive or append.
	newLines, changed := rewriteLines(originalLines, key, value)

	if !changed {
		fmt.Printf("asaf-confedit: %s already has %s %s — no change\n", path, key, value)
		// Snapshot was created; clean it up since no write will happen.
		os.Remove(backupPath)
		return nil
	}

	// 4. Write atomically: tmp → rename.
	tmpPath := path + ".asaf-tmp"
	out, err := os.OpenFile(tmpPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0600)
	if err != nil {
		return fmt.Errorf("open tmp %s: %w", tmpPath, err)
	}
	w := bufio.NewWriter(out)
	for i, line := range newLines {
		if i > 0 {
			w.WriteByte('\n')
		}
		w.WriteString(line)
	}
	// Preserve a trailing newline if the original had one.
	if len(originalLines) > 0 {
		w.WriteByte('\n')
	}
	if err := w.Flush(); err != nil {
		out.Close()
		os.Remove(tmpPath)
		return fmt.Errorf("flush %s: %w", tmpPath, err)
	}
	if err := out.Close(); err != nil {
		os.Remove(tmpPath)
		return fmt.Errorf("close %s: %w", tmpPath, err)
	}
	if err := os.Rename(tmpPath, path); err != nil {
		os.Remove(tmpPath)
		return fmt.Errorf("rename %s → %s: %w", tmpPath, path, err)
	}

	fmt.Printf("asaf-confedit: set %s %s in %s (snapshot: %s)\n", key, value, path, backupName)
	return nil
}

// rewriteLines returns the updated line slice and whether any change was made.
// Rules:
//   - The first uncommented directive matching key (case-insensitive) is updated
//     to the target value.  If it already has the target value, no change is made.
//   - Any subsequent uncommented duplicates of the same key are commented out.
//   - Commented lines (#Key ...) are left untouched.
//   - If no active directive exists, the key=value pair is appended.
//
// Supported formats (auto-detected from the file; separator preserved on write):
//   "Key Value"      — sshd_config, /etc/default/* style
//   "key = value"    — faillock.conf, pwquality.conf, sysctl.d style
//   "key=value"      — compact INI style
func rewriteLines(lines []string, key, value string) ([]string, bool) {
	out := make([]string, 0, len(lines)+1)
	found := false
	alreadyCorrect := false

	// Detect the file's prevailing separator for use when appending a new line.
	appendSep := detectFileSeparator(lines)

	for _, line := range lines {
		trimmed := strings.TrimSpace(line)

		if strings.HasPrefix(trimmed, "#") || trimmed == "" {
			out = append(out, line)
			continue
		}

		lineKey, currentVal := parseKeyValue(trimmed)
		if strings.EqualFold(lineKey, key) {
			if !found {
				if currentVal == value {
					// Already correct — idempotent; preserve line verbatim.
					out = append(out, line)
					alreadyCorrect = true
				} else {
					// Rewrite with new value, preserving leading whitespace and
					// the original separator (space / " = " / "=").
					indent := leadingWhitespace(line)
					sep := detectLineSeparator(trimmed)
					out = append(out, indent+key+sep+value)
				}
				found = true
			} else {
				// Duplicate active directive — comment it out.
				out = append(out, "# "+line)
			}
			continue
		}
		out = append(out, line)
	}

	if !found {
		out = append(out, key+appendSep+value)
		return out, true
	}
	return out, !alreadyCorrect
}

// parseKeyValue extracts the key and value from a config file line.
// Handles three separator styles:
//   "Key Value"   → key="Key",   value="Value"
//   "key = value" → key="key",   value="value"
//   "key=value"   → key="key",   value="value"   (single token — no spaces)
// The line must already be trimmed of leading/trailing whitespace.
func parseKeyValue(trimmed string) (key, value string) {
	fields := strings.Fields(trimmed)
	if len(fields) == 0 {
		return "", ""
	}
	// Compact "key=value" — entire pair is one token when there are no spaces.
	if idx := strings.Index(fields[0], "="); idx > 0 {
		return fields[0][:idx], fields[0][idx+1:]
	}
	key = fields[0]
	switch {
	case len(fields) >= 3 && fields[1] == "=":
		// "key = value" — value may be multi-token; join the rest.
		value = strings.Join(fields[2:], " ")
	case len(fields) >= 2:
		// "Key Value" — plain space-separated.
		value = strings.Join(fields[1:], " ")
	}
	return key, value
}

// detectLineSeparator returns the separator used in a single trimmed line.
func detectLineSeparator(trimmed string) string {
	fields := strings.Fields(trimmed)
	// Compact "key=value" — single token with embedded "=".
	if len(fields) >= 1 && strings.Contains(fields[0], "=") {
		return "="
	}
	if len(fields) >= 2 && fields[1] == "=" {
		return " = "
	}
	return " "
}

// detectFileSeparator returns the prevailing separator style across all
// non-comment, non-empty lines, for use when appending a new directive.
func detectFileSeparator(lines []string) string {
	for _, line := range lines {
		trimmed := strings.TrimSpace(line)
		if strings.HasPrefix(trimmed, "#") || trimmed == "" {
			continue
		}
		return detectLineSeparator(trimmed)
	}
	return " "
}

// leadingWhitespace returns the leading whitespace characters of s.
func leadingWhitespace(s string) string {
	for i, r := range s {
		if r != ' ' && r != '\t' {
			return s[:i]
		}
	}
	return ""
}

// backupDirectory returns the platform-appropriate snapshot directory.
func backupDirectory() string {
	if os.Getenv("OS") == "Windows_NT" {
		appdata := os.Getenv("APPDATA")
		if appdata == "" {
			appdata = os.TempDir()
		}
		return filepath.Join(appdata, "khepra", "backups")
	}
	return "/var/khepra/backups"
}

// copyFile copies src to dst, preserving content.
func copyFile(src, dst string) error {
	data, err := os.ReadFile(src)
	if err != nil {
		return err
	}
	// Snapshot uses 0600 regardless of source mode (config files are typically 0644/0640).
	return os.WriteFile(dst, data, 0600)
}
