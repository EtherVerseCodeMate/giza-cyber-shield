package main

import (
	"fmt"
	"log"
	"strings"

	"github.com/xuri/excelize/v2"
)

func main() {
	f, err := excelize.OpenFile("docs/STIG_to_NIST171_Mapping_Ultimate.xlsx")
	if err != nil {
		log.Fatal(err)
	}
	defer f.Close()

	sheet := "STIG_to_CMMC_Complete Mapping"
	fmt.Printf("--- Searching for 172/L3 in %s ---\n", sheet)

	rows, err := f.GetRows(sheet)
	if err != nil {
		log.Fatal(err)
	}

	for i, row := range rows {
		fullRow := strings.Join(row, " | ")
		if strings.Contains(fullRow, "800-172") || strings.Contains(fullRow, "Level 3") || strings.Contains(fullRow, "L3-") {
			fmt.Printf("Row %d: %s\n", i, fullRow)
			if i > 40000 {
				break
			} // Just to avoid massive output
		}
	}
}
