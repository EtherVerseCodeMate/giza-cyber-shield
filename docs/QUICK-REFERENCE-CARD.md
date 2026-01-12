# ADINKHEPRA QUICK REFERENCE CARD

## COMMON COMMANDS

### Health & Validation
```bash
adinkhepra health              # Quick healthcheck (returns OK)
adinkhepra validate            # Full component smoke test
adinkhepra hostid              # Display system Host ID
```

### STIG Compliance
```bash
# Full system scan
adinkhepra stig scan -root / -out stig_report.json -v

# Quick scan (via Makefile)
make -f Makefile.stig test-stig

# Generate reports
adinkhepra stig report csv     # Export to CSV
adinkhepra stig report pdf     # Executive Intelligence Brief
```

### Key Generation
```bash
adinkhepra keygen \
  -out ~/.ssh/id_dilithium \
  -tenant "Organization" \
  -comment "User Name" \
  -rotate 365
```

### File Encryption/Decryption
```bash
# Single file encryption
adinkhepra kuntinkantan recipient_kyber.pub file.txt

# Single file decryption
adinkhepra sankofa ~/.ssh/id_dilithium_kyber file.txt.adinkhepra

# Bulk directory encryption (DESTRUCTIVE)
adinkhepra ogya recipient_kyber.pub /path/to/dir

# Bulk directory decryption
adinkhepra nsuo ~/.ssh/id_dilithium_kyber /path/to/dir
```

### Disaster Recovery
```bash
# Create Genesis backup
adinkhepra drbc init

# Restore from backup
adinkhepra drbc restore -out /opt/restored

# Scorpion container (password-protected)
adinkhepra drbc scorpion -target file.key -out file.scorp
adinkhepra drbc open -target file.scorp -out file.key
```

### Container Operations
```bash
# Pull Iron Bank image
podman pull registry1.dso.mil/dsop/adinkhepra:latest

# Run container
podman run -d \
  --name adinkhepra \
  -p 8443:8443 \
  -v /var/lib/adinkhepra:/data \
  registry1.dso.mil/dsop/adinkhepra:latest

# Check status
podman ps | grep adinkhepra
podman logs adinkhepra
```

## FILE LOCATIONS

| Item | Path |
|------|------|
| License | `license.adinkhepra` |
| Master Key | `adinkhepra_master.pub` |
| STIG Reports | `/var/log/adinkhepra/stig_*.json` |
| Audit Logs | `/var/log/adinkhepra/audit.log` |
| User Keys | `~/.ssh/id_dilithium*` |
| Backups | `/backup/adinkhepra/genesis_*.kpkg` |

## KEY SIZES

| Algorithm | Type | Size |
|-----------|------|------|
| Dilithium3 (ML-DSA-65) | Public | 1,952 bytes |
| Dilithium3 (ML-DSA-65) | Private | 4,000 bytes |
| Kyber1024 (ML-KEM-1024) | Public | 1,568 bytes |
| Kyber1024 (ML-KEM-1024) | Private | 3,168 bytes |

## COMPLIANCE TARGETS

| Metric | Target |
|--------|--------|
| Overall Compliance | ≥ 85% |
| CAT I Findings | 0 |
| CAT II Findings | ≤ 5 |
| CAT III Findings | ≤ 10 |

## MAINTENANCE SCHEDULE

| Task | Frequency |
|------|-----------|
| Health check | Hourly |
| Component validation | Daily |
| STIG scan | Weekly |
| Audit log review | Weekly |
| Key rotation | 365 days |
| License renewal | 30 days before expiry |

## SUPPORT

| Tier | Contact | Response Time |
|------|---------|---------------|
| Tier 1 | Unit S6/ISSM | 4 hours |
| Tier 2 | support@souhimbou.ai | 24 hours |
| Tier 3 | +1-XXX-XXX-XXXX | 2 hours |

## SECURITY NOTES

⚠️ **Private keys**: File permissions MUST be 600
⚠️ **Ogya (bulk encrypt)**: DESTRUCTIVE - originals are deleted
⚠️ **Scorpion container**: Self-destructs after 3 wrong passwords
⚠️ **Development mode**: NEVER use in production (`ADINKHEPRA_DEV=1`)

## ADINKRA SYMBOLS

| Symbol | Meaning | Operation |
|--------|---------|-----------|
| Eban | The Fence | Identity (Dilithium) |
| Kuntinkantan | The Riddle | Encrypt |
| Sankofa | Return & Retrieve | Decrypt |
| Ogya | Fire | Bulk Encrypt |
| Nsuo | Water | Bulk Decrypt |
| Mpatapo | Knot of Reconciliation | Scorpion Bind |
| Sane | Untying | Scorpion Open |

---

**For full documentation, see TC 25-ADINKHEPRA-001**
