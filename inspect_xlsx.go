package main

import (
	"fmt"
	"log"
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
				fmt.Printf("  Error opening rows: %v\n", err)
				continue
			}

			count := 0
			for rows.Next() {
				row, _ := rows.Columns()
				if count == 0 {
					fmt.Printf("  Header: %v\n", row)
				} else if count == 1 {
					fmt.Printf("  Row 1:  %v\n", row)
					break
				}
				count++
			}
			rows.Close()
		}
		f.Close()
	}
}
