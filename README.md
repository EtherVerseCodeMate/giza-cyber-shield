# KHEPRA (MVP) — EtherVerseCodeMate/giza-cyber-shield

Author: **Souhimbou Doh Kone** — skone@alumni.albany.edu  
Repo: **git@github.com:EtherVerseCodeMate/giza-cyber-shield.git**  
Shells x AI Host: **Generic Linux Node** (Ubuntu 24.04 Reference)

### Sanity Check (Validate on Laptop)
To test everything (Unit Tests + CLI PQC + Agent API) in one go:
```bash
python khepra.py validate
```
This runs the full "smoke test" sequence to ensure KHEPRA is ready for deployment.

### Quick Start (Cross-Platform)

**Option A: Python (Any OS / venv)**
```bash
python khepra.py build        # Build binaries
python khepra.py agent        # Run the agent
python khepra.py cli keygen   # Run CLI commands
```

**Option B: PowerShell (Windows)**
```powershell
.\run.ps1 build
.\run.ps1 agent
.\run.ps1 cli keygen
```

**Option C: Manual / WSL**
```bash
# Linux/WSL/Mac
make build
# or manual Go:
go build -mod=vendor -o bin/khepra ./cmd/khepra
go build -mod=vendor -o bin/khepra-agent ./cmd/agent
```

### Generate SSH key (OpenSSH-compatible)
```bash
# Using Python runner:
python khepra.py cli keygen -comment "skone@alumni.albany.edu eban:prod"

# Or manual binary:
./bin/khepra keygen -comment "user@host"
```

### Run agent (internal :45444 → external)
```bash
# Using Python runner:
python khepra.py agent

# Or manual:
./bin/khepra-agent
```

### API
```bash
# Replace 127.0.0.1 with your actual server IP
curl -s http://127.0.0.1:45444/healthz | jq
curl -s -X POST http://127.0.0.1:45444/attest/new | jq
curl -s -X POST http://127.0.0.1:45444/dag/add -d '{"action":"Initialize perimeter","symbol":"Eban"}' | jq
curl -s http://127.0.0.1:45444/dag/state | jq
```

## Documentation

- [Integration Roadmap (SouHimBou.AI)](docs/INTEGRATION_ROADMAP.md)
