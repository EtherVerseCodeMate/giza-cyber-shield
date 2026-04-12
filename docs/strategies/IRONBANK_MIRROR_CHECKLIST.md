# IronBank fork mirror checklist

**Purpose:** Keep the **adinkhepra-asaf-ironbank** (or your named IronBank deployment repo) aligned with this monorepo so GTM can reference a consistent **evidence-first** story and the same API behavior.

> This workspace may **not** contain the IronBank clone. If the fork lives only on GitLab/GitHub, **merge or cherry-pick** from this repo’s `main` after you pull latest.

## 1. Backend (Go) — copy or merge

| Path | Why |
|------|-----|
| `pkg/apiserver/handlers.go` | Trigger scan, license gate + `ASAF_ALLOW_EVAL_WITHOUT_LICENSE` |
| `pkg/apiserver/scan_onboarding.go` | Onboarding TCP + optional NemoClaw audit |
| `pkg/apiserver/models.go` | `ScanStatus` / scan payloads |
| `pkg/apiserver/command_center.go` | `ScanResult` fields |
| `cmd/apiserver/main.go` | Env docs for new flags |

After merge: `go build ./pkg/apiserver/... ./cmd/apiserver/...`

## 2. Frontend — copy or merge

| Path | Why |
|------|-----|
| `src/components/onboarding/OnboardingOrchestrator.tsx` | Eval scan + polling + CMMC copy |
| `src/components/funnel/HeroSection.tsx` | Evidence-first hero |
| `src/components/funnel/FinalCTABar.tsx` | CMMC evidence CTA |
| `souhimbou_ai/SouHimBou.AI/...` (same components) | Vite tree parity |
| `README.md`, `index.html`, `souhimbou_ai/SouHimBou.AI/index.html` | GTM + SEO |
| `.env.example` | `ASAF_ALLOW_EVAL_WITHOUT_LICENSE`, scan profile vars |

## 3. Ops (IronBank deployment)

- Set **`ASAF_ALLOW_EVAL_WITHOUT_LICENSE=true`** on the IronBank ASAF API **only if** you intentionally allow **eval/basic** scans without a telemetry license (public funnel). Otherwise rely on a **valid license** from your telemetry stack.
- Document which **branch** IronBank CI deploys from; keep it tracking **`main`** for GTM parity.

## 4. What IronBank *users* still own

IronBank certification does not remove the need for: correct **container configuration**, **STIG** baselines for the stack, **network** boundaries, and **organizational** CMMC practices. ASAF helps produce **traceable evidence**; program-specific gaps are **customer + assessor** scope.
