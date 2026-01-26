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
		for _, sheet := range sheets {
			fmt.Printf("Sheet: %s\n", sheet)
			
			rows, err := f.Rows(sheet)
			if err != nil {
				continue
			}
			
			count := 0
			for rows.Next() {
				row, _ := rows.Columns()
				rowStr := strings.Join(row, " ")
				
				// Look for Level 3 or 172 indicators
				if strings.Contains(rowStr, "172") || strings.Contains(rowStr, "Level 3") || strings.Contains(rowStr, "L3") {
					fmt.Printf("  [FOUND] Row %d: %s\n", count, rowStr)
				}
				
				if count > 20 && !strings.Contains(sheet, "L3") { break }
				if count > 500 { break } // Sanity limit for L3 sheets
				count++
			}
			rows.Close()
		}
		f.Close()
	}
}
