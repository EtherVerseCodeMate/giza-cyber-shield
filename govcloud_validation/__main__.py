"""
CLI: python -m govcloud_validation [options]
"""

from __future__ import annotations

import argparse
import subprocess
import sys
from pathlib import Path

from govcloud_validation.base import CheckStatus, StageResult, ValidationContext, ValidationReport, utc_now_iso
from govcloud_validation.registry import get_validator, list_providers

# Validator semver — bump on every release that changes check logic.
VALIDATOR_VERSION = "2.1.0"


def _get_git_sha() -> str:
    """Return short HEAD SHA of the running code, or empty string on failure."""
    try:
        result = subprocess.run(
            ["git", "rev-parse", "--short", "HEAD"],
            capture_output=True, text=True, timeout=5,
        )
        return result.stdout.strip() if result.returncode == 0 else ""
    except Exception:
        return ""


def _get_boto3_version() -> str:
    """Return the installed boto3 version string, or 'not-installed'."""
    try:
        import boto3  # noqa: PLC0415
        return boto3.__version__
    except ImportError:
        return "not-installed"


def _parse_id_list(raw: list[str] | None) -> set[str]:
    if not raw:
        return set()
    out: set[str] = set()
    for item in raw:
        for part in item.split(","):
            p = part.strip()
            if p:
                out.add(p)
    return out


def _print_stage_result(quiet: bool, stage_result: StageResult) -> None:
    if quiet:
        return
    print(f"\n=== {stage_result.stage_id} — {stage_result.title} ===", file=sys.stderr)
    for c in stage_result.checks:
        print(f"  [{c.status.value}] {c.name}: {c.detail}", file=sys.stderr)


def run_validation(
    provider: str,
    region: str,
    skip_stages: set[str],
    only_stages: set[str] | None,
    output_path: Path | None,
    evidence_binder_path: Path | None,
    quiet: bool,
) -> tuple[ValidationReport, int]:
    validator = get_validator(provider)
    stage_defs = validator.get_stages()
    out_parent = output_path.parent if output_path else None
    ctx = ValidationContext(
        region=region,
        output_dir=out_parent,
        evidence_binder_path=evidence_binder_path,
    )

    report = ValidationReport(
        provider=provider,
        region=region,
        generated_at=utc_now_iso(),
        validator_version=VALIDATOR_VERSION,
        git_sha=_get_git_sha(),
        boto3_version=_get_boto3_version(),
        stages=[],
        skipped_stages=[],
    )
    exit_code = 0

    for stage_id, _title in stage_defs:
        if stage_id in skip_stages:
            report.skipped_stages.append(stage_id)
            if not quiet:
                print(f"Skip (--skip): {stage_id}", file=sys.stderr)
            continue
        if only_stages is not None and stage_id not in only_stages:
            report.skipped_stages.append(stage_id)
            continue

        if not quiet:
            print(f"Running {stage_id} …", file=sys.stderr)

        stage_result = validator.validate_stage(stage_id, ctx)
        report.stages.append(stage_result)
        _print_stage_result(quiet, stage_result)

        worst = stage_result.worst_status()
        if worst == CheckStatus.FAIL:
            exit_code = 1

    if output_path:
        report.write_json(output_path)
        if not quiet:
            print(f"Wrote JSON report: {output_path}", file=sys.stderr)

    return report, exit_code


def main(argv: list[str] | None = None) -> int:
    p = argparse.ArgumentParser(
        prog="python -m govcloud_validation",
        description="GovCloud / sovereign-cloud deployment validation (runbook-aligned stages).",
    )
    p.add_argument(
        "--provider",
        default="aws-govcloud",
        choices=list_providers(),
        help="Validator provider (default: aws-govcloud).",
    )
    p.add_argument("--region", default="us-gov-west-1", help="AWS region (default: us-gov-west-1).")
    p.add_argument(
        "--skip",
        action="append",
        default=[],
        metavar="STAGE_ID",
        help="Stage id to skip (repeat or comma-separate). Example: --skip step_05_aurora,step_06_compute",
    )
    p.add_argument(
        "--only",
        action="append",
        default=[],
        metavar="STAGE_ID",
        help="If set, run only these stage ids (comma-separate allowed).",
    )
    p.add_argument(
        "--output",
        type=Path,
        metavar="PATH",
        help="Write full ValidationReport JSON to this path.",
    )
    p.add_argument(
        "--evidence-binder",
        type=Path,
        metavar="PATH",
        help="Local directory for step 12 evidence binder inputs (optional).",
    )
    p.add_argument("--quiet", action="store_true", help="Less stderr output (still writes --output if set).")
    p.add_argument(
        "--list-stages",
        action="store_true",
        help="Print stage ids for --provider and exit.",
    )
    args = p.parse_args(argv)

    if args.list_stages:
        v = get_validator(args.provider)
        for sid, title in v.get_stages():
            print(f"{sid}\t{title}")
        return 0

    skip_set = _parse_id_list(args.skip)
    only_raw = _parse_id_list(args.only) if args.only else None
    only_set = only_raw if args.only else None

    try:
        _, code = run_validation(
            provider=args.provider,
            region=args.region,
            skip_stages=skip_set,
            only_stages=only_set,
            output_path=args.output,
            evidence_binder_path=args.evidence_binder,
            quiet=args.quiet,
        )
    except KeyError as e:
        print(str(e), file=sys.stderr)
        return 2

    return code


if __name__ == "__main__":
    sys.exit(main())
