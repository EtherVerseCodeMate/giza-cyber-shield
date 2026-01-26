package main

import (
	"fmt"
	"log"
	"strings"

	"github.com/xuri/excelize/v2"
)

func main() {
	f, err := excelize.OpenFile("docs/STIG_to_CMMC_Complete_Mapping.xlsx")
	if err != nil {
		log.Fatal(err)
	}
	defer f.Close()

	sheet := "Sheet1"
	rows, _ := f.GetRows(sheet)
	for i, row := range rows {
		fullRow := strings.Join(row, " ")
		if strings.Contains(fullRow, "Level 3") || strings.Contains(fullRow, "172") {
			fmt.Printf("Row %d: %s\n", i, fullRow)
			if i > 100 {
				break
			} // Found something, stop
		}
	}
}
