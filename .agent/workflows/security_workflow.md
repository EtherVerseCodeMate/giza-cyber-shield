---
description: Run security scans and verify PQC obfuscation
---
1. Run standard unit tests
   `go test -mod=vendor ./pkg/... ./cmd/...`

2. Install Security Tools (if missing)
   // turbo
   `go install golang.org/x/vuln/cmd/govulncheck@latest`
   // turbo
   `go install github.com/securego/gosec/v2/cmd/gosec@latest`

3. Run Vulnerability Check
   `govulncheck ./...`

4. Run Static Analysis (gosec)
   `gosec -exclude-dir=vendor ./...`

5. Verify Obfuscation (Adinkra & Nkyinkyim)
   `go test -v ./pkg/nkyinkyim`
