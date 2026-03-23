"""
CLI entrypoint: python -m govcloud_validation

Usage:
    python -m govcloud_validation --help
    python -m govcloud_validation --list-stages
    python -m govcloud_validation --provider aws-govcloud --region us-gov-west-1
    python -m govcloud_validation --only step_02_root_guardrails
    python -m govcloud_validation --json
    python -m govcloud_validation --framework cmmc-l2
"""

from __future__ import annotations

import argparse
import json
import sys

from govcloud_validation import __version__
from govcloud_validation.base import CheckStatus
from govcloud_validation.registry import get_all_stages, STAGE_REGISTRY

# Force-import validators so they register themselves
import govcloud_validation.validators  # noqa: F401


# ---------------------------------------------------------------------------
# ANSI helpers
# ---------------------------------------------------------------------------

_COLORS = {
    CheckStatus.PASS: "\033[92m",   # green
    CheckStatus.FAIL: "\033[91m",   # red
    CheckStatus.WARN: "\033[93m",   # yellow
    CheckStatus.SKIP: "\033[90m",   # grey
}
_RESET = "\033[0m"


def _colored(status: CheckStatus, text: str) -> str:
    if not sys.stdout.isatty():
        return text
    return f"{_COLORS.get(status, '')}{text}{_RESET}"


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def build_parser() -> argparse.ArgumentParser:
    p = argparse.ArgumentParser(
        prog="govcloud_validation",
        description=(
            "GovCloud Deployment Runbook v2.1 validator — "
            "CMMC L2/L3 · FedRAMP High · NIST 800-171/172 · "
            "IL4/IL5 · SOC-2 · ISO 27001/27003"
        ),
    )
    p.add_argument("--version", action="version", version=f"%(prog)s {__version__}")
    p.add_argument("--provider", default="aws-govcloud",
                   help="Cloud provider (default: aws-govcloud)")
    p.add_argument("--region", default="us-gov-west-1",
                   help="AWS region (default: us-gov-west-1)")
    p.add_argument("--list-stages", action="store_true",
                   help="List available stages and exit")
    p.add_argument("--only", metavar="STAGE_ID",
                   help="Run only the specified stage (comma-separated for multiple)")
    p.add_argument("--skip", metavar="STAGE_ID",
                   help="Skip specified stages (comma-separated)")
    p.add_argument("--json", dest="json_output", action="store_true",
                   help="Output results as JSON")
    p.add_argument("--framework", metavar="NAME",
                   help="Filter checks to a compliance framework "
                        "(cmmc-l2, cmmc-l3, fedramp-high, nist-171, nist-172, "
                        "soc2, iso-27001, il4, il5)")
    p.add_argument("--fail-on-warn", action="store_true",
                   help="Exit non-zero on WARN (default: only on FAIL)")
    return p


def main(argv: list[str] | None = None) -> int:
    parser = build_parser()
    args = parser.parse_args(argv)

    # -- List stages --------------------------------------------------------
    if args.list_stages:
        stages = get_all_stages(region=args.region)
        for s in stages:
            print(f"  {s.stage_id:30s}  {s.title}")
        return 0

    # -- Determine stages to run --------------------------------------------
    only_set = set()
    if args.only:
        only_set = {s.strip() for s in args.only.split(",")}
    skip_set = set()
    if args.skip:
        skip_set = {s.strip() for s in args.skip.split(",")}

    stages = get_all_stages(region=args.region)
    if only_set:
        stages = [s for s in stages if s.stage_id in only_set]
    if skip_set:
        stages = [s for s in stages if s.stage_id not in skip_set]

    if not stages:
        print("No stages matched. Use --list-stages to see available stages.",
              file=sys.stderr)
        return 1

    # -- Run ----------------------------------------------------------------
    all_results = []
    counts = {s: 0 for s in CheckStatus}

    for stage in stages:
        results = stage.run()

        # Optional framework filter
        if args.framework:
            from govcloud_validation.compliance import controls_for_framework
            filtered = []
            for r in results:
                matched = controls_for_framework(args.framework, r.controls)
                if matched or not r.controls:
                    filtered.append(r)
            results = filtered

        for r in results:
            counts[r.status] += 1

        all_results.append({
            "stage_id": stage.stage_id,
            "title": stage.title,
            "results": results,
        })

    # -- Output -------------------------------------------------------------
    if args.json_output:
        payload = {
            "version": __version__,
            "provider": args.provider,
            "region": args.region,
            "framework_filter": args.framework,
            "summary": {s.value: counts[s] for s in CheckStatus},
            "stages": [
                {
                    "stage_id": s["stage_id"],
                    "title": s["title"],
                    "checks": [r.to_dict() for r in s["results"]],
                }
                for s in all_results
            ],
        }
        json.dump(payload, sys.stdout, indent=2)
        print()
    else:
        for entry in all_results:
            header = f"=== {entry['stage_id']}: {entry['title']} ==="
            print(header)
            for r in entry["results"]:
                tag = _colored(r.status, f"[{r.status.value:4s}]")
                print(f"  {tag} {r.check_id}: {r.message}")
                if r.detail:
                    for line in r.detail.split("\n"):
                        print(f"       {line}")
                if r.controls:
                    ctrl_str = ", ".join(r.controls)
                    print(f"       Controls: {ctrl_str}")
            print()

        # Summary
        total = sum(counts.values())
        summary_parts = []
        for s in (CheckStatus.PASS, CheckStatus.WARN, CheckStatus.FAIL, CheckStatus.SKIP):
            summary_parts.append(f"{s.value}={counts[s]}")
        print(f"--- Summary: {' / '.join(summary_parts)} (total={total}) ---")

    # -- Exit code ----------------------------------------------------------
    if counts[CheckStatus.FAIL] > 0:
        return 2
    if args.fail_on_warn and counts[CheckStatus.WARN] > 0:
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
