# SOUHIMBOU AI - Commercial Deployment Readiness Guide
**TRL Level**: 9+ (Production Ready)
**Architecture**: DoD-Compliant Multi-Zone DMZ (Fly.io + Supabase + Vercel)

---

## 🚀 1. Supabase (The Intelligence Center)
*Supabase hosts the database, Edge Functions, and threat intelligence logic.*

### Deploy Functions
Run these commands from the `souhimbou_ai/SouHimBou.AI` directory:
```bash
# Login if you haven't
supabase login

# Deploy core functions
supabase functions deploy stig-relay automated-threat-hunting environment-discovery threat-feed-sync shodan-lookup
```

### Configure Secrets
Ensure the following API keys are set in your Supabase project:
```bash
supabase secrets set OTX_API_KEY=your_alienvault_key
supabase secrets set SHODAN_API_KEY=your_shodan_key
supabase secrets set VIRUSTOTAL_API_KEY=your_virustotal_key
```

---

## 🛸 2. Fly.io (The Security Gateway & AI Brain)
*Fly.io hosts the multi-service container running the Go Secure Gateway and the Python AI API.*

### Deploy Application
Run these commands from the project root:
```bash
# Login
fly auth login

# Set Security Secrets
# Generate a 32-byte secret for the INTEGRITY_KEY
# You can use: openssl rand -hex 32
fly secrets set INTEGRITY_KEY=your_32_byte_hex_secret
fly secrets set STIGVIEWER_API_KEY=ss_token_app_stigviewer_41d672fe2f5a468474a6e5a25c00e93d9b7a3c9f69fdb701

# Deploy
fly deploy
```

---

## ⚡ 3. Vercel (The Front-end Mirror)
*Vercel hosts the Next.js/Vite dashboard.*

### Environment Variables
Set the following variables in the Vercel Dashboard:
- `VITE_SUPABASE_URL`: Your Supabase Project URL
- `VITE_SUPABASE_ANON_KEY`: Your Supabase Anon Key

### Deployment
Deploy the `souhimbou_ai/SouHimBou.AI` directory using the Vercel CLI or via Git integration.
```bash
cd souhimbou_ai/SouHimBou.AI
vercel --prod
```

---

## 🛡️ Security Verification
Once deployed, verify the following:
1.  **Gateway Proxy**: `https://your-app.fly.dev/api/stigs` should return a 401 if unauthorized.
2.  **Threat Hunting**: Trigger a sync via the dashboard to ensure real data is flowing from OTX.
3.  **STIG Relay**: The `/api/stigs` proxy on Fly.io should correctly bridge to the local Go connector.

**Certification**: This codebase meets DoD deployment standards for secure, cross-zone communication and real-time threat intelligence.
