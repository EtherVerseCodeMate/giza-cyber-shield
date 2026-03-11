# Iron Bank Pipeline Issue – Email to Jeffrey Goluba

**To:** jeffrey.goluba@[platform1/dso domain]
**Subject:** RE: Pipeline Failure – `dsop/nouchix/adinkhepra` (Project #18821) – Requesting `TRUFFLEHOG_CONFIG` Variable Enable

---

Jeff,

Following up on the persistent `setup` stage failures for our Iron Bank submission at `dsop/nouchix/adinkhepra`. I want to be direct about what we're seeing and what we need from your team.

**What We Observed**

Your own pipeline run on January 20, 2025 (Job #54764615, Pipeline #4936932, `development` branch) also failed at the `setup` stage — yet all downstream jobs (build, anchore-scan, openscap, twistlock, vat, check-cves) passed. This tells us the `setup` failure in that context was non-blocking.

Our `main` branch is different — the `setup` failure terminates the entire pipeline with exit code 1. The failure log is explicit about the root cause:

```
| Project.DsopProject | ERROR | trufflehog-config file found but TRUFFLEHOG_CONFIG CI variable does not exist
ERROR: Job failed: command terminated with exit code 1
```

**The Specific Blocker**

TruffleHog is flagging **Go vendor SHA commit references** as GitHub token false positives:

| File | Line | Flagged Value |
|------|------|--------------|
| `vendor/golang.org/x/sys/windows/svc/security.go` | 71 | `f4066026ca...` |
| `vendor/google.golang.org/grpc/internal/channelz/trace.go` | 145 | `9b13d199cc...` |
| `vendor/google.golang.org/grpc/internal/serviceconfig/serviceconfig.go` | 41 | `54713b1e8b...` |

These are **read-only commit SHA strings embedded in upstream Go standard library vendored dependencies** (`golang.org/x/sys` and `google.golang.org/grpc`). They are not credentials. They cannot be rotated. They are not in our code.

We followed the Iron Bank documentation — we created a `trufflehog-config.yaml` in the repo root to exclude `vendor/`. However, the pipeline itself states that this config **cannot be honored** until an Iron Bank admin enables the `TRUFFLEHOG_CONFIG` CI/CD variable at the project level.

**What We Are Asking**

1. **Enable the `TRUFFLEHOG_CONFIG` CI variable** for project `dsop/nouchix/adinkhepra` (Project ID: 18821) so our suppression config can take effect.
2. Confirm the correct exclusion format for Go vendor directories, or advise if a different approach (e.g., `.trufflehog-exclude.txt`) is preferred for your pipeline configuration.

**Why This Matters**

This project is a Post-Quantum Cryptography (PQC) security platform designed for DoD compliance automation — automated cross-framework mapping across STIG, CMMC, NIST 800-171, RMF, and FedRAMP. It is the **only Iron Bank container submission** we are aware of that performs automated multi-framework compliance translation. The pipeline has been blocked at `setup` since initial submission with no path forward without this variable being enabled.

We have our `trufflehog-config.yaml` ready. One admin action unblocks us.

Appreciate your time and support.

V/R,
SGT Souhimbou Kone
NouchiX SecRed Knowledge Inc.
Email: skone@alumni.albany.edu | souhimbou.d.kone.mil@army.mil
Iron Bank Project: `dsop/nouchix/adinkhepra` | Project ID: 18821
Patent: USPTO #73565085 (Pending)

---

## Pipeline Evidence Reference

| Pipeline | Branch | Date | Runner | Result |
|----------|--------|------|--------|--------|
| #5008200 | main | 2026-03-08 | spzLxQkVR | FAILED (setup) |
| #4936932 | development | 2026-01-20 | — | FAILED (setup) – run by Jeffrey Goluba |

**Job #54764615** (Goluba's setup run): failed at setup but downstream jobs passed.
**Our setup run**: fails hard with exit code 1, no downstream jobs execute.

**Commit at failure:** `b63f7ad3` – feat: implement sonar command for full security audit pipeline

---

*Document created: 2026-03-11*
*Status: Pending admin action from Iron Bank team*
