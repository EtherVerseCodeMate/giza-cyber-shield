# GitHub SSH Key Setup

**Issue**: `Permission denied (publickey)` when pushing to GitHub

**Goal**: Configure SSH authentication for `nouchix` organization repository

---

## Option 1: Use HTTPS Instead (Quickest)

If you don't have SSH keys set up, use HTTPS authentication:

```bash
cd "C:\Users\intel\blackbox\adinkhepra-ironbank"

# Remove SSH remote
git remote remove origin

# Add HTTPS remote
git remote add origin https://github.com/nouchix/adinkhepra-asaf-ironbank.git

# Push (will prompt for GitHub username/password or token)
git push -u origin master
```

**Note**: You may need a GitHub Personal Access Token (PAT) instead of password:
- Go to: https://github.com/settings/tokens
- Generate new token (classic)
- Scopes: `repo` (full control of private repositories)
- Use token as password when prompted

---

## Option 2: Set Up SSH Key (Recommended for Long-Term)

### Step 1: Check for Existing SSH Keys

```bash
ls -la ~/.ssh
```

Look for files like `id_ed25519`, `id_ed25519.pub`, `id_rsa`, `id_rsa.pub`

### Step 2: Generate New SSH Key (if needed)

```bash
# Generate Ed25519 key (recommended)
ssh-keygen -t ed25519 -C "souhimbou.d.kone.mil@army.mil"

# Or RSA key (if Ed25519 not supported)
ssh-keygen -t rsa -b 4096 -C "souhimbou.d.kone.mil@army.mil"
```

**When prompted**:
- File location: Press Enter (default ~/.ssh/id_ed25519)
- Passphrase: Optional (press Enter for no passphrase)

### Step 3: Add SSH Key to SSH Agent

```bash
# Start SSH agent
eval "$(ssh-agent -s)"

# Add key
ssh-add ~/.ssh/id_ed25519
# Or: ssh-add ~/.ssh/id_rsa
```

### Step 4: Copy Public Key

```bash
# Display public key
cat ~/.ssh/id_ed25519.pub
# Or: cat ~/.ssh/id_rsa.pub

# Copy the output (starts with "ssh-ed25519" or "ssh-rsa")
```

### Step 5: Add Key to GitHub

1. Go to: https://github.com/settings/keys
2. Click **"New SSH key"**
3. Title: `NouchiX Army Laptop`
4. Key type: `Authentication Key`
5. Paste your public key
6. Click **"Add SSH key"**

### Step 6: Test Connection

```bash
ssh -T git@github.com
```

**Expected output**:
```
Hi nouchix! You've successfully authenticated, but GitHub does not provide shell access.
```

### Step 7: Push to GitHub

```bash
cd "C:\Users\intel\blackbox\adinkhepra-ironbank"
git push -u origin master
```

---

## Option 3: Use GitHub CLI (gh)

If you have GitHub CLI installed:

```bash
# Login with browser
gh auth login

# Select:
# - GitHub.com
# - HTTPS
# - Yes, authenticate with browser
# - Follow browser prompts

# Push
cd "C:\Users\intel\blackbox\adinkhepra-ironbank"
git push -u origin master
```

---

## Troubleshooting

### Error: "Permission denied (publickey)"
- SSH key not added to GitHub account
- SSH agent not running
- Wrong key being used

**Fix**: Follow Option 2 steps above

### Error: "Authentication failed"
- HTTPS: Wrong username/password/token
- SSH: Key not added to GitHub

**Fix**: Generate new Personal Access Token (PAT) or add SSH key

### Error: "Repository not found"
- Repository doesn't exist on GitHub
- Wrong repository name
- No access to organization repository

**Fix**: Verify repository exists at https://github.com/nouchix/adinkhepra-asaf-ironbank

---

## Quick Reference

**HTTPS URL**: `https://github.com/nouchix/adinkhepra-asaf-ironbank.git`
**SSH URL**: `git@github.com:nouchix/adinkhepra-asaf-ironbank.git`

**Change remote URL**:
```bash
# To HTTPS
git remote set-url origin https://github.com/nouchix/adinkhepra-asaf-ironbank.git

# To SSH
git remote set-url origin git@github.com:nouchix/adinkhepra-asaf-ironbank.git
```

---

**Recommended**: Use HTTPS with Personal Access Token for now, set up SSH keys later for convenience.
