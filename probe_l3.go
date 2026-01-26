package main

import (
	"fmt"
	"log"

	"github.com/xuri/excelize/v2"
)

func main() {
	f, err := excelize.OpenFile("docs/STIG_to_NIST171_Mapping_Ultimate.xlsx")
	if err != nil {
		log.Fatal(err)
	}
	defer f.Close()

	sheet := "STIG_to_CMMC_Complete Mapping"
	fmt.Printf("--- Sheet: %s ---\n", sheet)

	rows, err := f.GetRows(sheet)
	if err != nil {
		log.Fatal(err)
	}

	for i, row := range rows {
		if i >= 30 {
			break
		}
		fmt.Printf("Row %d: %v\n", i, row)
	}
}
