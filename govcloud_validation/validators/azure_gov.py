"""Azure Government — stub validator (implement when runbook exists for Azure)."""

from __future__ import annotations

from typing import List, Tuple

from govcloud_validation.base import CheckResult, CheckStatus, GovCloudValidator, StageResult, ValidationContext
from govcloud_validation.registry import register


class AzureGovValidator(GovCloudValidator):
    provider_id = "azure-gov"

    # Mirror AWS stage IDs so CLI --skip works the same way
    STAGES: List[Tuple[str, str]] = [
        ("step_00_prereqs", "0) Pre-Reqs (Azure Gov — stub)"),
        ("step_00_2_us_person", "0.2) US-Person / IDC (stub)"),
        ("step_01_organizations", "1) Landing Zone (stub)"),
        ("step_02_root_guardrails", "2) Guardrails (stub)"),
        ("step_03_logging", "3) Logging (stub)"),
        ("step_04_networking", "4) Networking (stub)"),
        ("step_05_aurora", "5) Data (stub)"),
        ("step_06_compute", "6) Compute (stub)"),
        ("step_07_identity", "7) Identity (stub)"),
        ("step_08_encryption", "8) Crypto (stub)"),
        ("step_09_enclave", "9) Enclave API (stub)"),
        ("step_10_sdlc", "10) SDLC (stub)"),
        ("step_11_smoke", "11) Smoke (stub)"),
        ("step_12_evidence_binder", "12) Evidence binder (stub)"),
    ]

    def get_stages(self) -> List[Tuple[str, str]]:
        return list(self.STAGES)

    def validate_stage(self, stage_id: str, ctx: ValidationContext) -> StageResult:
        title = dict(self.STAGES).get(stage_id, stage_id)
        return StageResult(
            stage_id=stage_id,
            title=title,
            checks=[
                CheckResult(
                    "stub",
                    "Azure Government validation",
                    CheckStatus.SKIP,
                    "Not implemented — AWS GovCloud first. Add azure-mgmt-* checks when ready.",
                )
            ],
        )


register("azure-gov", AzureGovValidator)
