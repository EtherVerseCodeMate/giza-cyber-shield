package main

import (
	"fmt"
	"log"
	"strings"
	"github.com/xuri/excelize/v2"
)

func main() {
	files := []string{
		"docs/STIG_to_NIST171_Mapping_Ultimate.xlsx",
		"docs/STIG_to_CMMC_Complete_Mapping.xlsx",
	}

	for _, path := range files {
		f, err := excelize.OpenFile(path)
		if err != nil {
			log.Printf("Error opening %s: %v", path, err)
			continue
		}
		
		fmt.Printf("\n--- File: %s ---\n", path)
		sheets := f.GetSheetList()
		fmt.Printf("Sheets found: %v\n", sheets)
		
		for _, sheet := range sheets {
			// Just check for L3 / 172 in sheet name or first 100 rows
			if strings.Contains(sheet, "L3") || strings.Contains(sheet, "172") {
				fmt.Printf("  [MATCH] Found sheet: %s\n", sheet)
			}
			
			rows, _ := f.GetRows(sheet)
			for i, row := range rows {
				if i > 100 { break } // Only first 100 rows
				rowStr := strings.Join(row, " ")
				if strings.Contains(rowStr, "800-172") || strings.Contains(rowStr, "Level 3") {
					fmt.Printf("  [MATCH] Found L3/172 reference in %s at row %d\n", sheet, i)
					break
				}
			}
		}
		f.Close()
	}
}
