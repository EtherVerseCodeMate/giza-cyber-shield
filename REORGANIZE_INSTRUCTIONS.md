# 📁 REORGANIZE IRON BANK FILES

You've uploaded the files to Iron Bank. Now they need to be organized into the correct directory structure.

## 🎯 Quick Instructions

### Step 1: Clone Iron Bank Repository

```bash
# Clone the repo (if you haven't already)
git clone https://github.com/nouchix/adinkhepra-asaf-ironbank.git
cd adinkhepra-asaf-ironbank
```

### Step 2: Run Reorganization Script

```powershell
# From the Iron Bank repo directory, run:
..\khepra-protocol\reorganize-ironbank.ps1
```

**Or if you're in the khepra protocol directory:**

```powershell
# First, navigate to Iron Bank repo
cd ..\adinkhepra-asaf-ironbank

# Then run the script
..\khepra-protocol\reorganize-ironbank.ps1
```

### Step 3: Review and Push

The script will:
1. ✅ Create directory structure
2. ✅ Move all 23 files to correct locations
3. ✅ Commit the changes
4. ❓ Ask if you want to push

---

## 📂 What Gets Organized

**Files will be moved from root to:**

```
pkg/agi/
  ├── engine.go
  └── engine_test.go

pkg/maat/
  ├── anubis.go
  ├── guardian.go
  ├── heka.go
  └── isfet.go

pkg/ouroboros/
  ├── cycle.go
  ├── khopesh.go
  └── wedjat.go

pkg/sekhem/
  ├── aaru.go
  ├── aten.go
  ├── duat.go
  ├── realms.go
  └── triad.go

pkg/seshat/
  └── chronicle.go

cmd/agent/
  ├── licensing_api.go
  ├── main.go
  └── server_test.go

Root (stays in root):
  ├── demo-all-modes.ps1
  ├── go.mod
  ├── go.sum
  └── hardening_manifest.yaml
```

---

## 🚀 Ready to Run!

**Navigate to Iron Bank repo and run the script:**

```bash
cd path/to/adinkhepra-asaf-ironbank
../khepra-protocol/reorganize-ironbank.ps1
```

**The script will handle everything automatically!** ✨
