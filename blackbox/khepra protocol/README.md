# KHEPRA (MVP) — EtherVerseCodeMate/giza-cyber-shield

Author: **Souhimbou Doh Kone** — skone@alumni.albany.edu  
Repo: **git@github.com:EtherVerseCodeMate/giza-cyber-shield.git**  
Shells x AI Host: **UrGenCyX** (Ubuntu 24.04, Chicago ch01)

### Build

```bash
make build
```

### Generate SSH key (OpenSSH-compatible)
```bash
./bin/khepra keygen -comment "skone@alumni.albany.edu eban:prod"
# paste ~/.ssh/id_ed25519.pub into Shells Keychain UI
```

### Run agent (internal :45444 → external :15171)
```bash
make run-agent
# or systemd service (recommended)
```

### API
```bash
curl -s http://168.100.240.19:15171/healthz | jq
curl -s -X POST http://168.100.240.19:15171/attest/new | jq
curl -s -X POST http://168.100.240.19:15171/dag/add -d '{"action":"Initialize perimeter","symbol":"Eban"}' | jq
curl -s http://168.100.240.19:15171/dag/state | jq
```
