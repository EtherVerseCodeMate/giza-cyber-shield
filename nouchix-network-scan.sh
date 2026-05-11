#!/bin/bash
# NouchiX STIGs Discovery - Network Scanning Script
# Requires: nmap, jq

SCAN_RANGES="192.168.1.0/24"
OUTPUT_FILE="nouchix-network-scan-$(date +%Y%m%d-%H%M%S).json"
ORGANIZATION_ID="00000000-0000-0000-0000-000000000000"

echo "🔍 NouchiX STIGs Network Discovery"
echo "=================================="
echo "Scanning ranges: ${SCAN_RANGES}"
echo ""

# Create results array
echo "[" > ${OUTPUT_FILE}

for RANGE in ${SCAN_RANGES}; do
  echo "📡 Scanning ${RANGE}..."
  
  # Run nmap scan with service/version detection
  nmap -sV -sC -O --script vulners -oX - ${RANGE} | \
    python3 -c "
import sys, json, xmltodict
data = xmltodict.parse(sys.stdin.read())
print(json.dumps(data, indent=2))
" >> ${OUTPUT_FILE}
done

echo "]" >> ${OUTPUT_FILE}

echo ""
echo "✅ Scan complete!"
echo "📄 Results saved to: ${OUTPUT_FILE}"
echo "📤 Upload this file to NouchiX dashboard"
