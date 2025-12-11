# KHEPRA Protocol (ASAF) — EtherVerseCodeMate/giza-cyber-shield
[![Patent Pending](https://img.shields.io/badge/PATENT-PENDING-blue?style=for-the-badge)](docs/PATENT_APPLICATION_UPDATED.md)  
**Agentic Security Attestation Framework** | *Adinkra-Based Post-Quantum Cryptography*


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

---

## Web Dashboard (Lovable Project)

**URL**: https://lovable.dev/projects/39c447ce-60a6-4740-8eb4-b07fc082365c

### How can I edit this code?

There are several ways of editing your application.

**Use Lovable**

Simply visit the [Lovable Project](https://lovable.dev/projects/39c447ce-60a6-4740-8eb4-b07fc082365c) and start prompting.

Changes made via Lovable will be committed automatically to this repo.

**Use your preferred IDE**

If you want to work locally using your own IDE, you can clone this repo and push changes. Pushed changes will also be reflected in Lovable.

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

### What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

### How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/39c447ce-60a6-4740-8eb4-b07fc082365c) and click on Share -> Publish.

### Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
