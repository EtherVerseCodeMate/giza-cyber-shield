// Package connector — CSVImporter: Mode B bulk asset enrollment from CSV files.
//
// Supports two column-mapping strategies:
//   - Auto-detect: recognizes standard header names (hostname, ip, os, enclave, stig_profile)
//   - Manual map:  caller provides a ColumnMap{Field → ColumnIndex} built from the UI
//
// Validates required fields, deduplicates by IP, and returns []CSVAssetRow + ImportResult.
//
// Copyright: SOUHIMBOU DOH KONE LLC — exclusively licensed to SecRed Knowledge Inc.
// Patent Pending: USPTO #73565085
package connector

import (
	"context"
	"encoding/csv"
	"fmt"
	"io"
	"os"
	"strings"
)

// ColumnMap maps a logical field name to a zero-based CSV column index.
// Use -1 to indicate "not mapped / auto-detect".
type ColumnMap struct {
	Hostname    int // required (or IPAddress must be set)
	IPAddress   int // required (or Hostname must be set)
	OS          int // optional — triggers AutoDetectSTIGProfile if missing
	Enclave     int // optional
	STIGProfile int // optional
}

// AutoColumnMap returns a ColumnMap built from CSV headers (case-insensitive).
// Returns an error if neither hostname nor ip column is found.
func AutoColumnMap(headers []string) (ColumnMap, error) {
	cm := ColumnMap{Hostname: -1, IPAddress: -1, OS: -1, Enclave: -1, STIGProfile: -1}
	for i, h := range headers {
		switch strings.ToLower(strings.TrimSpace(h)) {
		case "hostname", "host", "name", "fqdn":
			cm.Hostname = i
		case "ip", "ip_address", "ipaddress", "ip address", "address":
			cm.IPAddress = i
		case "os", "operating_system", "platform":
			cm.OS = i
		case "enclave", "network", "vlan", "segment", "boundary":
			cm.Enclave = i
		case "stig_profile", "stig", "profile", "stig profile":
			cm.STIGProfile = i
		}
	}
	if cm.Hostname == -1 && cm.IPAddress == -1 {
		return cm, fmt.Errorf("CSV has no hostname or IP column — found headers: %v", headers)
	}
	return cm, nil
}

// CSVImporter imports assets from a CSV file.
type CSVImporter struct {
	DefaultEnclave string // used when the CSV has no enclave column
}

// NewCSVImporter creates a CSVImporter. defaultEnclave is used when the CSV
// doesn't include an enclave column (e.g. "Local Enclave").
func NewCSVImporter(defaultEnclave string) *CSVImporter {
	return &CSVImporter{DefaultEnclave: defaultEnclave}
}

// ParseFile reads the CSV at path, auto-detects columns, and returns rows + headers.
// Call this first to show the column mapper in the UI.
func (im *CSVImporter) ParseFile(ctx context.Context, path string) (headers []string, rows [][]string, err error) {
	f, err := os.Open(path)
	if err != nil {
		return nil, nil, fmt.Errorf("csv open: %w", err)
	}
	defer f.Close()
	return im.ParseReader(ctx, f)
}

// ParseReader reads CSV from an io.Reader. Useful for drag-drop where the OS
// provides a reader rather than a file path.
func (im *CSVImporter) ParseReader(_ context.Context, r io.Reader) (headers []string, rows [][]string, err error) {
	reader := csv.NewReader(r)
	reader.TrimLeadingSpace = true
	reader.LazyQuotes = true

	all, err := reader.ReadAll()
	if err != nil {
		return nil, nil, fmt.Errorf("csv parse: %w", err)
	}
	if len(all) == 0 {
		return nil, nil, fmt.Errorf("csv file is empty")
	}
	headers = all[0]
	if len(all) > 1 {
		rows = all[1:]
	}
	return headers, rows, nil
}

// Import converts raw CSV rows into CSVAssetRows using the provided ColumnMap.
// Returns the asset rows, an ImportResult summary, and any per-row error strings.
func (im *CSVImporter) Import(headers []string, rows [][]string, cm ColumnMap) ([]CSVAssetRow, ImportResult, error) {
	result := ImportResult{Total: len(rows)}
	var assets []CSVAssetRow
	seen := make(map[string]bool) // dedup by IP

	for i, row := range rows {
		if len(row) == 0 {
			result.Skipped++
			continue
		}

		a := CSVAssetRow{
			Extra:    make(map[string]string),
			Enclave:  im.DefaultEnclave,
		}

		// Extract mapped fields.
		a.Hostname   = colVal(row, cm.Hostname)
		a.IPAddress  = colVal(row, cm.IPAddress)
		a.OS         = colVal(row, cm.OS)
		a.STIGProfile = colVal(row, cm.STIGProfile)
		if cm.Enclave >= 0 && colVal(row, cm.Enclave) != "" {
			a.Enclave = colVal(row, cm.Enclave)
		}

		// Capture unmapped columns as Extra.
		mapped := map[int]bool{
			cm.Hostname: true, cm.IPAddress: true,
			cm.OS: true, cm.Enclave: true, cm.STIGProfile: true,
		}
		for j, val := range row {
			if !mapped[j] && j < len(headers) {
				a.Extra[headers[j]] = val
			}
		}

		// Validate: need at least hostname or IP.
		if a.Hostname == "" && a.IPAddress == "" {
			result.Errors = append(result.Errors,
				fmt.Sprintf("row %d: missing hostname and IP — skipped", i+2))
			result.Skipped++
			continue
		}

		// Dedup by IP (if available).
		if a.IPAddress != "" {
			if seen[a.IPAddress] {
				result.Errors = append(result.Errors,
					fmt.Sprintf("row %d: duplicate IP %s — skipped", i+2, a.IPAddress))
				result.Skipped++
				continue
			}
			seen[a.IPAddress] = true
		}

		// Auto-detect STIG profile if not provided.
		if a.STIGProfile == "" && a.OS != "" {
			a.STIGProfile = AutoDetectSTIGProfile(a.OS)
		}

		assets = append(assets, a)
		result.Enrolled++
	}

	return assets, result, nil
}

// ImportFile is a convenience that does ParseFile + AutoColumnMap + Import in one call.
func (im *CSVImporter) ImportFile(ctx context.Context, path string) ([]CSVAssetRow, ImportResult, error) {
	headers, rows, err := im.ParseFile(ctx, path)
	if err != nil {
		return nil, ImportResult{}, err
	}
	cm, err := AutoColumnMap(headers)
	if err != nil {
		return nil, ImportResult{}, err
	}
	return im.Import(headers, rows, cm)
}

// PreviewRows returns up to n rows formatted for UI display (key→value maps).
func PreviewRows(headers []string, rows [][]string, n int) []map[string]string {
	if n > len(rows) {
		n = len(rows)
	}
	out := make([]map[string]string, n)
	for i := 0; i < n; i++ {
		m := make(map[string]string, len(headers))
		for j, h := range headers {
			if j < len(rows[i]) {
				m[h] = rows[i][j]
			}
		}
		out[i] = m
	}
	return out
}

// colVal safely reads a cell by column index. Returns "" if idx < 0 or out of range.
func colVal(row []string, idx int) string {
	if idx < 0 || idx >= len(row) {
		return ""
	}
	return strings.TrimSpace(row[idx])
}
