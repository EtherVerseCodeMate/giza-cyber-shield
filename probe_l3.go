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
				// Check for "172", "Level 3", or "L3" in header or first 10 rows
				if count == 0 {
					fmt.Printf("  Header: %v\n", row)
				}
				
				if strings.Contains(rowStr, "800-172") || strings.Contains(rowStr, "Level 3") || strings.Contains(rowStr, "L3") {
					fmt.Printf("  [FOUND] L3/172 data at row %d: %s\n", count, rowStr)
					if count > 5 { break } // Found enough to confirm coverage
				}
				
				if count > 100 && !strings.Contains(sheet, "L3") { break } // Optimization
				count++
			}
			rows.Close()
		}
		f.Close()
	}
}
