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
    """Full run output (one provider, many stages)."""

    provider: str
    region: str
    generated_at: str
    stages: List[StageResult] = field(default_factory=list)
    skipped_stages: List[str] = field(default_factory=list)

    def to_dict(self) -> Dict[str, Any]:
        def check_dict(c: CheckResult) -> Dict[str, Any]:
            d = asdict(c)
            d["status"] = c.status.value
            return d

        return {
            "provider": self.provider,
            "region": self.region,
            "generated_at": self.generated_at,
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
