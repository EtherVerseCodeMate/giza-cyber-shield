"""
GovCloud / sovereign-cloud deployment validation — shared types and provider interface.

Maps validation stages to the AdinKhepra GovCloud Deployment Runbook v1 (steps 0–12).
"""

from __future__ import annotations

import json
from abc import ABC, abstractmethod
from dataclasses import dataclass, field, asdict
from datetime import datetime, timezone
from enum import Enum
from pathlib import Path
from typing import Any, Dict, List, Optional


class CheckStatus(str, Enum):
    PASS = "PASS"
    FAIL = "FAIL"
    WARN = "WARN"
    SKIP = "SKIP"


@dataclass
class CheckResult:
    """Single check outcome within a stage."""

    check_id: str
    name: str
    status: CheckStatus
    detail: str = ""
    evidence: Dict[str, Any] = field(default_factory=dict)
    control_hints: List[str] = field(default_factory=list)  # e.g. AU-2, SC-7 for binder


@dataclass
class StageResult:
    """Aggregated result for one runbook step."""

    stage_id: str
    title: str
    checks: List[CheckResult] = field(default_factory=list)

    def worst_status(self) -> CheckStatus:
        order = [CheckStatus.FAIL, CheckStatus.WARN, CheckStatus.SKIP, CheckStatus.PASS]
        rank = {s: i for i, s in enumerate(order)}
        best_rank = len(order)
        worst = CheckStatus.PASS
        for c in self.checks:
            r = rank.get(c.status, len(order))
            if r < best_rank:
                best_rank = r
                worst = c.status
        return worst


@dataclass
class ValidationReport:
    """Full run output (one provider, many stages).

    ``validator_version``, ``git_sha``, and ``boto3_version`` are recorded so
    a C3PAO assessor reviewing a JSON evidence artifact months later can
    determine exactly which version of the validation logic produced each result.
    """

    provider: str
    region: str
    generated_at: str
    stages: List[StageResult] = field(default_factory=list)
    skipped_stages: List[str] = field(default_factory=list)
    # Evidence traceability — populated by __main__.py at runtime.
    validator_version: str = ""   # semver of this package (e.g. "2.1.0")
    git_sha: str = ""             # short git commit SHA of the running code
    boto3_version: str = ""       # installed boto3 version (e.g. "1.34.69")

    def to_dict(self) -> Dict[str, Any]:
        def check_dict(c: CheckResult) -> Dict[str, Any]:
            d = asdict(c)
            d["status"] = c.status.value
            return d

        return {
            "provider": self.provider,
            "region": self.region,
            "generated_at": self.generated_at,
            "validator_version": self.validator_version,
            "git_sha": self.git_sha,
            "boto3_version": self.boto3_version,
            "skipped_stages": self.skipped_stages,
            "stages": [
                {
                    "stage_id": s.stage_id,
                    "title": s.title,
                    "worst_status": s.worst_status().value,
                    "checks": [check_dict(c) for c in s.checks],
                }
                for s in self.stages
            ],
        }

    def write_json(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(self.to_dict(), indent=2), encoding="utf-8")


@dataclass
class ValidationContext:
    """Runtime options passed to providers."""

    region: str = "us-gov-west-1"
    output_dir: Optional[Path] = None
    evidence_binder_path: Optional[Path] = None  # optional local path for step 12 artifacts


class GovCloudValidator(ABC):
    """Provider-specific validator (AWS GovCloud first; Azure / HPE later)."""

    provider_id: str = "abstract"

    @abstractmethod
    def get_stages(self) -> List[tuple[str, str]]:
        """Return [(stage_id, human_title), ...] in runbook order."""

    @abstractmethod
    def validate_stage(self, stage_id: str, ctx: ValidationContext) -> StageResult:
        """Run all checks for one stage."""


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


# ---------------------------------------------------------------------------
# StageValidator — base class for per-step validators (Steps 0–12)
# ---------------------------------------------------------------------------

import os as _os

try:
    import boto3 as _boto3
    _HAS_BOTO3 = True
except ImportError:  # pragma: no cover
    _boto3 = None  # type: ignore
    _HAS_BOTO3 = False


class StageValidator:
    """Base class for runbook step validators.

    Subclasses declare ``stage_id`` and ``title`` as class attributes and
    implement ``checks()``.  The ``@register`` decorator (from
    ``govcloud_validation.registry``) wires each subclass into the stage
    registry so ``AWSGovCloudValidator`` can delegate to it when no built-in
    handler covers the stage.

    Usage::

        @register
        class Step06ALambda(StageValidator):
            stage_id = "step_06a_lambda"
            title    = "6A) Lambda + DynamoDB"

            def checks(self) -> list[CheckResult]:
                ...
    """

    stage_id: str = ""
    title: str = ""

    def __init__(self, region: str = "us-gov-west-1") -> None:
        self.region = region

    # ── boto3 helpers ─────────────────────────────────────────────────────────

    def _client(self, service: str):
        """Return a boto3 client or ``None`` when boto3 is unavailable."""
        if not _HAS_BOTO3 or _boto3 is None:
            return None
        try:
            return _boto3.client(service, region_name=self.region)
        except Exception:  # noqa: BLE001
            return None

    def _env(self, name: str) -> str:
        """Return stripped env-var value or empty string."""
        return (_os.environ.get(name) or "").strip()

    # ── CheckResult factory methods ───────────────────────────────────────────

    def _pass(
        self,
        check_id: str,
        name: str,
        detail: str = "",
        controls: Optional[List[str]] = None,
    ) -> "CheckResult":
        return CheckResult(check_id, name, CheckStatus.PASS, detail,
                           control_hints=controls or [])

    def _fail(
        self,
        check_id: str,
        name: str,
        detail: str = "",
        controls: Optional[List[str]] = None,
    ) -> "CheckResult":
        return CheckResult(check_id, name, CheckStatus.FAIL, detail,
                           control_hints=controls or [])

    def _warn(
        self,
        check_id: str,
        name: str,
        detail: str = "",
        controls: Optional[List[str]] = None,
    ) -> "CheckResult":
        return CheckResult(check_id, name, CheckStatus.WARN, detail,
                           control_hints=controls or [])

    def _skip(
        self,
        check_id: str,
        name: str,
        detail: str = "",
        controls: Optional[List[str]] = None,
    ) -> "CheckResult":
        return CheckResult(check_id, name, CheckStatus.SKIP, detail,
                           control_hints=controls or [])

    # ── Abstract interface ────────────────────────────────────────────────────

    def checks(self) -> "List[CheckResult]":
        """Override in subclass — return all CheckResult objects for this stage."""
        raise NotImplementedError(
            f"{type(self).__name__}.checks() not implemented"
        )

    def run(self) -> "StageResult":
        """Execute ``checks()`` and wrap in a ``StageResult``."""
        return StageResult(
            stage_id=self.stage_id,
            title=self.title,
            checks=self.checks(),
        )
