# Khepra Protocol - Demo Day Quick Reference Card
## 🎯 15-Minute Demo - Command Cheat Sheet

---

## PRE-DEMO (5 min before)

```bash
# 1. Navigate to directory
cd "c:\Users\intel\blackbox\khepra protocol"

# 2. Kill old processes
pkill adinkhepra || taskkill /F /IM adinkhepra.exe

# 3. Start web server (FLAGS BEFORE FILE!)
./bin/adinkhepra.exe engine visualize --web --port 8080 demo-snapshot.json &

# 4. Verify server
curl http://localhost:8080 | head -5
netstat -an | findstr :8080

# 5. Open browser tabs
# - http://localhost:8080
# - file:///c:/Users/intel/blackbox/khepra%20protocol/executive-summary.html
```

---

## DEMO COMMANDS (In Order)

### MINUTE 2-5: File Integrity Monitoring
```bash
# Show snapshot size
ls -lh demo-snapshot.json
# Output: 3.1M

# Initialize FIM baseline
./bin/adinkhepra.exe fim init --out baseline.json
# Shows: Baseline established, X files monitored

# Show FIM help
./bin/adinkhepra.exe fim
```

### MINUTE 5-9: Network Topology (SWITCH TO BROWSER)
```
# Navigate to: http://localhost:8080
# Hover over nodes, click attack path
# Show: Internet → SSH (Port 22) → CVE-2021-41617 → Root → Database
```

### MINUTE 9-11: SBOM Generation (BACK TO TERMINAL)
```bash
# Generate SBOM (if not pre-generated)
./bin/adinkhepra.exe sbom generate --target myapp:latest --scanner syft --output sbom.json

# Correlate with CVE database
./bin/adinkhepra.exe sbom correlate --input sbom.json --cve-db data/cve-database --output vulnerable.json

# Show SBOM help
./bin/adinkhepra.exe sbom
```

### MINUTE 11-13: Executive Report (SWITCH TO BROWSER)
```
# Navigate to: executive-summary.html
# Scroll to:
#   - CMMC Scorecard (71%)
#   - Risk Exposure ($8.9M)
#   - Remediation Roadmap ($5.5M investment)
```

### MINUTE 14-15: Close (BACK TO TERMINAL)
```bash
# Show all available commands
./bin/adinkhepra.exe --help
```

---

## KEY TALKING POINTS

| Time | Hook | Metric |
|------|------|--------|
| 0:00 | "One SSH key → $8.9M risk" | $8.9M |
| 2:00 | "3.1MB cryptographically signed" | Dilithium3 |
| 5:00 | "47 host blast radius from 1 CVE" | 47 hosts |
| 9:00 | "127 vulnerable components" | 127 |
| 11:00 | "71% CMMC compliance = FAILING" | 71% |
| 13:00 | "$7.1M risk mitigated for $5.5M" | 545x ROI |

---

## OBJECTION QUICK RESPONSES

| Objection | 10-Second Answer |
|-----------|------------------|
| "Too expensive" | "One DoD contract = $5-50M. This is 10% of ONE contract." |
| "Not a priority" | "CMMC mandatory 2025. 6 months with us vs. 18 months without = 12-month competitive gap." |
| "Have tool X" | "Perfect. We integrate. Adding PQC verification + CMMC mapping." |
| "Quantum not a threat" | "NIST mandate. NSA already deprecated RSA. This is regulatory." |

---

## EMERGENCY BACKUP (If Tech Fails)

```bash
# Web server down? Use offline files
# Open in browser: file:///c:/Users/intel/blackbox/khepra%20protocol/dag-visualization.html

# CLI broken? Rebuild
go build -o bin/adinkhepra.exe ./cmd/adinkhepra

# Snapshot missing? Use backup
cp demo-snapshot.backup.json demo-snapshot.json
```

---

## CLOSING SCRIPT (MEMORIZE)

> "CMMC Level 2 mandatory in 2025. Start today: 6 months to certification. Start then: 18 months. **12-month competitive advantage.**
>
> Three options:
> 1. **Pilot**: 30 days, $50K, 100-500 assets
> 2. **Briefing**: This week, FREE, YOUR staging env
> 3. **Assessment**: 60 days, $150K, full C3PAO cert
>
> **Who wants to start the pilot next week?**"

---

## METRICS CARD (Keep Visible)

```
┌─────────────────────────────────────┐
│  KHEPRA DEMO METRICS (Memorize)    │
├─────────────────────────────────────┤
│  Risk Exposure:        $8.9M        │
│  CMMC Compliance:      71% (FAIL)   │
│  Investment:           $5.5M        │
│  Risk Mitigated:       $7.1M        │
│  ROI:                  545x (Year 1)│
│  Time to Cert:         6 months     │
│  Blast Radius:         47 hosts     │
│  Vulnerable Components: 127         │
│  Active Exploits:      5 (CISA KEV) │
│  Contract Access:      $3B+ (DoD)   │
└─────────────────────────────────────┘
```

---

## SELF-CHECK (Before Starting)

- [ ] Water nearby
- [ ] Terminal font size 18pt
- [ ] Web server running (curl localhost:8080)
- [ ] Browser tabs open (localhost:8080, executive-summary.html)
- [ ] Phone on silent
- [ ] Notifications disabled
- [ ] Deep breath x3

**YOU ARE THE EXPERT. THEY NEED YOU. 🚀**
