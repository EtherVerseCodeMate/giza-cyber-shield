# 📁 IRON BANK DIRECTORY STRUCTURE

Based on your uploaded files, here's the correct organization:

## 📂 Directory Structure

```
adinkhepra-asaf-ironbank/
│
├── pkg/
│   ├── agi/
│   │   ├── engine.go
│   │   └── engine_test.go
│   │
│   ├── maat/
│   │   ├── anubis.go
│   │   ├── guardian.go
│   │   ├── heka.go
│   │   └── isfet.go
│   │
│   ├── ouroboros/
│   │   ├── cycle.go
│   │   ├── khopesh.go
│   │   └── wedjat.go
│   │
│   ├── sekhem/
│   │   ├── aaru.go
│   │   ├── aten.go
│   │   ├── duat.go
│   │   ├── realms.go
│   │   └── triad.go
│   │
│   └── seshat/
│       └── chronicle.go
│
├── cmd/
│   └── agent/
│       ├── licensing_api.go
│       ├── main.go
│       └── server_test.go
│
├── demo-all-modes.ps1
├── go.mod
├── go.sum
└── hardening_manifest.yaml
```

## 📋 File Checklist (23 files)

### Core Framework (14 files)

**pkg/agi/** (2 files):
- [ ] engine.go
- [ ] engine_test.go

**pkg/maat/** (4 files):
- [ ] anubis.go
- [ ] guardian.go
- [ ] heka.go
- [ ] isfet.go

**pkg/ouroboros/** (3 files):
- [ ] cycle.go
- [ ] khopesh.go
- [ ] wedjat.go

**pkg/sekhem/** (5 files):
- [ ] aaru.go ← NEW (Aaru Realm)
- [ ] aten.go ← NEW (Aten Realm)
- [ ] duat.go ← UPDATE
- [ ] realms.go ← UPDATE
- [ ] triad.go ← UPDATE

**pkg/seshat/** (1 file):
- [ ] chronicle.go

### Integration (3 files)

**cmd/agent/**:
- [ ] licensing_api.go ← UPDATE
- [ ] main.go ← UPDATE (mode selection)
- [ ] server_test.go

### Root Files (4 files)

- [ ] demo-all-modes.ps1 ← NEW
- [ ] go.mod ← UPDATE
- [ ] go.sum ← UPDATE
- [ ] hardening_manifest.yaml ← UPDATE (v1.2.0)

## 🎯 Upload Instructions

### For GitHub Web UI

1. **Navigate to Iron Bank repo**: https://github.com/nouchix/adinkhepra-asaf-ironbank

2. **Create directories** (if they don't exist):
   - `pkg/agi/`
   - `pkg/maat/`
   - `pkg/ouroboros/`
   - `pkg/sekhem/`
   - `pkg/seshat/`
   - `cmd/agent/`

3. **Upload files to each directory**:
   - Click on directory
   - Click "Add file" → "Upload files"
   - Drag and drop files
   - Commit changes

### For Git Command Line

```bash
# In Iron Bank repository
git checkout -b sekhem-triad-organized

# Copy files maintaining structure
# (Adjust paths as needed)

# pkg/agi/
cp path/to/engine.go pkg/agi/
cp path/to/engine_test.go pkg/agi/

# pkg/maat/
cp path/to/anubis.go pkg/maat/
cp path/to/guardian.go pkg/maat/
cp path/to/heka.go pkg/maat/
cp path/to/isfet.go pkg/maat/

# pkg/ouroboros/
cp path/to/cycle.go pkg/ouroboros/
cp path/to/khopesh.go pkg/ouroboros/
cp path/to/wedjat.go pkg/ouroboros/

# pkg/sekhem/
cp path/to/aaru.go pkg/sekhem/
cp path/to/aten.go pkg/sekhem/
cp path/to/duat.go pkg/sekhem/
cp path/to/realms.go pkg/sekhem/
cp path/to/triad.go pkg/sekhem/

# pkg/seshat/
cp path/to/chronicle.go pkg/seshat/

# cmd/agent/
cp path/to/licensing_api.go cmd/agent/
cp path/to/main.go cmd/agent/
cp path/to/server_test.go cmd/agent/

# Root files
cp path/to/demo-all-modes.ps1 .
cp path/to/go.mod .
cp path/to/go.sum .
cp path/to/hardening_manifest.yaml .

# Commit
git add -A
git commit -m "feat: Integrate Sekhem Triad (TRL10) - Complete Framework"
git push origin sekhem-triad-organized
```

## ✅ What Each Directory Contains

### `pkg/agi/` - AGI Engine
- Autonomous operations (KASA)
- Self-learning capabilities

### `pkg/maat/` - Maat Guardian
- Autonomous decision-making
- Threat analysis (Isfet)
- Remediation actions (Heka)
- Tradeoff analysis (Anubis)

### `pkg/ouroboros/` - Ouroboros Cycle
- Eternal feedback loop
- Wedjat Eyes (sensors)
- Khopesh Blades (actuators)

### `pkg/sekhem/` - Sekhem Triad
- **NEW**: Aaru Realm (Hybrid Mode)
- **NEW**: Aten Realm (Sovereign/Iron Bank Mode)
- **UPDATED**: Duat Realm (Edge Mode)
- **UPDATED**: Triad orchestration with mode selection

### `pkg/seshat/` - Seshat Chronicle
- Immutable DAG attestation
- PQC signatures

### `cmd/agent/` - Agent Integration
- **UPDATED**: main.go with mode selection
- **UPDATED**: licensing_api.go with comments
- server_test.go

## 🚀 After Upload

1. Create Pull Request
2. Title: `feat: Integrate Sekhem Triad (TRL10) - Four Deployment Modes`
3. Description: Use your PULL_REQUEST.md content
4. Review and merge

---

**Total: 23 files organized and ready for Iron Bank! 🎉**
