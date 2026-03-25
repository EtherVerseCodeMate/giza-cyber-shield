# 🚀 KHEPRA SEKHEM - INSTALLATION GUIDE

## Quick Install (3 Steps)

### Step 1: Open PowerShell as Administrator

Right-click PowerShell → "Run as Administrator"

### Step 2: Navigate to Khepra directory

```powershell
cd "c:\Users\intel\blackbox\khepra protocol"
```

### Step 3: Run the installer

```powershell
.\install-sekhem.ps1
```

**That's it!** The installer will:
- ✅ Copy binary to `C:\Program Files\Khepra`
- ✅ Create Windows service `KhepraSekhem`
- ✅ Set up data directories
- ✅ Configure auto-restart on failure

---

## Starting the Service

```powershell
Start-Service -Name KhepraSekhem
```

---

## Testing the Installation

```powershell
.\test-sekhem.ps1
```

This will run 5 automated tests:
1. ✅ Service status
2. ✅ Health endpoint
3. ✅ KASA engine
4. ✅ DAG store
5. ✅ AI chat

---

## Manual Testing

### Test 1: Health Check
```powershell
curl http://localhost:45444/healthz
```

### Test 2: KASA Status
```powershell
curl http://localhost:45444/agi/state
```

### Test 3: DAG State
```powershell
curl http://localhost:45444/dag/state
```

### Test 4: Chat with AI
```powershell
$body = @{ message = "What threats do you see?" } | ConvertTo-Json
Invoke-RestMethod -Uri http://localhost:45444/agi/chat -Method Post -Body $body -ContentType "application/json"
```

---

## Viewing Logs

### Real-time service status
```powershell
Get-Service -Name KhepraSekhem
```

### View recent logs
```powershell
Get-EventLog -LogName Application -Source KhepraSekhem -Newest 20
```

---

## Uninstalling

```powershell
.\uninstall-sekhem.ps1
```

---

## What's Running?

Once installed, you'll have:

**Sekhem Triad (TRL10)**:
- 🐍 **Ouroboros Cycle** - Eternal feedback loop (10-second iterations)
- 👁️ **Wedjat Eyes** - 4 sensors (STIG, Vuln, Drift, FIM)
- ⚔️ **Khopesh Blades** - 5 actuators (Remediation, Firewall, etc.)
- ⚖️ **Maat Guardian** - AI-powered decision making
- 📜 **Seshat Chronicle** - Immutable DAG audit trail

**Integration**:
- 🤖 **KASA Engine** - Autonomous security operations
- 🔐 **PQC Crypto** - Dilithium signatures
- 📊 **DAG Store** - Forensic-grade attestation

---

## Troubleshooting

### Service won't start?
```powershell
# Check service status
Get-Service -Name KhepraSekhem

# Check Windows Event Log
Get-EventLog -LogName Application -Newest 10
```

### Port 45444 already in use?
```powershell
# Find what's using the port
netstat -ano | findstr :45444

# Kill the process (replace PID)
Stop-Process -Id <PID> -Force
```

### Need to rebuild?
```powershell
go build -o bin/khepra-agent-sekhem.exe ./cmd/agent
.\install-sekhem.ps1
```

---

**Ready to defend!** 🛡️
