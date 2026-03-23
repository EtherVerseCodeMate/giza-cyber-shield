"""
CLI: i [options]
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from govcloud_validation.base import ValidationContext, ValidationReport, utc_now_iso
from govcloud_validation.registry import get_validator, list_providers


def _parse_skip(raw: list[str] | None) -> set[str]:
    if not raw:
        return set()
    out: set[str] = set()
    for item in raw:
        for part in item.replace(",", " ").split():
            p = part.strip()
            if p:
                out.add(p)
    return out


def run_validation(
    provider: str,
    region: str,
    skip: set[str],
    stages_filter: set[str] | None,
    output_dir: Path | None,
    evidence_binder: Path | None,
    quiet: bool,
) -> ValidationReport:
    validator = get_validator(provider)
    ctx = ValidationContext(
        region=region,
        output_dir=output_dir,
        evidence_binder_path=evidence_binder,
    )
    skipped: list[str] = []
    results = []
    for stage_id, title in validator.get_stages():
        if stages_filter is not None and stage_id not in stages_filter:
            continue
        if stage_id in skip:
            skipped.append(stage_id)
            if not quiet:
                print(f"[SKIP] {stage_id} — excluded via --skip")
            continue
        if not quiet:
            print(f"\n=== {stage_id}: {title} ===")
        sr = validator.validate_stage(stage_id, ctx)
        results.append(sr)
        if not quiet:
            for c in sr.checks:
                sym = {"PASS": "✓", "FAIL": "✗", "WARN": "!", "SKIP": "-"}.get(c.status.value, "?")
                print(f"  [{c.status.value}] {sym} {c.check_id}: {c.name}")
                if c.detail:
                    print(f"       {c.detail}")
    report = ValidationReport(
        provider=provider,
        region=region,
        generated_at=utc_now_iso(),
        stages=results,
        skipped_stages=skipped,
    )
    if output_dir:
        report.write_json(output_dir / "govcloud_validation_report.json")
        if not quiet:
            print(f"\nWrote {output_dir / 'govcloud_validation_report.json'}")
    return report


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(
        description="Validate GovCloud / sovereign deployment runbook stages (AWS GovCloud first).",
    )
    p.add_argument(
        "--provider",
        default="aws-govcloud",
        choices=list_providers(),
        help="Validator provider (default: aws-govcloud)",
    )
    p.add_argument(
        "--region",
        default="us-gov-west-1",
        help="AWS region for GovCloud session (default: us-gov-west-1)",
    )
    p.add_argument(
        "--skip",
        action="append",
        default=[],
        metavar="STAGE_ID",
        help="Stage id to skip (repeat or comma-separated). Example: --skip step_05_aurora step_06_compute",
    )
    p.add_argument(
        "--only",
        action="append",
        default=[],
        metavar="STAGE_ID",
        help="Run only these stage ids (if set, --skip still applies within that set)",
    )
    p.add_argument(
        "--output",
        "-o",
        type=Path,
        default=None,
        help="Directory to write govcloud_validation_report.json",
    )
    p.add_argument(
        "--evidence-binder",
        type=Path,
        default=None,
        help="Local directory with Step 12 binder artifacts (optional)",
    )
    p.add_argument("--quiet", "-q", action="store_true", help="Minimal stdout")
    p.add_argument("--list-stages", action="store_true", help="Print stage ids and exit")
    args = p.parse_args(argv)

    validator = get_validator(args.provider)
    if args.list_stages:
        for sid, title in validator.get_stages():
            print(f"{sid}\t{title}")
        return 0

    skip = _parse_skip(args.skip)
    only = _parse_skip(args.only) if args.only else None

    report = run_validation(
        provider=args.provider,
        region=args.region,
        skip=skip,
        stages_filter=only,
        output_dir=args.output,
        evidence_binder=args.evidence_binder,
        quiet=args.quiet,
    )

    # Exit 1 if any non-skipped stage has FAIL
    for s in report.stages:
        if s.worst_status().value == "FAIL":
            return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
