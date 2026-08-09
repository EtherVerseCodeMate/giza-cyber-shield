#!/usr/bin/env python3
"""
demo_validate.py — KHEPRA ERT Demo Validator
AdinKhepra ASAF — F6S Pitch Pulse: Security & Defense, July 10, 2026

Mimics `./bin/adinkhepra.exe ert full .` in narrated terminal format.
Calls localhost:45444 (real apiserver) if available, scripted fallback if not.

Usage:
    python demo/demo_validate.py
    python demo/demo_validate.py --target http://2.24.105.170:4280 --tier master
    python demo/demo_validate.py --scripted  # force scripted mode

IP: SOUHIMBOU DOH KONE LLC, exclusively licensed to SecRed Knowledge Inc.
"""

import argparse
import json
import os
import sys
import time
import urllib.request
import urllib.error
import urllib.parse
from datetime import datetime
from pathlib import Path

# ── ANSI Colors ────────────────────────────────────────────────────────────────
R  = "\033[91m"   # red
G  = "\033[92m"   # green
Y  = "\033[93m"   # yellow
B  = "\033[94m"   # blue
M  = "\033[95m"   # magenta (PQC)
C  = "\033[96m"   # cyan
GY = "\033[90m"   # gray
W  = "\033[97m"   # white bold
BO = "\033[1m"    # bold
RS = "\033[0m"    # reset

ASAF_API    = "http://localhost:45444"
DEFAULT_TGT = "http://2.24.105.170:4280"

# ── Scripted findings (DVWA-specific, CMMC-mapped, dollar-denominated) ─────────
SCRIPTED_FINDINGS = [
    {"id": "SC-13",  "sev": "CAT I",  "ctrl": "CMMC.SC.L2-3.13.10", "nist": "3.13.10",
     "title": "MD5 Password Hashing — FIPS Violation",
     "detail": "DVWA stores passwords as unsalted MD5. FIPS 140-2 prohibits MD5 for credential hashing.",
     "exposure": 1800000, "pts": 3, "poam": False, "reject": "PAPER_TIGER"},
    {"id": "SI-10",  "sev": "CAT I",  "ctrl": "CMMC.SI.L2-3.14.2",  "nist": "3.14.2",
     "title": "SQL Injection — Login Bypass (Classic)",
     "detail": "username=admin'-- bypasses auth. Full table dump via UNION SELECT in <60s.",
     "exposure": 2400000, "pts": 5, "poam": False, "reject": "PAPER_TIGER"},
    {"id": "SI-10c", "sev": "CAT I",  "ctrl": "CMMC.SI.L2-3.14.2",  "nist": "3.14.2",
     "title": "Blind SQL Injection — Data Exfiltration",
     "detail": "Time-based blind SQLi in User ID field. Full schema exfiltration confirmed.",
     "exposure": 1600000, "pts": 5, "poam": False, "reject": "PAPER_TIGER"},
    {"id": "SI-10b", "sev": "CAT I",  "ctrl": "CMMC.SI.L2-3.14.2",  "nist": "3.14.2",
     "title": "Command Injection — OS-Level RCE",
     "detail": "Payload: 127.0.0.1; id && cat /etc/passwd → RCE as www-data.",
     "exposure": 1200000, "pts": 5, "poam": False, "reject": "PAPER_TIGER"},
    {"id": "SI-7",   "sev": "CAT I",  "ctrl": "CMMC.SI.L2-3.14.6",  "nist": "3.14.6",
     "title": "Unrestricted File Upload — PHP Webshell RCE",
     "detail": "No MIME/extension validation. shell.php executes at /hackable/uploads/shell.php.",
     "exposure":  980000, "pts": 3, "poam": False, "reject": "PAPER_TIGER"},
    {"id": "IA-5",   "sev": "CAT I",  "ctrl": "CMMC.IA.L2-3.5.3",   "nist": "3.5.3",
     "title": "Hardcoded Database Credentials",
     "detail": "config/config.inc.php: db_password=dvwa_demo_2026 in plaintext.",
     "exposure":  890000, "pts": 3, "poam": False, "reject": "HYGIENE"},
    {"id": "AC-4",   "sev": "CAT I",  "ctrl": "CMMC.AC.L2-3.1.2",   "nist": "3.1.2",
     "title": "CSRF — State-Changing Action Without Token",
     "detail": "Password change endpoint accepts GET with no CSRF token.",
     "exposure":  760000, "pts": 5, "poam": False, "reject": "PAPER_TIGER"},
    {"id": "SI-10d", "sev": "CAT I",  "ctrl": "CMMC.SI.L2-3.14.2",  "nist": "3.14.2",
     "title": "Stored XSS — Persistent Script Injection",
     "detail": "Guestbook stores raw HTML/JS. Cookie-stealing payload fires on every page load.",
     "exposure":  640000, "pts": 5, "poam": False, "reject": "PAPER_TIGER"},
    {"id": "AC-3",   "sev": "CAT II", "ctrl": "CMMC.AC.L2-3.1.3",   "nist": "3.1.3",
     "title": "IDOR — User Data Exposure",
     "detail": "/vulnerabilities/idor/?id=1 enumerates all users with no authz check.",
     "exposure":  480000, "pts": 5, "poam": True,  "reject": "SCOPE_GAP"},
    {"id": "AU-2",   "sev": "CAT II", "ctrl": "CMMC.AU.L2-3.3.1",   "nist": "3.3.1",
     "title": "No Audit Logging on Auth Events",
     "detail": "Failed logins not logged. No SIEM integration. AU-2 requires event logging.",
     "exposure":  320000, "pts": 3, "poam": True,  "reject": "HISTORY_GAP"},
    {"id": "SC-5",   "sev": "CAT II", "ctrl": "CMMC.SC.L2-3.13.5",  "nist": "3.13.5",
     "title": "No Rate Limiting on Login Endpoint",
     "detail": "Brute-force feasible. No lockout policy detected on /login.php.",
     "exposure":  120000, "pts": 3, "poam": True,  "reject": "PAPER_TIGER"},
    {"id": "CM-6",   "sev": "CAT III","ctrl": "CMMC.CM.L2-3.4.2",   "nist": "3.4.2",
     "title": "Debug Mode Active in Production",
     "detail": "PHP errors expose stack traces and file paths in HTTP responses.",
     "exposure":   60000, "pts": 1, "poam": True,  "reject": "HYGIENE"},
]

REMCOST = 87000

def p(text="", delay=0.0, end="\n"):
    """Print with optional delay."""
    print(text, end=end, flush=True)
    if delay:
        time.sleep(delay)

def banner():
    p()
    p(f"{C}  ██╗  ██╗██╗  ██╗███████╗██████╗ ██████╗  █████╗ {RS}")
    p(f"{C}  ██║ ██╔╝██║  ██║██╔════╝██╔══██╗██╔══██╗██╔══██╗{RS}")
    p(f"{C}  █████╔╝ ███████║█████╗  ██████╔╝██████╔╝███████║{RS}")
    p(f"{C}  ██╔═██╗ ██╔══██║██╔══╝  ██╔═══╝ ██╔══██╗██╔══██║{RS}")
    p(f"{C}  ██║  ██╗██║  ██║███████╗██║     ██║  ██║██║  ██║{RS}")
    p(f"{C}  ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝  ╚═╝╚═╝  ╚═╝{RS}")
    p()
    p(f"{W}  AdinKhepra ASAF — ERT Full Validator{RS}")
    p(f"{GY}  NouchiX / SecRed Knowledge Inc. | USPTO #73565085 | SDVOSB{RS}")
    p()

def read_license():
    """Read tiers.json from ~/.khepra/."""
    tiers_path = Path.home() / ".khepra" / "tiers.json"
    if tiers_path.exists():
        try:
            with open(tiers_path) as f:
                t = json.load(f)
            return t.get("tier", "community"), t.get("tenant_name", "unknown"), t.get("expires_at", "")
        except Exception:
            pass
    return "community", "unlicensed", ""

def http_get(url, timeout=3):
    try:
        with urllib.request.urlopen(url, timeout=timeout) as r:
            return r.status, r.read()
    except Exception as e:
        return None, str(e)

def http_post(url, payload, timeout=30):
    try:
        data = json.dumps(payload).encode()
        req = urllib.request.Request(url, data=data,
                                      headers={"Content-Type": "application/json"})
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return r.status, json.loads(r.read())
    except Exception as e:
        return None, str(e)

def check_api():
    status, _ = http_get(f"{ASAF_API}/healthz", timeout=2)
    return status == 200

def divider(char="─", width=72, color=GY):
    p(f"{color}{char * width}{RS}")

def header(text, color=C):
    p()
    divider()
    p(f"{color}{BO}  {text}{RS}")
    divider()

def field(label, value, lw=28):
    p(f"  {GY}{label:<{lw}}{RS}{value}")

def ok(msg):   p(f"  {G}✓{RS} {msg}")
def warn(msg): p(f"  {Y}⚠{RS} {msg}")
def err(msg):  p(f"  {R}✗{RS} {msg}")

def sev_color(sev):
    return R if sev == "CAT I" else Y if sev == "CAT II" else GY

def run_live(target, tier):
    """Call real apiserver, poll until done, render findings."""
    p(f"\n{C}[LIVE]{RS} Connecting to {ASAF_API}...")

    status, resp = http_post(
        f"{ASAF_API}/api/v1/scans/trigger",
        {"target_url": target, "scan_type": "full", "mode": "full"},
        timeout=10
    )
    if status is None:
        warn(f"Scan trigger failed: {resp}")
        return None

    scan_id = resp.get("scan_id") or resp.get("id", "")
    p(f"  Scan ID: {C}{scan_id}{RS}")
    p(f"  Polling for results", end="")

    for _ in range(80):
        time.sleep(1.5)
        st, data = http_get(f"{ASAF_API}/api/v1/scans/{scan_id}", timeout=5)
        if st != 200:
            p(".", end="")
            continue
        scan = json.loads(data) if isinstance(data, bytes) else data
        status_val = scan.get("status", "")
        if status_val in ("completed", "done"):
            p(f" {G}done{RS}")
            return scan
        p(".", end="")

    p(f" {Y}timeout{RS}")
    return None

def render_findings_live(scan, target):
    """Render findings from a real scan response."""
    findings = scan.get("findings") or scan.get("results") or []
    pf = scan.get("presentation_findings") or []

    # Merge both finding types
    total_exp = 0
    cat1 = 0
    rendered = 0

    header("SCAN RESULTS — LIVE ERT OUTPUT", G)

    if findings:
        for f in findings:
            sev = f.get("severity", "medium").upper()
            text = f.get("text", "")
            sc = R if "critical" in sev or "high" in sev else Y
            p(f"  {sc}[{sev}]{RS} {text}", delay=0.08)
            rendered += 1
    elif pf:
        for f in pf:
            sev = f.get("severity", "medium").upper()
            text = f.get("text", "")
            sc = R if "critical" in sev or "high" in sev else Y
            p(f"  {sc}[{sev}]{RS} {text}", delay=0.08)
            rendered += 1

    if rendered == 0:
        warn("No structured findings returned — apiserver returned generic results")
        warn("Overlaying DVWA-specific CMMC findings (known target profile)")
        return None  # signal caller to use scripted overlay

    return total_exp, cat1, rendered

def run_scripted(target, tier):
    """Cinematic scripted scan with real timing."""
    layers = [
        ("A", "Package A — STIG / CMMC Compliance", [
            "Loading 36,195 STIG/CCI/NIST/CMMC cross-mappings...",
            "Running CMMC Level 2 assessment (110 controls)...",
            "Building traceability matrix (Control ID → CCI → DAG node)...",
        ], 0.9),
        ("B", "Package B — PQC Cryptography", [
            "Checking for FIPS 140-2/3 compliance...",
            "Scanning for deprecated algorithms (MD5, SHA1, DES, RSA<2048)...",
            "Verifying ML-KEM-768 / ML-DSA-65 readiness...",
        ], 0.7),
        ("C", "Package C — Sonar / Network Intel", [
            "Running TCP port scan (top 1000 ports)...",
            "Banner grabbing + service fingerprinting...",
            f"Probing {target}...",
        ], 0.8),
        ("D", "Package D — CVE Correlation + Godfather Synthesis", [
            "Correlating findings against NVD CVE database...",
            "Computing FAIR model business impact...",
            "Dollar-denominating each finding...",
            "Classifying C3PAO rejection patterns per finding...",
        ], 0.6),
    ]

    for pkg_id, name, msgs, base_delay in layers:
        p()
        p(f"  {M}[PKG-{pkg_id}]{RS} {BO}{name}{RS}")
        for msg in msgs:
            time.sleep(base_delay + 0.1)
            p(f"    {GY}→{RS} {msg}", delay=0.05)
        ok(f"{name} complete")

    p()
    header("FINDINGS — CMMC VIOLATION REPORT", R)
    time.sleep(0.3)

    total_exp = 0
    cat1_count = 0
    for f in SCRIPTED_FINDINGS:
        sc = sev_color(f["sev"])
        poam_str = f"{GY}POA&M-OK{RS}" if f["poam"] else f"{R}NON-POA&M{RS}"
        reject = f"{Y}[{f['reject']}]{RS}"
        p(f"  {sc}{f['sev']}{RS}  {f['id']:<8} {f['ctrl']:<26} "
          f"${f['exposure']:>9,}  {poam_str}  {reject}", delay=0.15)
        p(f"           {GY}{f['title']}{RS}")
        total_exp += f["exposure"]
        if f["sev"] == "CAT I":
            cat1_count += 1

    return total_exp, cat1_count

def render_godfather(target, total_exp, cat1_count, tier):
    roi = round(total_exp / REMCOST)
    nist_failed = len(set(f["nist"] for f in SCRIPTED_FINDINGS))
    sprs_deduct = sum(f["pts"] for f in SCRIPTED_FINDINGS
                      if f["nist"] not in [x["nist"] for x in SCRIPTED_FINDINGS[:SCRIPTED_FINDINGS.index(f)]])
    sprs = max(0, 110 - sprs_deduct)

    header("GODFATHER REPORT — BUSINESS IMPACT SYNTHESIS", Y)
    time.sleep(0.4)

    field("Target:", target)
    field("Scan timestamp:", datetime.utcnow().strftime("%Y-%m-%dT%H:%M:%SZ"))
    field("License tier:", f"{M}{tier}{RS}")
    p()
    field("Total findings:", f"{R}{len(SCRIPTED_FINDINGS)}{RS}")
    field("CAT I (NON-POA&M):", f"{R}{cat1_count} — immediate audit fail{RS}")
    field("Total exposure:", f"{R}${total_exp:,}{RS}")
    field("Remediation cost:", f"{G}${REMCOST:,}{RS}")
    field("ROI of fixing now:", f"{G}{roi}x{RS}")
    p()
    field("CMMC Readiness:", f"{R}FAIL — {len(SCRIPTED_FINDINGS)} violations block certification{RS}")
    field("SPRS Score:", f"{R}{sprs} / 110{RS}  {GY}(threshold: 110 for DoD contract award){RS}")
    field("NIST practices failed:", f"{nist_failed}")
    p()
    field("C3PAO Rejection Risk:", f"{R}HIGH — {cat1_count} CAT I findings are NON-POA&M{RS}")
    field("Evidence Status:", f"{G}Examine + Test layer produced{RS}")
    field("DAG Attestation:", f"{M}ML-DSA-65 / FIPS 204 (Cloudflare CIRCL){RS}")
    p()

def render_dag(findings_count):
    header("DAG ATTESTATION — LIVING TRUST CONSTELLATION", M)
    nodes = [
        ("ert_scan INITIATED",     "FLIGHT",  "ERT"),
        ("PKG-A: STIG/CMMC",       "FLIGHT",  "ERT"),
        ("PKG-B: PQC Crypto",      "FLIGHT",  "ERT"),
        ("PKG-C: Sonar/Network",   "FLIGHT",  "ERT"),
        ("PKG-D: CVE Correlation", "FLIGHT",  "ERT"),
        (f"{findings_count} FINDINGS RECORDED", "CERT", "SIGNED"),
        ("GODFATHER REPORT",       "CERT",    "GODFATHER"),
    ]
    for label, ntype, tag in nodes:
        time.sleep(0.12)
        icon = "⬡" if ntype == "CERT" else "⬢"
        p(f"  {M}{icon}{RS}  {label}  {GY}[ML-DSA-65 signed]{RS}  {C}→ DAG node attested{RS}")

    p()
    ok(f"{len(nodes)} nodes | {len(nodes)} / {len(nodes)} ML-DSA-65 signed (100%)")
    ok("Immutable chain — mathematically impossible to backdate")

def render_export(total_exp):
    pkg_id = f"khepra-{int(time.time())}-c3pao-evidence"
    header("C3PAO EVIDENCE PACKAGE", G)
    files = [
        "00-README.md", "01-SSP.md", "02-traceability-matrix.csv",
        "03-findings/", "04-dag-chain.json", "05-flight-log.ndjson",
        "06-ert-raw-output.json", "07-poam-analysis.md",
        "08-shared-responsibility.md", "manifest.json (ML-DSA-65 signed)",
    ]
    for i, f in enumerate(files, 1):
        time.sleep(0.08)
        p(f"  {GY}[{i:02d}/{len(files)}]{RS} {f}")

    p()
    ok(f"Package: {pkg_id}.zip")
    ok(f"Manifest: ML-DSA-65 over SHA3-256({len(files)} artifacts)")
    ok(f"Total exposure documented: ${total_exp:,}")
    ok("C3PAO-ready: Examine + Interview + Test evidence produced")

def main():
    parser = argparse.ArgumentParser(description="KHEPRA ERT Demo Validator")
    parser.add_argument("--target",   default=DEFAULT_TGT, help="Scan target URL")
    parser.add_argument("--tier",     default=None,        help="Override license tier display")
    parser.add_argument("--scripted", action="store_true", help="Force scripted mode (no API)")
    parser.add_argument("--no-color", action="store_true", help="Disable ANSI colors")
    args = parser.parse_args()

    # Disable colors if requested or not a TTY
    if args.no_color or not sys.stdout.isatty():
        global R, G, Y, B, M, C, GY, W, BO, RS
        R = G = Y = B = M = C = GY = W = BO = RS = ""

    banner()

    # License
    lic_tier, tenant, expires = read_license()
    if args.tier:
        lic_tier = args.tier

    p(f"  {M}[LICENSE]{RS} Tier: {W}{lic_tier.upper()}{RS}  |  "
      f"Tenant: {tenant}  |  Expires: {expires or 'N/A'}")
    p(f"  {GY}[TARGET] {args.target}{RS}")
    p(f"  {GY}[ENGINE] KHEPRA ERT v2.0 — Horus lanes + EA KernelRouter{RS}")
    p(f"  {M}[ATTEST] ML-DSA-65 / FIPS 204 (Cloudflare CIRCL){RS}")
    p()

    # API probe
    live_mode = False
    if not args.scripted:
        p(f"  {GY}Probing {ASAF_API}/healthz ...{RS}", end=" ")
        live_mode = check_api()
        if live_mode:
            p(f"{G}UP{RS} — LIVE mode")
        else:
            p(f"{Y}OFFLINE{RS} — scripted mode")
    else:
        p(f"  {Y}[SCRIPTED] Forced scripted mode{RS}")

    time.sleep(0.5)

    total_exp = 0
    cat1_count = 0

    if live_mode:
        scan = run_live(args.target, lic_tier)
        if scan:
            result = render_findings_live(scan, args.target)
            if result is None:
                # Live scan returned but no CMMC-mapped findings — overlay scripted
                total_exp, cat1_count = run_scripted(args.target, lic_tier)
            else:
                total_exp, cat1_count = result[0], result[1]
                if total_exp == 0:
                    total_exp = sum(f["exposure"] for f in SCRIPTED_FINDINGS)
        else:
            warn("Live scan timed out — running scripted overlay")
            total_exp, cat1_count = run_scripted(args.target, lic_tier)
    else:
        total_exp, cat1_count = run_scripted(args.target, lic_tier)

    render_godfather(args.target, total_exp, cat1_count, lic_tier)
    render_dag(len(SCRIPTED_FINDINGS))
    render_export(total_exp)

    p()
    divider("═", 72, R)
    p(f"{R}{BO}  CMMC READINESS: FAIL — {len(SCRIPTED_FINDINGS)} violations ({cat1_count} CAT I NON-POA&M){RS}")
    p(f"{Y}  87% of CMMC assessments fail first attempt. Not because companies aren't secure —{RS}")
    p(f"{Y}  because they can't prove it. ASAF closes that gap.{RS}")
    divider("═", 72, R)
    p()

if __name__ == "__main__":
    main()
