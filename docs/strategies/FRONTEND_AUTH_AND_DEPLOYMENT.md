# Frontend: where login points, ASAF API, and “old site” on souhimbou.ai

## Authentication (Supabase)

The Vite app uses **Supabase Auth** with a project URL and anon key configured in code:

- **File:** `src/integrations/supabase/client.ts`
- **Project URL:** `https://xjknkjbrjgljuovaazeu.supabase.co` (anon / public key in same file)

Users **log in through the deployed app** (magic link, OAuth, or email/password — whatever you enabled in the Supabase dashboard for that project). There is no separate “ASAF login page” unless you built one; **Supabase project settings** control allowed redirect URLs (e.g. `https://souhimbou.ai`, `http://localhost:8080`).

To change project without a code edit, move URL/key to **environment variables** and rebuild (recommended for production).

## ASAF API (scans, billing probes)

Onboarding and billing read:

- **`NEXT_PUBLIC_ASAF_API_URL`** or **`VITE_ASAF_API_URL`** — Fly (or local) ASAF base URL, e.g. `https://<your-app>.fly.dev`
- **`NEXT_PUBLIC_ASAF_API_KEY`** / **`VITE_ASAF_API_KEY`** — must match what the API expects

**Defaults in code:** `OnboardingOrchestrator` falls back to `http://localhost:45444` if unset — **production must set env in Vercel/Netlify/host**.

See **`.env.example`**.

## Why souhimbou.ai might look “older”

Common causes:

1. **Vercel (or host) production branch** is not `main` — e.g. still deploying `claude/nemoclaw-integration-2tACH` or an old branch.
2. **Cached build** — purge deploy cache or bump deployment.
3. **Wrong project** — another repo connected to the same domain.
4. **Env vars** differ between Preview vs Production.

**Fix:** In the host dashboard, set **Production Branch** to `main`, merge your feature branch into `main`, trigger a fresh deploy, and confirm **Production** environment variables match `.env.example`.

## License / eval scans (403)

If scans return **403 license_invalid**, either:

- Issue/configure a **valid telemetry license** for the API machine, or  
- On the ASAF server set **`ASAF_ALLOW_EVAL_WITHOUT_LICENSE=true`** (Fly secret) to allow **eval/basic** onboarding scans when license validation fails (see `pkg/apiserver/handlers.go`).

---

*Last updated with GTM evidence-first work.*
